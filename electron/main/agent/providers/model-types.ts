import type { ToolDefinition } from '../../../../shared/types/tools'
import type { ProviderCapabilities } from './provider-capabilities'

export type AiProviderId = 'ollama' | 'gemini'

export interface ModelToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ModelInferenceStats {
  promptChars?: number
  promptTokens?: number
  generatedTokens?: number
  /** Ollama prompt_eval_duration (ms). */
  promptEvalMs?: number
  /** Ollama eval_duration (ms) — generation only. */
  evalMs?: number
  tokensPerSecond?: number
  /** Client wall time until first streamed content token (includes prompt eval). */
  clientTimeToFirstContentMs?: number
  /** Client wall time for full streamed request. */
  clientRequestMs?: number
  ollamaModel?: string
  keepAlive?: string
  numPredict?: number
  historyMessageCount?: number
  historyIncluded?: boolean
  systemChars?: number
  totalPayloadChars?: number
  modelLoadedBeforeRequest?: boolean
  usingGpu?: boolean
}

export interface ModelTurnResult {
  text: string
  toolCalls: ModelToolCall[]
  stats?: ModelInferenceStats
}

export interface ProviderReadiness {
  ready: boolean
  error?: string
  detail?: string
}

export interface ModelTurnCallbacks {
  onText?: (delta: string) => void
  onFirstToken?: () => void
}

export interface ConversationTurnInput extends ModelTurnCallbacks {
  systemInstruction: string
  /** Provider-native chat turns (no system message). */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: ToolDefinition[]
  intent?: 'conversation' | 'automation'
  historyIncluded?: boolean
  signal?: AbortSignal
}

export interface AutomationTurnInput extends ModelTurnCallbacks {
  systemInstruction: string
  tools: ToolDefinition[]
  signal?: AbortSignal
}

export interface AutomationSession {
  runTurn(input: AutomationTurnInput): Promise<ModelTurnResult>
  recordAssistantTurn(text: string, toolCalls: ModelToolCall[]): void
  recordToolResults(
    toolCalls: ModelToolCall[],
    results: Array<{ ok: boolean; result?: unknown; error?: string | null }>
  ): void
  appendUserMessage(text: string): void
}

export interface LlmProvider {
  readonly id: AiProviderId
  getCapabilities(): ProviderCapabilities
  checkReady(): Promise<ProviderReadiness>
  runConversationTurn(input: ConversationTurnInput): Promise<ModelTurnResult>
  beginAutomationSession(initialUserContent: string): AutomationSession
}
