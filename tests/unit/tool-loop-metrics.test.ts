import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { ToolCallingLoop } from '../../electron/main/agent/tool-loop'
import * as ollamaClient from '../../electron/main/agent/providers/ollama-client'
import { testOllamaProvider } from './test-ollama-provider'

describe('ToolCallingLoop metrics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('attaches performance metrics to completed conversation tasks', async () => {
    vi.spyOn(ollamaClient, 'runOllamaTurn').mockImplementation(async (params) => {
      params.onFirstToken?.()
      params.onText?.('Hi')
      return { text: 'Hi there!', toolCalls: [] }
    })

    const events: string[] = []
    const loop = new ToolCallingLoop(
      new ToolExecutor(new ToolRegistry(), new ApprovalGate(() => {}), () => {}, [], ''),
      (event) => {
        events.push(event.type)
      },
      () => []
    )

    const task = await loop.runTask({
      userMessage: 'Hello',
      provider: testOllamaProvider(),
      memoryFacts: []
    })

    expect(task.metrics?.modelCallCount).toBe(1)
    expect(task.metrics?.timeToFirstTokenMs).toBeDefined()
    expect(events).toContain('inference_started')
    expect(events).toContain('task_metrics')
  })
})
