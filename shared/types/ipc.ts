import type { TaskRun, TaskRunMetrics, ToolRisk } from './tools'

export type AiProviderId = 'ollama' | 'gemini'

export interface FridaySettings {
  aiProvider: AiProviderId
  ollamaBaseUrl: string
  ollamaModel: string
  /** Optional faster model for chat only; empty uses ollamaModel. */
  ollamaConversationModel: string
  ollamaKeepAlive: string
  ollamaChatNumPredict: number
  geminiApiKey: string
  geminiModel: string
  allowedPaths: string[]
  playwrightHeadless: boolean
  particleOverlayEnabled: boolean
  /** Persistent floating orb (FRIDAY 2.0). */
  floatingOrbEnabled: boolean
  orbX?: number
  orbY?: number
  orbPanelExpanded?: boolean
  /** Electron accelerator string, e.g. CommandOrControl+Shift+Space */
  globalShortcutChat: string
  particleCount: number
  speechEnabled: boolean
  /** Preferred Web Speech voice name (optional). */
  speechVoiceName: string
  youtubeUrl: string
  whatsappWebUrl: string
  /** Attach to existing Chrome via localhost CDP (recommended). */
  chromeAttachEnabled: boolean
  /** When CDP is refused, launch a visible Chrome with debugging + FRIDAY profile. */
  chromeAutoLaunchDebug: boolean
  chromeExecutablePath: string
  chromeCdpUrl: string
  /** Optional display location label (no geolocation unless you set it). */
  locationLabel: string
  /** OpenWeather API key (optional) for weather in HUD. */
  weatherApiKey: string
  weatherCity: string
}

export interface OllamaStatus {
  reachable: boolean
  modelAvailable: boolean
  models: string[]
  version?: string
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

/** Long-term personal facts (persist across app restarts; not shown as chat). */
export interface UserMemoryFact {
  id: string
  fact: string
  createdAt: number
  updatedAt?: number
}

export interface ApprovalRequest {
  id: string
  taskRunId: string
  toolName: string
  risk: ToolRisk
  summary: string
  args: Record<string, unknown>
}

export type TaskProgressPhase = 'preflight' | 'thinking' | 'streaming' | 'tool'

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'task_started'; taskRun: TaskRun }
  | {
      type: 'task_progress'
      taskRunId: string
      phase: TaskProgressPhase
      detail?: string
    }
  | {
      type: 'inference_started'
      taskRunId: string
      provider: AiProviderId
    }
  | {
      type: 'inference_finished'
      taskRunId: string
      durationMs: number
      hadToolCalls: boolean
    }
  | { type: 'task_metrics'; taskRunId: string; metrics: TaskRunMetrics }
  | { type: 'step_started'; taskRunId: string; stepId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'step_finished'; taskRunId: string; stepId: string; ok: boolean; result?: unknown; error?: string }
  | { type: 'approval_required'; request: ApprovalRequest }
  | { type: 'task_finished'; taskRun: TaskRun }
  | { type: 'error'; message: string }

export interface SendTaskPayload {
  message: string
}

export interface SystemMetricsSnapshot {
  cpuPercent: number | null
  ramPercent: number | null
  ramUsedGb: number | null
  ramTotalGb: number | null
  netMbps: number | null
  unavailable?: string[]
}
