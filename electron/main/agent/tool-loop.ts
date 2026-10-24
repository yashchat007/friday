import { randomUUID } from 'node:crypto'
import type { AgentEvent } from '../../../shared/types/ipc'
import type { TaskRun, ToolDefinition } from '../../../shared/types/tools'
import type { ToolExecutor } from '../tools/executor'
import type { ChatMessage } from '../../../shared/types/ipc'
import {
  buildOllamaConversationMessages,
  selectConversationContext
} from './chat-context'
import { shouldIncludeConversationHistory } from './conversation-history-policy'
import { classifyUserIntentWithContext, type UserIntent } from './automation-context'
import { formatRecentChatContext } from './task-run-context'
import { buildUserTurnContent } from './prompt-builder'
import { sanitizeAssistantText } from './output-sanitize'
import { TaskPerformanceTracker } from './performance-tracker'
import type { LlmProvider } from './providers/model-types'
import type { OllamaChatMessage } from './providers/ollama-types'
import { AUTOMATION_SYSTEM_PROMPT, conversationSystemWithFacts } from './system-prompts'
import {
  inferTaskExpectation,
  incompleteTaskHint,
  isAutomationComplete,
  isTaskObjectiveMet
} from './task-completion'
import { toolProgressLabel } from './tool-progress'
import { isWhatsAppWebSendRequest, parseWhatsAppSendIntent } from '../automation/whatsapp-intent'
import { getSettings } from '../settings'
import {
  buildGoogleSearchUrl,
  isOpenSiteRequest,
  parseWebSearchQuery,
  resolveOpenSiteUrl
} from './open-site-playbook'
import { DuplicateActionGuard } from './duplicate-action-guard'

export class ToolCallingLoop {
  constructor(
    private executor: ToolExecutor,
    private emit: (event: AgentEvent) => void,
    private getTools: () => ToolDefinition[]
  ) {}

