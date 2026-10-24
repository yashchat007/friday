import type { UserIntent } from './intent-router'

export function buildUserTurnContent(params: {
  message: string
  chatContext?: string
  memoryFacts: string[]
  intent: UserIntent
}): string {
  const memoryBlock = params.memoryFacts.length
    ? `Known facts:\n- ${params.memoryFacts.join('\n- ')}`
    : ''
  const parts: string[] = []
  if (params.chatContext?.trim()) parts.push(params.chatContext.trim())
  if (memoryBlock) parts.push(memoryBlock)
  if (params.intent === 'automation') {
    parts.push(`Action request: ${params.message}`)
  } else {
    parts.push(params.message)
  }
  return parts.join('\n\n')
}
