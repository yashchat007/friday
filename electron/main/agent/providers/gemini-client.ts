import type { ToolDefinition } from '../../../../shared/types/tools'
import type { GeminiContent } from './gemini-types'
import type { ModelToolCall, ModelTurnResult } from './model-types'
import { DEFAULT_GEMINI_MODEL } from './gemini-types'

export { DEFAULT_GEMINI_MODEL }

function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

function parseFunctionCalls(parts: unknown[]): ModelToolCall[] {
  const calls: ModelToolCall[] = []
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    const fn = (part as { functionCall?: { name?: string; args?: unknown } }).functionCall
    if (!fn?.name) continue
    calls.push({ name: fn.name, args: normalizeArgs(fn.args) })
  }
  return calls
}

export function geminiApiKeyConfigured(apiKey: string): boolean {
  return apiKey.trim().length > 0
}

export async function runGeminiTurn(params: {
  apiKey: string
  model: string
  systemInstruction: string
  contents: GeminiContent[]
  tools: ToolDefinition[]
  onText?: (delta: string) => void
  onFirstToken?: () => void
}): Promise<ModelTurnResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(params.apiKey)}`

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: params.contents
  }

  if (params.tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }
    ]
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Gemini request failed (${response.status}): ${errBody || response.statusText}`)
  }
  if (!response.body) {
    throw new Error('Gemini returned an empty response body')
  }

  let text = ''
  let toolCalls: ModelToolCall[] = []
  let firstTokenSent = false
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const dataLine = event
        .split('\n')
        .find((line) => line.startsWith('data:'))
      if (!dataLine) continue
      const jsonText = dataLine.slice('data:'.length).trim()
      if (!jsonText || jsonText === '[DONE]') continue

      const payload = JSON.parse(jsonText) as {
        candidates?: { content?: { parts?: unknown[] } }[]
      }
      const parts = payload.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (!part || typeof part !== 'object') continue
        const maybeText = (part as { text?: string }).text
        if (maybeText) {
          text += maybeText
          if (!firstTokenSent) {
            firstTokenSent = true
            params.onFirstToken?.()
          }
          params.onText?.(maybeText)
        }
      }
      const calls = parseFunctionCalls(parts)
      if (calls.length) {
        toolCalls = calls
      }
    }
  }

  return { text, toolCalls }
}
