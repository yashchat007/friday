import type { ModelInferenceStats } from './providers/model-types'
import type { TaskRunMetrics } from '../../../shared/types/tools'
import type { ToolStep } from '../../../shared/types/tools'

export class TaskPerformanceTracker {
  private readonly startedAt = Date.now()
  private preflightFinishedAt?: number
  private inferenceStartedAt?: number
  private firstTokenAt?: number
  private finishedAt?: number
  private modelCalls: TaskRunMetrics['modelCalls'] = []
  private lastInferenceStats?: ModelInferenceStats

  markPreflightDone(): void {
    if (!this.preflightFinishedAt) {
      this.preflightFinishedAt = Date.now()
    }
  }

  markInferenceStart(): void {
    if (!this.inferenceStartedAt) {
      this.inferenceStartedAt = Date.now()
    }
  }

  markFirstToken(): void {
    if (!this.firstTokenAt) {
      this.firstTokenAt = Date.now()
    }
  }

  recordModelCall(durationMs: number, hadToolCalls: boolean, stats?: ModelInferenceStats): void {
    this.modelCalls.push({
      index: this.modelCalls.length,
      durationMs,
      hadToolCalls
    })
    if (stats) this.lastInferenceStats = stats
  }

  finish(steps: ToolStep[]): TaskRunMetrics {
    this.finishedAt = Date.now()
    const totalMs = this.finishedAt - this.startedAt
    const modelCallMs = this.modelCalls.reduce((sum, c) => sum + c.durationMs, 0)
    const toolExecutionMs = steps.reduce((sum, step) => {
      if (step.finishedAt === undefined) return sum
      return sum + (step.finishedAt - step.startedAt)
    }, 0)

    const inferenceStart = this.inferenceStartedAt ?? this.startedAt

    return {
      totalMs,
      preflightMs: this.preflightFinishedAt ? this.preflightFinishedAt - this.startedAt : undefined,
      timeToFirstTokenMs: this.firstTokenAt ? this.firstTokenAt - this.startedAt : undefined,
      inferenceTimeToFirstTokenMs: this.firstTokenAt
        ? this.firstTokenAt - inferenceStart
        : undefined,
      modelCallCount: this.modelCalls.length,
      modelCallMs,
      toolExecutionMs,
      promptChars: this.lastInferenceStats?.promptChars,
      promptTokens: this.lastInferenceStats?.promptTokens,
      generatedTokens: this.lastInferenceStats?.generatedTokens,
      promptEvalMs: this.lastInferenceStats?.promptEvalMs,
      evalMs: this.lastInferenceStats?.evalMs,
      tokensPerSecond: this.lastInferenceStats?.tokensPerSecond,
      ollamaPromptEvalMs: this.lastInferenceStats?.promptEvalMs,
      ollamaGenerationMs: this.lastInferenceStats?.evalMs,
      clientTimeToFirstContentMs: this.lastInferenceStats?.clientTimeToFirstContentMs,
      ollamaModel: this.lastInferenceStats?.ollamaModel,
      keepAlive: this.lastInferenceStats?.keepAlive,
      numPredict: this.lastInferenceStats?.numPredict,
      historyIncluded: this.lastInferenceStats?.historyIncluded,
      historyMessageCount: this.lastInferenceStats?.historyMessageCount,
      systemChars: this.lastInferenceStats?.systemChars,
      totalPayloadChars: this.lastInferenceStats?.totalPayloadChars,
      modelLoadedBeforeRequest: this.lastInferenceStats?.modelLoadedBeforeRequest,
      usingGpu: this.lastInferenceStats?.usingGpu,
      modelCalls: [...this.modelCalls],
      tools: steps
        .filter((s) => s.finishedAt !== undefined)
        .map((s) => ({
          toolName: s.toolName,
          durationMs: (s.finishedAt ?? s.startedAt) - s.startedAt
        }))
    }
  }
}
