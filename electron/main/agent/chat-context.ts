import type { ChatMessage } from '../../../shared/types/ipc'
import type { OllamaChatMessage } from './providers/ollama-types'
import { hasLeakedToolSyntax, isJunkContextMessage, sanitizeAssistantText } from './output-sanitize'

/** Tight budget: ~300–400 tokens of history on CPU; large budgets dominate prompt-eval latency. */
const DEFAULT_MAX_CONTEXT_CHARS = 1_200
const MAX_MESSAGE_CHARS = 320
const MAX_CONTEXT_TURNS = 6

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

/**
 * Select recent chat turns for the model, skipping errors and oversized junk.
 * Budget is total characters across role-tagged messages (not including the new user turn).
 */
export function selectConversationContext(
  messages: ChatMessage[],
  excludeMessageId: string,
  maxChars = DEFAULT_MAX_CONTEXT_CHARS
): ChatMessage[] {
  const selected: ChatMessage[] = []
  let used = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.id === excludeMessageId) continue
    if (m.role !== 'user' && m.role !== 'assistant') continue
    if (isJunkContextMessage(m.content)) continue

    if (m.role === 'assistant' && hasLeakedToolSyntax(m.content)) continue

    let content = m.role === 'assistant' ? sanitizeAssistantText(m.content) : m.content.trim()
    if (!content) continue

    content = truncate(content, MAX_MESSAGE_CHARS)
    const cost = content.length + 8
    if (used + cost > maxChars) break

    selected.unshift({ ...m, content })
    used += cost
    if (selected.length >= MAX_CONTEXT_TURNS) break
  }

  return selected
}

export function summarizeOllamaPayload(params: {
  model: string
  systemInstruction: string
  messages: OllamaChatMessage[]
  keepAlive: string
  numPredict?: number
  historyIncluded: boolean
}): {
  model: string
  keepAlive: string
  numPredict?: number
  historyIncluded: boolean
  systemChars: number
  historyMessageCount: number
  userMessageChars: number
  totalPayloadChars: number
} {
  const history = params.messages.slice(0, -1)
  const user = params.messages.at(-1)
  return {
    model: params.model,
    keepAlive: params.keepAlive,
    numPredict: params.numPredict,
    historyIncluded: params.historyIncluded,
    systemChars: params.systemInstruction.length,
    historyMessageCount: history.length,
    userMessageChars: user?.content.length ?? 0,
    totalPayloadChars: estimatePromptChars(params.systemInstruction, params.messages)
  }
}

export function buildOllamaConversationMessages(params: {
  context: ChatMessage[]
  userMessage: string
}): OllamaChatMessage[] {
  const out: OllamaChatMessage[] = []
  for (const m of params.context) {
    out.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })
  }
  out.push({ role: 'user', content: params.userMessage })
  return out
}

export function estimatePromptChars(systemInstruction: string, messages: OllamaChatMessage[]): number {
  return systemInstruction.length + messages.reduce((sum, m) => sum + m.content.length + 16, 0)
}
