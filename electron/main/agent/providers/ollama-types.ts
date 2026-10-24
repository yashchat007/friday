export const DEFAULT_OLLAMA_MODEL = 'llama3.1'
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

export interface OllamaToolCall {
  name: string
  args: Record<string, unknown>
}

import type { ModelInferenceStats } from './model-types'

export interface OllamaTurnResult {
  text: string
  toolCalls: OllamaToolCall[]
  stats?: ModelInferenceStats
}

/** Ollama /api/chat message (multi-turn tool calling). */
export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    type: 'function'
    function: {
      name: string
      arguments: Record<string, unknown>
    }
  }>
  /** Required on tool-role messages for Ollama tool results. */
  tool_name?: string
}
