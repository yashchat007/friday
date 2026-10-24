import type { ToolDefinition } from '../../../../shared/types/tools'
import type { OllamaStatus } from '../../../../shared/types/ipc'
import type { ModelInferenceStats } from './model-types'
import type { OllamaChatMessage, OllamaToolCall, OllamaTurnResult } from './ollama-types'
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from './ollama-types'
import type { OllamaRequestOptions } from './ollama-options'

export { DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_BASE_URL }

function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>
  }
  return {}
}

function mergeToolCalls(existing: OllamaToolCall[], incoming: OllamaToolCall[]): OllamaToolCall[] {
  const merged = [...existing]
  for (const call of incoming) {
    const idx = merged.findIndex((c) => c.name === call.name)
    if (idx >= 0) {
      merged[idx] = { name: call.name, args: { ...merged[idx].args, ...call.args } }
    } else {
      merged.push(call)
    }
  }
  return merged
}

function nsToMs(ns?: number): number | undefined {
  if (ns === undefined || ns === null) return undefined
  return Math.round(ns / 1_000_000)
}

function statsFromPayload(payload: {
  prompt_eval_count?: number
  eval_count?: number
  prompt_eval_duration?: number
  eval_duration?: number
}): ModelInferenceStats | undefined {
  const promptTokens = payload.prompt_eval_count
  const generatedTokens = payload.eval_count
  const promptEvalMs = nsToMs(payload.prompt_eval_duration)
  const evalMs = nsToMs(payload.eval_duration)
  if (
    promptTokens === undefined &&
    generatedTokens === undefined &&
    promptEvalMs === undefined &&
    evalMs === undefined
  ) {
    return undefined
  }
  const tokensPerSecond =
    evalMs && evalMs > 0 && generatedTokens !== undefined
      ? Math.round((generatedTokens / evalMs) * 1000)
      : undefined
  return {
    promptTokens,
    generatedTokens,
    promptEvalMs,
    evalMs,
    tokensPerSecond
  }
}

export async function checkOllamaStatus(baseUrl: string, model: string): Promise<OllamaStatus> {
  try {
    const [versionRes, tagsRes] = await Promise.all([
      fetch(`${baseUrl}/api/version`, { method: 'GET' }),
      fetch(`${baseUrl}/api/tags`, { method: 'GET' })
    ])
    const versionJson = versionRes.ok
      ? (await versionRes.json()) as { version?: string }
      : undefined
    if (!tagsRes.ok) {
      return {
        reachable: false,
        modelAvailable: false,
        models: [],
        error: `Ollama returned HTTP ${tagsRes.status}. Is Ollama running at ${baseUrl}?`
      }
    }

    const tags = (await tagsRes.json()) as { models?: { name: string }[] }
    const models = (tags.models ?? []).map((m) => m.name)
    const modelAvailable = models.some(
      (name) => name === model || name.startsWith(`${model}:`) || name.split(':')[0] === model
    )

    return {
      reachable: true,
      modelAvailable,
      models,
      version: versionJson?.version,
      error: modelAvailable
        ? undefined
        : `Model "${model}" is not installed. Run: ollama pull ${model}`
    }
  } catch {
    return {
      reachable: false,
      modelAvailable: false,
      models: [],
      error: `Cannot reach Ollama at ${baseUrl}. Start the Ollama app or check the URL in Settings.`
    }
  }
}

export async function warmOllamaModel(
  baseUrl: string,
  model: string,
  keepAlive = '30m'
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: keepAlive,
        messages: [{ role: 'user', content: ' ' }],
        options: { num_predict: 1 }
      })
    })
  } catch {
    // Best-effort warmup; failures are non-fatal.
  }
}

const DEFAULT_OLLAMA_TURN_TIMEOUT_MS = 120_000
const STREAM_IDLE_TIMEOUT_MS = 45_000

