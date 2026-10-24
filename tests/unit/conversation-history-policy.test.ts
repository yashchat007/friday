import { describe, expect, it } from 'vitest'
import { shouldIncludeConversationHistory } from '../../electron/main/agent/conversation-history-policy'

describe('shouldIncludeConversationHistory', () => {
  it('omits history for social greetings', () => {
    expect(shouldIncludeConversationHistory('Hey FRIDAY, how are you?', 'conversation')).toBe(false)
    expect(shouldIncludeConversationHistory('Hi', 'conversation')).toBe(false)
  })

  it('includes history for recall questions', () => {
    expect(shouldIncludeConversationHistory('My name is Yash. What is my name?', 'conversation')).toBe(
      true
    )
  })
})
