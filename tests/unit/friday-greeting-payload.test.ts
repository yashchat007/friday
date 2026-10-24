import { describe, expect, it } from 'vitest'
import { buildOllamaConversationMessages } from '../../electron/main/agent/chat-context'
import { shouldIncludeConversationHistory } from '../../electron/main/agent/conversation-history-policy'
import { conversationSystemWithFacts } from '../../electron/main/agent/system-prompts'
import { estimatePromptChars } from '../../electron/main/agent/chat-context'
import { SAMPLE_USER_FACT } from '../fixtures/sample-user'

describe('FRIDAY greeting Ollama payload', () => {
  it('sends only the user turn for social greetings (matches benchmark-minimal path)', () => {
    const greeting = 'Hey FRIDAY, how are you?'
    expect(shouldIncludeConversationHistory(greeting, 'conversation')).toBe(false)

    const messages = buildOllamaConversationMessages({ context: [], userMessage: greeting })
    expect(messages).toEqual([{ role: 'user', content: greeting }])

    const system = conversationSystemWithFacts([SAMPLE_USER_FACT])
    const chars = estimatePromptChars(system, messages)
    expect(chars).toBeLessThan(1100)
  })
})
