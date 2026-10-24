import { describe, expect, it } from 'vitest'
import { DuplicateActionGuard, toolCallSignature } from '../../electron/main/agent/duplicate-action-guard'

describe('DuplicateActionGuard', () => {
  it('blocks identical tool calls after repeated attempts', () => {
    const guard = new DuplicateActionGuard(2, 8)
    const args = { path: 'C:\\test' }
    expect(guard.shouldBlock('file_read', args)).toBe(false)
    expect(guard.shouldBlock('file_read', args)).toBe(false)
    expect(guard.shouldBlock('file_read', args)).toBe(true)
  })

  it('stableStringify ignores key order', () => {
    expect(toolCallSignature('x', { a: 1, b: 2 })).toBe(toolCallSignature('x', { b: 2, a: 1 }))
  })
})
