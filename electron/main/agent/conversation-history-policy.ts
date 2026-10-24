import { isRecallFromContext, isSocialOpener, type UserIntent } from './intent-router'

/**
 * Whether to attach prior chat turns to a conversational Ollama request.
 * Short greetings should not pull in large transcript (major CPU prompt-eval cost).
 */
export function shouldIncludeConversationHistory(userMessage: string, intent: UserIntent): boolean {
  if (intent !== 'conversation') return true
  if (isSocialOpener(userMessage)) return false
  if (isRecallFromContext(userMessage)) return true
  if (/\b(earlier|you said|before|continue|last time|what did i|as i mentioned)\b/i.test(userMessage)) {
    return true
  }
  if (userMessage.trim().length <= 100) return false
  return true
}
