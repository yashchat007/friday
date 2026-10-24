import { describe, expect, it } from 'vitest'
import { formatRecentChatContext } from '../../electron/main/agent/task-run-context'

describe('formatRecentChatContext', () => {
  it('formats recent messages for the agent', () => {
    const text = formatRecentChatContext([
      { id: '1', role: 'user', content: 'hello', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'hi', createdAt: 2 }
    ])
    expect(text).toContain('user: hello')
    expect(text).toContain('assistant: hi')
  })
})
