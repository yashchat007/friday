import { randomUUID } from 'node:crypto'
import type { AgentEvent, SendTaskPayload } from '../../../shared/types/ipc'
import type { TaskRun } from '../../../shared/types/tools'
import type { MemoryStore } from '../memory/db'
import { getSettings } from '../settings'
import type { ApprovalGate } from '../tools/approval-gate'
import type { ToolExecutor } from '../tools/executor'
import type { ToolRegistry } from '../tools/registry'
import { extractAndStoreFacts } from './memory-extract'
import { TaskPerformanceTracker } from './performance-tracker'
import { getCachedReadiness, invalidateReadinessCache, setCachedReadiness } from './provider-readiness-cache'
import { createLlmProvider } from './providers/create-llm-provider'
import { sanitizeAssistantText } from './output-sanitize'
import { ToolCallingLoop } from './tool-loop'
import { classifyUserIntentWithContext } from './automation-context'
import { buildDeterministicConversationResponse } from './factual-queries'
import { parseDirectAction, type DirectAction } from './direct-actions/parse'
import { executeDirectAction } from './direct-actions/execute'
import { logRequestStage } from './request-log'

export class AgentService {
  private active = false
  private loop: ToolCallingLoop
  private abortController: AbortController | null = null
  private currentTaskRun: TaskRun | null = null

  constructor(
    private registry: ToolRegistry,
    private executor: ToolExecutor,
    private memory: MemoryStore,
    private approvalGate: ApprovalGate,
    private emit: (event: AgentEvent) => void
  ) {
    this.loop = new ToolCallingLoop(
      executor,
      emit,
      () => registry.listDefinitions()
    )
  }

  isRunning(): boolean {
    return this.active
  }

  cancelActiveTask(): void {
    logRequestStage(this.currentTaskRun?.id ?? 'none', 'cancel_requested')
    this.abortController?.abort()
    this.approvalGate.clear()
  }

  private completeAssistantReply(taskRun: TaskRun, summary: string): void {
    this.memory.saveTaskRun(taskRun)
    if (summary && taskRun.status !== 'cancelled') {
      this.memory.saveMessage({
        id: randomUUID(),
        role: 'assistant',
        content: sanitizeAssistantText(summary),
        createdAt: Date.now()
      })
    }
  }

