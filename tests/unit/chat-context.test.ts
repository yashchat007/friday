import { describe, expect, it } from 'vitest'
import { selectConversationContext } from '../../electron/main/agent/chat-context'
import type { ChatMessage } from '../../shared/types/ipc'

describe('selectConversationContext', () => {
  it('skips API error junk and leaked tool JSON', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: '[GoogleGenerativeAI Error]: something failed',
        createdAt: 1
      },
      {
        id: '2',
        role: 'assistant',
        content: 'desktop_launch was successful.\n\n{"name": "desktop_type_text", "parameters": {"text": "x"}}',
        createdAt: 2
      },
      { id: '3', role: 'user', content: 'Hi', createdAt: 3 },
      { id: '4', role: 'assistant', content: 'Hello!', createdAt: 4 },
      { id: '5', role: 'user', content: 'New', createdAt: 5 }
    ]

    const ctx = selectConversationContext(messages, '5')
    expect(ctx.map((m) => m.content)).toEqual(['Hi', 'Hello!'])
  })
})
