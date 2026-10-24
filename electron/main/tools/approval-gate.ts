import { randomUUID } from 'node:crypto'
import type { ApprovalRequest } from '../../../shared/types/ipc'
import type { ToolRisk } from '../../../shared/types/tools'

type ApprovalResolver = (approved: boolean) => void

export class ApprovalGate {
  private pending = new Map<string, ApprovalResolver>()
  private emit: (req: ApprovalRequest) => void

  constructor(emit: (req: ApprovalRequest) => void) {
    this.emit = emit
  }

  async request(params: {
    taskRunId: string
    toolName: string
    risk: ToolRisk
    summary: string
    args: Record<string, unknown>
  }): Promise<boolean> {
    const id = randomUUID()
    const request: ApprovalRequest = {
      id,
      taskRunId: params.taskRunId,
      toolName: params.toolName,
      risk: params.risk,
      summary: params.summary,
      args: params.args
    }

    return new Promise<boolean>((resolve) => {
      this.pending.set(id, resolve)
      this.emit(request)
    })
  }

  respond(approvalId: string, approved: boolean): void {
    const resolver = this.pending.get(approvalId)
    if (!resolver) return
    this.pending.delete(approvalId)
    resolver(approved)
  }

  clear(): void {
    for (const resolver of this.pending.values()) {
      resolver(false)
    }
    this.pending.clear()
  }
}
