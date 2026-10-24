import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { ToolCallingLoop } from '../../electron/main/agent/tool-loop'
import * as ollamaClient from '../../electron/main/agent/providers/ollama-client'
import { testOllamaProvider } from './test-ollama-provider'

describe('ToolCallingLoop (Ollama)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('continues after tool results using Ollama message history', async () => {
    const registry = new ToolRegistry()
    const gate = new ApprovalGate(() => {})
    const executor = new ToolExecutor(registry, gate, () => {}, [], '')
    const captured: { messages: unknown[] }[] = []

    vi.spyOn(ollamaClient, 'runOllamaTurn').mockImplementation(async (params) => {
      captured.push({ messages: [...params.messages] })
      if (params.messages.length === 1) {
        return {
          text: '',
          toolCalls: [{ name: 'desktop_verify_process', args: { processName: 'notepad' } }]
        }
      }
      return { text: 'Done', toolCalls: [] }
    })

    registry.register({
      definition: {
        name: 'desktop_verify_process',
        description: 'verify',
        risk: 'safe',
        parameters: { type: 'object', properties: {} }
      },
      schema: { safeParse: () => ({ success: true, data: { processName: 'notepad' } }) } as never,
      execute: async () => ({ ok: true, data: { running: false, count: 0 } })
    })

    const loop = new ToolCallingLoop(executor, () => {}, () => registry.listDefinitions())
    const task = await loop.runTask({
      userMessage: 'open notepad and write hello',
      provider: testOllamaProvider(),
      memoryFacts: [],
      intent: 'automation'
    })

    expect(captured.length).toBeGreaterThan(1)
    const second = captured[1].messages as { role: string; tool_name?: string }[]
    expect(second.some((m) => m.role === 'tool' && m.tool_name === 'desktop_verify_process')).toBe(true)
    expect(task.status).toBe('failed')
  })
})
