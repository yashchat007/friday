import type { ModelToolCall } from './model-types'
import type { GeminiContent, GeminiPart } from './gemini-types'

export function appendUserText(contents: GeminiContent[], text: string): void {
  contents.push({ role: 'user', parts: [{ text }] })
}

export function appendModelTurn(
  contents: GeminiContent[],
  text: string,
  toolCalls: ModelToolCall[]
): void {
  const parts: GeminiPart[] = []
  if (text.trim()) parts.push({ text })
  for (const call of toolCalls) {
    parts.push({ functionCall: { name: call.name, args: call.args } })
  }
  if (!parts.length) parts.push({ text: '' })
  contents.push({ role: 'model', parts })
}

export function appendFunctionResponses(
  contents: GeminiContent[],
  toolCalls: ModelToolCall[],
  results: Array<{ ok: boolean; result?: unknown; error?: string | null }>
): void {
  const parts: GeminiPart[] = []
  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i]
    const payload = results[i] ?? { ok: false, error: 'missing result' }
    parts.push({
      functionResponse: {
        name: call.name,
        response: {
          ok: payload.ok,
          result: payload.result ?? null,
          error: payload.error ?? null
        }
      }
    })
  }
  contents.push({ role: 'user', parts })
}
