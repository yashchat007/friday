import { randomUUID } from 'node:crypto'
import type { ApprovalGate } from './approval-gate'
import type { ToolRegistry } from './registry'
import type { AgentEvent } from '../../../shared/types/ipc'
import type { TaskRun, ToolHandlerContext, ToolRisk, ToolStep } from '../../../shared/types/tools'

const TIMEOUT_MS: Record<string, number> = {
  browser: 60_000,
  shell: 30_000,
  default: 20_000
}

function timeoutFor(toolName: string): number {
  if (toolName.startsWith('browser_')) return TIMEOUT_MS.browser
  if (toolName === 'run_powershell') return TIMEOUT_MS.shell
  return TIMEOUT_MS.default
}

export class ToolExecutor {
  constructor(
    private registry: ToolRegistry,
    private approvalGate: ApprovalGate,
    private emit: (event: AgentEvent) => void,
    private allowedPaths: string[],
    private userDataPath: string
  ) {}

  async runStep(taskRun: TaskRun, toolName: string, args: Record<string, unknown>): Promise<ToolStep> {
    const tool = this.registry.get(toolName)
    if (!tool) {
      const step: ToolStep = {
        id: randomUUID(),
        toolName,
        args,
        risk: 'safe',
        startedAt: Date.now(),
        finishedAt: Date.now(),
        ok: false,
        error: `Unknown tool: ${toolName}`
      }
      return step
    }

    const parsed = tool.schema.safeParse(args)
    if (!parsed.success) {
      return {
        id: randomUUID(),
        toolName,
        args,
        risk: tool.definition.risk,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        ok: false,
        error: parsed.error.message
      }
    }

    const step: ToolStep = {
      id: randomUUID(),
      toolName,
      args: parsed.data,
      risk: tool.definition.risk,
      startedAt: Date.now()
    }

    this.emit({
      type: 'step_started',
      taskRunId: taskRun.id,
      stepId: step.id,
      toolName,
      args: parsed.data
    })

    const needsApproval = tool.definition.risk !== 'safe'
    if (needsApproval) {
      step.approvalStatus = 'pending'
      const summary =
        toolName === 'whatsapp_send_message'
          ? `Send this message to ${String(parsed.data.contactName)}?\n\n"${String(parsed.data.message)}"`
          : `${toolName}: ${JSON.stringify(parsed.data)}`
      const approved = await this.approvalGate.request({
        taskRunId: taskRun.id,
        toolName,
        risk: tool.definition.risk,
        summary,
        args: parsed.data
      })
      step.approvalStatus = approved ? 'approved' : 'denied'
      if (!approved) {
        step.finishedAt = Date.now()
        step.ok = false
        step.error = 'User denied approval'
        this.emit({
          type: 'step_finished',
          taskRunId: taskRun.id,
          stepId: step.id,
          ok: false,
          error: step.error
        })
        return step
      }
    }

    const ctx: ToolHandlerContext = {
      taskRunId: taskRun.id,
      userDataPath: this.userDataPath
    }

    try {
      const result = await this.withTimeout(
        tool.execute(parsed.data, ctx),
        timeoutFor(toolName)
      )
      step.finishedAt = Date.now()
      step.ok = result.ok
      step.result = result.data
      step.error = result.error
      this.emit({
        type: 'step_finished',
        taskRunId: taskRun.id,
        stepId: step.id,
        ok: result.ok,
        result: result.data,
        error: result.error
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      step.finishedAt = Date.now()
      step.ok = false
      step.error = message
      this.emit({
        type: 'step_finished',
        taskRunId: taskRun.id,
        stepId: step.id,
        ok: false,
        error: message
      })
    }

    return step
  }

  setAllowedPaths(paths: string[]): void {
    this.allowedPaths = paths
  }

  getAllowedPaths(): string[] {
    return this.allowedPaths
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Tool timed out after ${ms}ms`)), ms)
      promise
        .then((v) => {
          clearTimeout(timer)
          resolve(v)
        })
        .catch((e) => {
          clearTimeout(timer)
          reject(e)
        })
    })
  }
}
