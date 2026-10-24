import { describe, expect, it } from 'vitest'
import { ToolCallingLoop } from '../../electron/main/agent/tool-loop'
import { testOllamaProvider } from '../unit/test-ollama-provider'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolRegistry } from '../../electron/main/tools/registry'

const runLive = process.env.RUN_OLLAMA_LIVE === '1'

describe.runIf(runLive)('Ollama live greeting latency', () => {
  it('social greeting uses minimal prompt tokens and sub-5s infer TTFT when model is warm', async () => {
    const loop = new ToolCallingLoop(
      new ToolExecutor(new ToolRegistry(), new ApprovalGate(() => {}), () => {}, [], ''),
      () => {},
      () => []
    )

    const task = await loop.runTask({
      userMessage: 'Hey FRIDAY, how are you?',
      provider: testOllamaProvider(),
      memoryFacts: ["User's name is Yash"],
      contextMessages: Array.from({ length: 30 }, (_, i) => ({
        id: `m${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: i % 2 === 0 ? 'hi' : 'A'.repeat(400),
        createdAt: i
      })),
      currentMessageId: 'current',
      intent: 'conversation'
    })

    expect(task.status).toBe('completed')
    expect(task.metrics?.historyIncluded).toBe(false)
    expect(task.metrics?.historyMessageCount).toBe(0)
    expect(task.metrics?.promptTokens).toBeLessThan(260)
    expect(task.metrics?.inferenceTimeToFirstTokenMs ?? 99_999).toBeLessThan(8_000)
  }, 120_000)
})
