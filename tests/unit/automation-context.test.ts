import { describe, expect, it } from 'vitest'
import { classifyUserIntentWithContext, isAutomationFollowUp } from '../../electron/main/agent/automation-context'
import { selectConversationContext } from '../../electron/main/agent/chat-context'
import { parseYouTubePlayQuery } from '../../electron/main/agent/youtube-playbook'
import type { ChatMessage } from '../../shared/types/ipc'

describe('automation follow-up context', () => {
  it('treats YouTube search follow-up as automation', () => {
    const context: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Open YouTube.', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'Opened youtube.com in Chrome.', createdAt: 2 }
    ]
    expect(isAutomationFollowUp('Search for lo-fi music.', context)).toBe(true)
    expect(classifyUserIntentWithContext('Search for lo-fi music.', context)).toBe('automation')
  })

  it('parses search query from follow-up when YouTube was recent', () => {
    const context: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Open YouTube', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'Navigated to youtube.com', createdAt: 2 }
    ]
    expect(parseYouTubePlayQuery('Search for lo-fi music', context)).toBe('lo-fi music')
  })

  it('includes bounded prior turns for conversation', () => {
    const msgs: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? 'user' : 'assistant') as ChatMessage['role'],
      content: `message ${i}`,
      createdAt: i
    }))
    const selected = selectConversationContext(msgs, 'new')
    expect(selected.length).toBeLessThanOrEqual(6)
  })
})
