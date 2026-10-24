import type {
  AgentEvent,
  ChatMessage,
  FridaySettings,
  OllamaStatus,
  SendTaskPayload,
  SystemMetricsSnapshot,
  UserMemoryFact
} from './types/ipc'

/** API exposed on `window.friday` via preload `contextBridge`. */
export interface FridayApi {
  getSettings: () => Promise<FridaySettings>
  setSettings: (patch: Partial<FridaySettings>) => Promise<FridaySettings>
  getMessages: () => Promise<ChatMessage[]>
  getMemories: () => Promise<UserMemoryFact[]>
  updateMemory: (id: string, fact: string) => Promise<boolean>
  deleteMemory: (id: string) => Promise<boolean>
  clearMemories: () => Promise<void>
  clearSession: () => Promise<void>
  getSystemMetrics: () => Promise<SystemMetricsSnapshot>
  runQuickAction: (id: string) => Promise<{
    ok: boolean
    message: string
    composerPrefill?: string
    openMore?: boolean
  }>
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  hideToTray: () => void
  getOllamaStatus: () => Promise<OllamaStatus>
  sendTask: (payload: SendTaskPayload) => Promise<void>
  respondApproval: (approvalId: string, approved: boolean) => Promise<void>
  toggleOverlay: () => Promise<void>
  getOrbState: () => Promise<{ panelExpanded: boolean }>
  setOrbPanelExpanded: (expanded: boolean) => Promise<void>
  saveOrbPosition: () => Promise<void>
  moveOrbBy: (dx: number, dy: number, cursorX?: number, cursorY?: number) => Promise<void>
  onOrbPanelCommand: (handler: (cmd: 'open' | 'close' | 'toggle') => void) => () => void
  getProviderCapabilities: () => Promise<{
    providerId: string
    textGeneration: boolean
    toolCalling: boolean
    visionImages: boolean
    visionModelId?: string
    notes?: string
  }>
  cancelTask: () => Promise<void>
  isTaskRunning: () => Promise<boolean>
  onAgentEvent: (handler: (event: AgentEvent) => void) => () => void
  setSpeechVisualEnergy: (energy: number) => void
}
