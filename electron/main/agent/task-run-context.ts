import type { ChatMessage } from '../../../shared/types/ipc'

export function formatRecentChatContext(messages: ChatMessage[], limit = 8): string {
  const recent = messages.slice(-limit)
  if (!recent.length) return ''
  const lines = recent.map((m) => `${m.role}: ${m.content}`)
  return `Recent conversation:\n${lines.join('\n')}\n\n`
}