function linkAbortSignal(target: AbortController, signal?: AbortSignal): void {
  if (!signal) return
  if (signal.aborted) {
    target.abort()
    return
  }
  signal.addEventListener('abort', () => target.abort(), { once: true })
}

export async function runOllamaTurn(params: {
  baseUrl: string
  model: string
  systemInstruction: string
  messages: OllamaChatMessage[]
  tools: ToolDefinition[]
  options?: OllamaRequestOptions
  requestMeta?: ModelInferenceStats
  timeoutMs?: number
  signal?: AbortSignal
  onText?: (delta: string) => void
  onFirstToken?: () => void
}): Promise<OllamaTurnResult> {
  const requestStarted = Date.now()
  const promptChars =
    params.systemInstruction.length +
    params.messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)

  const body: Record<string, unknown> = {
    model: params.model,
    stream: true,
    messages: [{ role: 'system', content: params.systemInstruction }, ...params.messages],
    keep_alive: params.options?.keep_alive ?? '30m'
  }

  if (params.options?.num_predict !== undefined || params.options?.num_ctx !== undefined) {
    body.options = {
      ...(params.options.num_predict !== undefined ? { num_predict: params.options.num_predict } : {}),
      ...(params.options.num_ctx !== undefined ? { num_ctx: params.options.num_ctx } : {})
    }
  }

  if (params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }

  const timeoutMs = params.timeoutMs ?? DEFAULT_OLLAMA_TURN_TIMEOUT_MS
  const controller = new AbortController()
  linkAbortSignal(controller, params.signal)
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${params.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (err) {
    clearTimeout(timeout)
    if (params.signal?.aborted) {
      throw new Error('Task cancelled.')
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw err
  }
  clearTimeout(timeout)

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Ollama request failed (${response.status}): ${errBody || response.statusText}`)
  }
  if (!response.body) {
    throw new Error('Ollama returned an empty response body')
  }

  let text = ''
  let toolCalls: OllamaToolCall[] = []
  let firstTokenSent = false
  let stats: ModelInferenceStats | undefined
  let firstContentAt: number | undefined
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let streamIdleTimer: ReturnType<typeof setTimeout> | undefined
  const armStreamIdle = (): void => {
    if (streamIdleTimer) clearTimeout(streamIdleTimer)
    streamIdleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS)
  }
  armStreamIdle()

  while (true) {
    if (params.signal?.aborted) {
      await reader.cancel().catch(() => {})
      throw new Error('Task cancelled.')
    }
    const { done, value } = await reader.read()
    if (done) break
    armStreamIdle()
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      const payload = JSON.parse(line) as {
        message?: {
          content?: string
          tool_calls?: {
            function?: { name?: string; arguments?: unknown }
          }[]
        }
        prompt_eval_count?: number
        eval_count?: number
        prompt_eval_duration?: number
        eval_duration?: number
        done?: boolean
      }
      const content = payload.message?.content
      if (content) {
        text += content
        if (!firstTokenSent) {
          firstTokenSent = true
          firstContentAt = Date.now()
          params.onFirstToken?.()
        }
        params.onText?.(content)
      }
      const calls = payload.message?.tool_calls ?? []
      const parsed: OllamaToolCall[] = []
      for (const call of calls) {
        const name = call.function?.name
        if (!name) continue
        parsed.push({
          name,
          args: normalizeArgs(call.function?.arguments)
        })
      }
      if (parsed.length) {
        toolCalls = mergeToolCalls(toolCalls, parsed)
      }
      if (payload.done) {
        stats = statsFromPayload(payload)
      }
    }
  }
  if (streamIdleTimer) clearTimeout(streamIdleTimer)

  const clientRequestMs = Date.now() - requestStarted
  const merged: ModelInferenceStats = {
    ...(stats ?? {}),
    ...(params.requestMeta ?? {}),
    promptChars,
    clientRequestMs,
    clientTimeToFirstContentMs: firstContentAt ? firstContentAt - requestStarted : undefined
  }

  return {
    text,
    toolCalls,
    stats: merged
  }
}