  private async runDirectActionPath(
    requestId: string,
    message: string,
    action: DirectAction,
    started: number
  ): Promise<void> {
    const taskRun: TaskRun = {
      id: requestId,
      userMessage: message,
      status: 'running',
      steps: [],
      startedAt: started
    }
    this.currentTaskRun = taskRun
    this.emit({ type: 'task_started', taskRun })
    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'tool',
      detail: action.kind === 'launch_app' ? 'Launching application…' : 'Opening in Chrome…'
    })

    const result = await executeDirectAction(
      this.executor,
      taskRun,
      action,
      this.abortController?.signal
    )

    if (this.abortController?.signal.aborted) {
      taskRun.status = 'cancelled'
      taskRun.assistantSummary = 'Task cancelled.'
    } else {
      taskRun.status = result.ok ? 'completed' : 'failed'
      let summary = result.message
      if (
        result.ok &&
        action.kind === 'launch_app' &&
        action.app === 'whatsapp' &&
        /\b(?:send|message|tell|text)\b/i.test(message)
      ) {
        summary +=
          ' Messaging through WhatsApp Web requires Chrome with CDP attached; FRIDAY did not send a message from the desktop app.'
      }
      taskRun.assistantSummary = summary
      if (!result.ok) {
        this.emit({ type: 'error', message: result.message })
      }
    }
    taskRun.finishedAt = Date.now()
    this.emit({ type: 'task_finished', taskRun })
    this.completeAssistantReply(taskRun, taskRun.assistantSummary ?? '')
    logRequestStage(requestId, 'direct_action_done', {
      ok: result.ok,
      elapsedMs: Date.now() - started
    })
    this.currentTaskRun = null
  }

  async handleUserMessage(payload: SendTaskPayload): Promise<void> {
    const requestId = randomUUID()
    const started = Date.now()
    logRequestStage(requestId, 'received', { messageChars: payload.message.length })

    if (this.active) {
      this.emit({ type: 'error', message: 'A task is already running. Cancel it or wait for it to finish.' })
      return
    }
    this.active = true
    this.abortController = new AbortController()

    try {
      const userMsg = {
        id: randomUUID(),
        role: 'user' as const,
        content: payload.message,
        createdAt: Date.now()
      }
      this.memory.saveMessage(userMsg)

      if (payload.message.startsWith('/remember ')) {
        const fact = payload.message.slice('/remember '.length).trim()
        if (fact) this.memory.addFact(fact)
      } else {
        extractAndStoreFacts(payload.message, this.memory)
      }

      const contextMessages = this.memory.recentMessages(40)
      const settings = getSettings()
      const directAction = parseDirectAction(payload.message, settings)
      if (directAction) {
        logRequestStage(requestId, 'route_direct', { kind: directAction.kind })
        await this.runDirectActionPath(requestId, payload.message, directAction, started)
        return
      }

      const intent = classifyUserIntentWithContext(payload.message, contextMessages)
      const deterministic =
        intent === 'conversation'
          ? buildDeterministicConversationResponse(payload.message, this.memory.recentFacts())
          : null

      if (deterministic) {
        const taskRun: TaskRun = {
          id: requestId,
          userMessage: payload.message,
          status: 'completed',
          steps: [],
          startedAt: started,
          finishedAt: Date.now(),
          assistantSummary: deterministic
        }
        this.emit({ type: 'task_started', taskRun })
        this.emit({ type: 'task_finished', taskRun })
        this.completeAssistantReply(taskRun, deterministic)
        logRequestStage(requestId, 'route_factual', { elapsedMs: Date.now() - started })
        return
      }

      const provider = createLlmProvider(settings)
      const cacheKey = `${provider.id}:${settings.ollamaBaseUrl}:${settings.ollamaModel}:${settings.geminiModel}:${settings.geminiApiKey ? 'set' : 'unset'}`

      const perf = new TaskPerformanceTracker()
      this.emit({
        type: 'task_progress',
        taskRunId: requestId,
        phase: 'preflight',
        detail: 'Checking AI provider…'
      })

      let readiness = getCachedReadiness(cacheKey)
      if (!readiness) {
        readiness = await provider.checkReady()
        if (readiness.ready) {
          setCachedReadiness(cacheKey, readiness)
        }
      }
      perf.markPreflightDone()

      if (!readiness.ready) {
        this.emit({
          type: 'error',
          message: readiness.error ?? 'AI provider is not ready. Check Settings.'
        })
        return
      }

      logRequestStage(requestId, 'route_llm', { provider: provider.id })

      let taskRun: Awaited<ReturnType<ToolCallingLoop['runTask']>> | null = null
      taskRun = await this.loop.runTask({
        userMessage: payload.message,
        provider,
        memoryFacts: this.memory.recentFacts(),
        contextMessages,
        currentMessageId: userMsg.id,
        signal: this.abortController.signal,
        performance: perf
      })

      this.currentTaskRun = taskRun

      if (process.env.FRIDAY_OLLAMA_DEBUG === '1' && taskRun.metrics) {
        const m = taskRun.metrics
        console.info(
          '[friday:ollama]',
          JSON.stringify({
            requestId,
            ollamaModel: m.ollamaModel,
            promptTokens: m.promptTokens,
            promptEvalMs: m.ollamaPromptEvalMs,
            generationMs: m.ollamaGenerationMs,
            inferTtftMs: m.inferenceTimeToFirstTokenMs
          })
        )
      }

      this.completeAssistantReply(taskRun, taskRun.assistantSummary ?? '')
      logRequestStage(requestId, 'llm_done', {
        status: taskRun.status,
        elapsedMs: Date.now() - started
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logRequestStage(requestId, 'error', { message, elapsedMs: Date.now() - started })
      this.emit({ type: 'error', message })
      const failed: TaskRun = {
        id: requestId,
        userMessage: payload.message,
        status: 'failed',
        steps: [],
        startedAt: started,
        finishedAt: Date.now(),
        assistantSummary: message
      }
      this.emit({ type: 'task_finished', taskRun: failed })
      this.completeAssistantReply(failed, message)
    } finally {
      this.active = false
      this.abortController = null
      this.currentTaskRun = null
    }
  }
}

export function onSettingsChanged(): void {
  invalidateReadinessCache()
}
