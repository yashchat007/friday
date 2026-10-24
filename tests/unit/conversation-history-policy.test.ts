import { describe, expect, it } from 'vitest'
import { shouldIncludeConversationHistory } from '../../electron/main/agent/conversation-history-policy'
import { SAMPLE_USER_NAME } from '../fixtures/sample-user'

describe('shouldIncludeConversationHistory', () => {
  it('omits history for social greetings', () => {
    expect(shouldIncludeConversationHistory('Hey FRIDAY, how are you?', 'conversation')).toBe(false)
    expect(shouldIncludeConversationHistory('Hi', 'conversation')).toBe(false)
  })

  it('includes history for recall questions', () => {
    expect(
      shouldIncludeConversationHistory(`My name is ${SAMPLE_USER_NAME}. What is my name?`, 'conversation')
    ).toBe(
      true
    )
  })
})