  async runTask(params: {
    userMessage: string
    provider: LlmProvider
    memoryFacts: string[]
    contextMessages?: ChatMessage[]
    currentMessageId?: string
    maxSteps?: number
    signal?: AbortSignal
    intent?: UserIntent
    performance?: TaskPerformanceTracker
  }): Promise<TaskRun> {
    const intent = params.intent ?? classifyUserIntentWithContext(params.userMessage, params.contextMessages)
    const perf = params.performance ?? new TaskPerformanceTracker()

    const taskRun: TaskRun = {
      id: randomUUID(),
      userMessage: params.userMessage,
      status: 'running',
      steps: [],
      startedAt: Date.now()
    }

    this.emit({ type: 'task_started', taskRun })
    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'thinking',
      detail:
        intent === 'conversation'
          ? 'Composing a reply…'
          : isWhatsAppWebSendRequest(params.userMessage)
            ? 'Preparing WhatsApp message…'
            : inferTaskExpectation(params.userMessage, params.contextMessages).needsYoutubePlay
              ? 'Preparing YouTube automation…'
              : 'Planning next steps…'
    })

    const chatContext =
      intent === 'automation' ? formatRecentChatContext(params.contextMessages ?? [], 8) : undefined
    const userContent = buildUserTurnContent({
      message: params.userMessage,
      chatContext,
      memoryFacts: params.memoryFacts,
      intent
    })

    if (intent === 'conversation') {
      const includeHistory = shouldIncludeConversationHistory(params.userMessage, intent)
      const context = includeHistory
        ? selectConversationContext(params.contextMessages ?? [], params.currentMessageId ?? '')
        : []
      const messages = buildOllamaConversationMessages({
        context,
        userMessage: params.userMessage
      })
      return this.runConversationTurn(taskRun, params, messages, perf, includeHistory)
    }

    return this.runAutomationLoop(taskRun, params, userContent, perf)
  }

  private finishTask(taskRun: TaskRun, perf: TaskPerformanceTracker): void {
    taskRun.metrics = perf.finish(taskRun.steps)
    this.emit({ type: 'task_metrics', taskRunId: taskRun.id, metrics: taskRun.metrics })
    this.emit({ type: 'task_finished', taskRun })
  }

  private async runConversationTurn(
    taskRun: TaskRun,
    params: {
      provider: LlmProvider
      memoryFacts: string[]
      signal?: AbortSignal
    },
    messages: OllamaChatMessage[],
    perf: TaskPerformanceTracker,
    historyIncluded: boolean
  ): Promise<TaskRun> {
    try {
      if (params.signal?.aborted) {
        taskRun.status = 'cancelled'
        taskRun.finishedAt = Date.now()
        taskRun.assistantSummary = 'Task cancelled.'
        this.finishTask(taskRun, perf)
        return taskRun
      }

      const conversationMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

      const turn = await this.invokeModel(taskRun.id, params.provider.id, perf, (callbacks) =>
        params.provider.runConversationTurn({
          systemInstruction: conversationSystemWithFacts(params.memoryFacts),
          messages: conversationMessages,
          tools: [],
          intent: 'conversation',
          historyIncluded,
          signal: params.signal,
          ...this.guardedTextCallbacks(callbacks)
        })
      )

      if (turn.toolCalls.length > 0) {
        taskRun.status = 'failed'
        taskRun.finishedAt = Date.now()
        taskRun.assistantSummary =
          'Internal error: conversation mode received tool calls. No tools were executed.'
        this.finishTask(taskRun, perf)
        return taskRun
      }

      taskRun.assistantSummary = sanitizeAssistantText(turn.text)
      taskRun.status = 'completed'
      taskRun.finishedAt = Date.now()
      this.finishTask(taskRun, perf)
      return taskRun
    } catch (err) {
      if (params.signal?.aborted) {
        taskRun.status = 'cancelled'
        taskRun.finishedAt = Date.now()
        taskRun.assistantSummary = 'Task cancelled.'
        this.finishTask(taskRun, perf)
        return taskRun
      }
      const message = err instanceof Error ? err.message : String(err)
      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = message
      this.emit({ type: 'error', message })
      this.finishTask(taskRun, perf)
      return taskRun
    }
  }

  private async runAutomationLoop(
    taskRun: TaskRun,
    params: {
      userMessage: string
      provider: LlmProvider
      contextMessages?: ChatMessage[]
      maxSteps?: number
      signal?: AbortSignal
    },
    userContent: string,
    perf: TaskPerformanceTracker
  ): Promise<TaskRun> {
    const maxSteps = params.maxSteps ?? 15
    const tools = this.getTools()
    const expectation = inferTaskExpectation(params.userMessage, params.contextMessages)
    let incompleteNudgeUsed = false
    const session = params.provider.beginAutomationSession(userContent)

    const settings = getSettings()
    if (isOpenSiteRequest(params.userMessage, settings)) {
      const openOk = await this.runOpenSitePlaybook(taskRun, params.userMessage, params.signal, perf)
      if (openOk) return taskRun
      if (taskRun.status === 'cancelled' || taskRun.status === 'failed') return taskRun
    }

    if (isWhatsAppWebSendRequest(params.userMessage)) {
      const waOk = await this.runWhatsAppPlaybook(taskRun, params.userMessage, params.signal, perf)
      if (waOk) return taskRun
      if (taskRun.status === 'cancelled' || taskRun.status === 'failed') return taskRun
    }

    if (expectation.needsYoutubePlay && expectation.youtubeQuery) {
      const playbookOk = await this.runYouTubePlaybook(
        taskRun,
        expectation.youtubeQuery,
        params.signal,
        perf
      )
      if (playbookOk) return taskRun
      if (taskRun.status === 'cancelled' || taskRun.status === 'failed') return taskRun
      session.appendUserMessage(
        `Direct YouTube automation did not finish. Complete the request using browser_youtube_search_play or browser_* tools for "${expectation.youtubeQuery}".`
      )
    }

    const aborted = (): boolean => {
      if (params.signal?.aborted) {
        taskRun.status = 'cancelled'
        taskRun.finishedAt = Date.now()
        taskRun.assistantSummary = 'Task cancelled.'
        this.finishTask(taskRun, perf)
        return true
      }
      return false
    }

    const duplicateGuard = new DuplicateActionGuard()

    try {
      for (let step = 0; step < maxSteps; step++) {
        if (aborted()) return taskRun

        const turn = await this.invokeModel(taskRun.id, params.provider.id, perf, (callbacks) =>
          session.runTurn({
            systemInstruction: AUTOMATION_SYSTEM_PROMPT,
            tools,
            signal: params.signal,
            ...callbacks
          })
        )

        if (aborted()) return taskRun

        if (turn.toolCalls.length === 0) {
          const hint = incompleteTaskHint(expectation, taskRun.steps)
          if (hint && !incompleteNudgeUsed) {
            incompleteNudgeUsed = true
            session.appendUserMessage(hint)
            continue
          }

          if (!isAutomationComplete(expectation, taskRun.steps)) {
            taskRun.status = 'failed'
            taskRun.finishedAt = Date.now()
            taskRun.assistantSummary =
              hint ??
              'Task incomplete: required automation steps did not succeed. Check the task timeline.'
            this.finishTask(taskRun, perf)
            return taskRun
          }

          taskRun.assistantSummary = turn.text
          taskRun.status = 'completed'
          taskRun.finishedAt = Date.now()
          this.finishTask(taskRun, perf)
          return taskRun
        }

        const toolResults: Array<{ ok: boolean; result?: unknown; error?: string | null }> = []

        for (const call of turn.toolCalls) {
          if (aborted()) return taskRun
          if (duplicateGuard.shouldBlock(call.name, call.args)) {
            toolResults.push({
              ok: false,
              error: `Skipped duplicate action: ${call.name} (loop prevention).`
            })
            continue
          }
          this.emit({
            type: 'task_progress',
            taskRunId: taskRun.id,
            phase: 'tool',
            detail: `${toolProgressLabel(call.name)}…`
          })
          const toolStep = await this.executor.runStep(taskRun, call.name, call.args)
          taskRun.steps.push(toolStep)
          if (toolStep.ok === false && toolStep.approvalStatus === 'denied') {
            taskRun.status = 'failed'
            taskRun.finishedAt = Date.now()
            taskRun.assistantSummary = 'Task stopped: user denied a sensitive action.'
            this.finishTask(taskRun, perf)
            return taskRun
          }

          toolResults.push({
            ok: toolStep.ok ?? false,
            result: toolStep.result,
            error: toolStep.error ?? null
          })
        }

        session.recordAssistantTurn(turn.text, turn.toolCalls)
        session.recordToolResults(turn.toolCalls, toolResults)
      }

      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = 'Stopped: exceeded maximum tool steps.'
      this.finishTask(taskRun, perf)
      return taskRun
    } catch (err) {
      if (params.signal?.aborted) {
        taskRun.status = 'cancelled'
        taskRun.finishedAt = Date.now()
        taskRun.assistantSummary = 'Task cancelled.'
        this.finishTask(taskRun, perf)
        return taskRun
      }
      const message = err instanceof Error ? err.message : String(err)
      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = message
      this.emit({ type: 'error', message })
      this.finishTask(taskRun, perf)
      return taskRun
    }
  }

  private guardedTextCallbacks(callbacks: {
    onText?: (delta: string) => void
    onFirstToken?: () => void
  }) {
    return {
      onFirstToken: callbacks.onFirstToken,
      onText: (delta: string) => {
        if (this.looksLikeLeakedToolJson(delta)) return
        callbacks.onText?.(delta)
      }
    }
  }

  private looksLikeLeakedToolJson(delta: string): boolean {
    return /"name"\s*:\s*"(desktop_|file_|browser_|run_)/.test(delta)
  }

  private async runOpenSitePlaybook(
    taskRun: TaskRun,
    userMessage: string,
    signal?: AbortSignal,
    perf?: TaskPerformanceTracker
  ): Promise<boolean> {
    if (signal?.aborted) {
      taskRun.status = 'cancelled'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = 'Task cancelled.'
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    const settings = getSettings()
    let targetUrl = resolveOpenSiteUrl(userMessage, settings)
    if (!targetUrl) {
      const query = parseWebSearchQuery(userMessage)
      if (query) targetUrl = buildGoogleSearchUrl(query)
    }
    if (!targetUrl) return false

    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'tool',
      detail: 'Connecting to Chrome…'
    })

    const step = await this.executor.runStep(taskRun, 'browser_navigate', { url: targetUrl })
    taskRun.steps.push(step)

    if (step.ok) {
      const data = step.result as { url?: string; title?: string; verified?: boolean } | undefined
      if (data?.verified) {
        taskRun.status = 'completed'
        taskRun.finishedAt = Date.now()
        taskRun.assistantSummary = `Opened ${data.title ?? targetUrl} in Chrome.`
        if (perf) this.finishTask(taskRun, perf)
        return true
      }
    }

    taskRun.status = 'failed'
    taskRun.finishedAt = Date.now()
    taskRun.assistantSummary = step.error ?? 'Could not verify navigation in Chrome.'
    if (perf) this.finishTask(taskRun, perf)
    return true
  }

  private async runWhatsAppPlaybook(
    taskRun: TaskRun,
    userMessage: string,
    signal?: AbortSignal,
    perf?: TaskPerformanceTracker
  ): Promise<boolean> {
    const intent = parseWhatsAppSendIntent(userMessage)
    if (!intent) return false

    if (signal?.aborted) {
      taskRun.status = 'cancelled'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = 'Task cancelled.'
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'tool',
      detail: 'Opening WhatsApp Web…'
    })

    const prepStep = await this.executor.runStep(taskRun, 'whatsapp_prepare', {
      contactName: intent.contactName,
      rawMessage: intent.rawMessage
    })
    taskRun.steps.push(prepStep)

    if (!prepStep.ok) {
      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = prepStep.error ?? 'Could not prepare WhatsApp message.'
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    const prep = prepStep.result as { displayName?: string; message?: string; contactName?: string }
    const displayName = prep.displayName ?? intent.contactName
    const message = prep.message ?? intent.rawMessage

    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'tool',
      detail: `Confirm send to ${displayName}…`
    })

    const sendStep = await this.executor.runStep(taskRun, 'whatsapp_send_message', {
      contactName: displayName,
      message
    })
    taskRun.steps.push(sendStep)

    if (sendStep.approvalStatus === 'denied') {
      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = 'Message not sent — you cancelled the confirmation.'
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    if (sendStep.ok) {
      taskRun.status = 'completed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = `Message sent to ${displayName}.`
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    taskRun.status = 'failed'
    taskRun.finishedAt = Date.now()
    taskRun.assistantSummary = sendStep.error ?? 'Failed to send WhatsApp message.'
    if (perf) this.finishTask(taskRun, perf)
    return true
  }

  private async runYouTubePlaybook(
    taskRun: TaskRun,
    query: string,
    signal?: AbortSignal,
    perf?: TaskPerformanceTracker
  ): Promise<boolean> {
    if (signal?.aborted) {
      taskRun.status = 'cancelled'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = 'Task cancelled.'
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'tool',
      detail: 'Opening browser…'
    })
    this.emit({
      type: 'task_progress',
      taskRunId: taskRun.id,
      phase: 'tool',
      detail: 'Searching YouTube…'
    })

    const toolStep = await this.executor.runStep(taskRun, 'browser_youtube_search_play', { query })
    taskRun.steps.push(toolStep)

    if (toolStep.ok === false && toolStep.approvalStatus === 'denied') {
      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = 'Task stopped: user denied browser automation.'
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    if (toolStep.ok && isTaskObjectiveMet(inferTaskExpectation(taskRun.userMessage), taskRun.steps)) {
      this.emit({
        type: 'task_progress',
        taskRunId: taskRun.id,
        phase: 'tool',
        detail: 'Verifying playback…'
      })
      const data = toolStep.result as { title?: string; selectedTitle?: string } | undefined
      const label = data?.selectedTitle ?? data?.title ?? query
      taskRun.assistantSummary = `Now playing “${label}” on YouTube. Playback verified.`
      taskRun.status = 'completed'
      taskRun.finishedAt = Date.now()
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    if (toolStep.ok === false && toolStep.error) {
      taskRun.status = 'failed'
      taskRun.finishedAt = Date.now()
      taskRun.assistantSummary = toolStep.error
      if (perf) this.finishTask(taskRun, perf)
      return true
    }

    return false
  }

  private async invokeModel(
    taskRunId: string,
    providerId: LlmProvider['id'],
    perf: TaskPerformanceTracker,
    run: (callbacks: {
      onText: (delta: string) => void
      onFirstToken: () => void
    }) => Promise<{ text: string; toolCalls: { name: string; args: Record<string, unknown> }[] }>
  ) {
    const started = Date.now()
    perf.markInferenceStart()
    this.emit({ type: 'inference_started', taskRunId, provider: providerId })

    let firstToken = false
    const heartbeat = setInterval(() => {
      if (firstToken) return
      this.emit({
        type: 'task_progress',
        taskRunId,
        phase: 'thinking',
        detail: 'Waiting for model response…'
      })
    }, 3500)

    let turn: { text: string; toolCalls: { name: string; args: Record<string, unknown> }[]; stats?: unknown }
    try {
      turn = await run({
        onText: (delta) => this.emit({ type: 'text_delta', delta }),
        onFirstToken: () => {
          if (firstToken) return
          firstToken = true
          perf.markFirstToken()
          this.emit({
            type: 'task_progress',
            taskRunId,
            phase: 'streaming',
            detail: 'Receiving response…'
          })
        }
      })
    } finally {
      clearInterval(heartbeat)
    }

    if (!firstToken && (turn.text || turn.toolCalls.length > 0)) {
      perf.markFirstToken()
    }

    const durationMs = Date.now() - started
    perf.recordModelCall(durationMs, turn.toolCalls.length > 0, turn.stats as never)
    this.emit({
      type: 'inference_finished',
      taskRunId,
      durationMs,
      hadToolCalls: turn.toolCalls.length > 0
    })
    return turn
  }
}
