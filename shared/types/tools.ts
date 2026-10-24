export type ToolRisk = 'safe' | 'sensitive' | 'destructive'

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
  artifacts?: Record<string, string>
}

export interface ToolStep {
  id: string
  toolName: string
  args: Record<string, unknown>
  risk: ToolRisk
  startedAt: number
  finishedAt?: number
  ok?: boolean
  result?: unknown
  error?: string
  approvalStatus?: 'pending' | 'approved' | 'denied'
}

export type TaskRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface TaskRunMetrics {
  totalMs: number
  preflightMs?: number
  /** From task start (includes preflight). */
  timeToFirstTokenMs?: number
  /** From first model byte (excludes preflight). */
  inferenceTimeToFirstTokenMs?: number
  modelCallCount: number
  modelCallMs: number
  toolExecutionMs: number
  promptChars?: number
  promptTokens?: number
  generatedTokens?: number
  promptEvalMs?: number
  evalMs?: number
  tokensPerSecond?: number
  /** Ollama-reported prompt evaluation (ms); aligns with infer TTFT on CPU. */
  ollamaPromptEvalMs?: number
  ollamaGenerationMs?: number
  clientTimeToFirstContentMs?: number
  ollamaModel?: string
  keepAlive?: string
  numPredict?: number
  historyIncluded?: boolean
  historyMessageCount?: number
  systemChars?: number
  totalPayloadChars?: number
  modelLoadedBeforeRequest?: boolean
  usingGpu?: boolean
  modelCalls: Array<{ index: number; durationMs: number; hadToolCalls: boolean }>
  tools: Array<{ toolName: string; durationMs: number }>
}

export interface TaskRun {
  id: string
  userMessage: string
  status: TaskRunStatus
  steps: ToolStep[]
  assistantSummary?: string
  startedAt: number
  finishedAt?: number
  metrics?: TaskRunMetrics
}

export interface ToolDefinition {
  name: string
  description: string
  risk: ToolRisk
  parameters: Record<string, unknown>
}

export interface ToolHandlerContext {
  taskRunId: string
  userDataPath: string
}

export interface RegisteredTool<T extends Record<string, unknown> = Record<string, unknown>> {
  definition: ToolDefinition
  schema: import('zod').ZodType<T>
  execute: (args: T, ctx: ToolHandlerContext) => Promise<ToolResult>
}
