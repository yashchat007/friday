import type { OllamaChatMessage, OllamaToolCall } from './providers/ollama-types'

export function appendAssistantToolTurn(
  messages: OllamaChatMessage[],
  text: string,
  toolCalls: OllamaToolCall[]
): void {
  messages.push({
    role: 'assistant',
    content: text || '',
    tool_calls: toolCalls.map((call) => ({
      type: 'function',
      function: {
        name: call.name,
        arguments: call.args
      }
    }))
  })
}

export function appendToolResultTurns(
  messages: OllamaChatMessage[],
  toolCalls: OllamaToolCall[],
  results: Array<{ ok: boolean; result?: unknown; error?: string | null }>
): void {
  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i]
    const payload = results[i] ?? { ok: false, error: 'missing result' }
    messages.push({
      role: 'tool',
      tool_name: call.name,
      content: JSON.stringify({
        ok: payload.ok,
        result: payload.result ?? null,
        error: payload.error ?? null
      })
    })
  }
}
