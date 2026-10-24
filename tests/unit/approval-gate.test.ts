import { describe, expect, it } from 'vitest'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'

describe('ApprovalGate', () => {
  it('resolves true when approved', async () => {
    let approvalId = ''
    const gate = new ApprovalGate((req) => {
      approvalId = req.id
    })
    const pending = gate.request({
      taskRunId: 't1',
      toolName: 'file_write',
      risk: 'sensitive',
      summary: 'write file',
      args: { filePath: 'x', content: 'y' }
    })
    gate.respond(approvalId, true)
    await expect(pending).resolves.toBe(true)
  })

  it('resolves false when denied', async () => {
    let approvalId = ''
    const gate = new ApprovalGate((req) => {
      approvalId = req.id
    })
    const pending = gate.request({
      taskRunId: 't1',
      toolName: 'file_delete',
      risk: 'destructive',
      summary: 'delete file',
      args: { filePath: 'x' }
    })
    gate.respond(approvalId, false)
    await expect(pending).resolves.toBe(false)
  })
})
