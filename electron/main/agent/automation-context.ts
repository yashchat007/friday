import type { ChatMessage } from '../../../shared/types/ipc'
import { isWhatsAppSendRequest } from '../automation/whatsapp-intent'
import { classifyUserIntent, type UserIntent } from './intent-router'

export type { UserIntent } from './intent-router'

const FOLLOW_UP =
  /\b(search(?:\s+for)?|play|click|open|navigate|go to|the first|first result|second result|that one|this one|continue|next)\b/i

const BROWSER_CONTEXT =
  /\b(youtube|github|google|browser|\.com|opened|navigated|playing|search results)\b/i

export function isAutomationFollowUp(message: string, context: ChatMessage[]): boolean {
  const text = message.trim()
  if (!text || context.length === 0) return false
  const recent = context.slice(-8)
  const contextBlob = recent.map((m) => m.content).join('\n')
  if (!BROWSER_CONTEXT.test(contextBlob) && !recent.some((m) => m.role === 'user' && /\b(open|launch|play)\b/i.test(m.content))) {
    return false
  }
  if (FOLLOW_UP.test(text)) return true
  if (/^(yes|yeah|yep|sure|do it|go ahead|ok)$/i.test(text)) return true
  return false
}

export function classifyUserIntentWithContext(message: string, context?: ChatMessage[]): UserIntent {
  if (isWhatsAppSendRequest(message)) return 'automation'
  const base = classifyUserIntent(message)
  if (base === 'automation') return 'automation'
  if (context && isAutomationFollowUp(message, context)) return 'automation'
  return base
}
