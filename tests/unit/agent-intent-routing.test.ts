import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { ToolCallingLoop } from '../../electron/main/agent/tool-loop'
import * as ollamaClient from '../../electron/main/agent/providers/ollama-client'
import { CONVERSATION_SYSTEM_PROMPT, AUTOMATION_SYSTEM_PROMPT } from '../../electron/main/agent/system-prompts'
import { testOllamaProvider } from './test-ollama-provider'

describe('ToolCallingLoop intent routing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createLoop() {
    const registry = new ToolRegistry()
    const gate = new ApprovalGate(() => {})
    const executor = new ToolExecutor(registry, gate, () => {}, [], '')
    return { loop: new ToolCallingLoop(executor, () => {}, () => registry.listDefinitions()), registry, executor, gate }
  }

  it('conversation messages call Ollama without tools and do not execute tools', async () => {
    const { loop } = createLoop()
    const spy = vi.spyOn(ollamaClient, 'runOllamaTurn').mockResolvedValue({
      text: 'Hello! How can I help?',
      toolCalls: []
    })

    const task = await loop.runTask({
      userMessage: 'Hi',
      provider: testOllamaProvider(),
      memoryFacts: []
    })

    expect(task.status).toBe('completed')
    expect(task.steps).toHaveLength(0)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].tools).toEqual([])
    expect(spy.mock.calls[0][0].systemInstruction).toBe(CONVERSATION_SYSTEM_PROMPT)
  })

  it('automation requests use tools and run desktop tools when model requests them', async () => {
    const { loop, registry, gate } = createLoop()
    const execSpy = vi.spyOn(ToolExecutor.prototype, 'runStep')

    vi.spyOn(ollamaClient, 'runOllamaTurn')
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          { name: 'desktop_launch', args: { app: 'notepad' } },
          { name: 'desktop_type_text', args: { text: 'FRIDAY is working!' } }
        ]
      })
      .mockResolvedValueOnce({ text: 'Done.', toolCalls: [] })

    registry.register({
      definition: {
        name: 'desktop_launch',
        description: 'launch',
        risk: 'sensitive',
        parameters: { type: 'object', properties: {} }
      },
      schema: { safeParse: () => ({ success: true, data: { app: 'notepad' } }) } as never,
      execute: async () => ({ ok: true, data: { processName: 'notepad' } })
    })
    registry.register({
      definition: {
        name: 'desktop_type_text',
        description: 'type',
        risk: 'sensitive',
        parameters: { type: 'object', properties: {} }
      },
      schema: { safeParse: () => ({ success: true, data: { text: 'x' } }) } as never,
      execute: async () => ({ ok: true, data: { chars: 3 } })
    })
    registry.register({
      definition: {
        name: 'desktop_verify_process',
        description: 'verify',
        risk: 'safe',
        parameters: { type: 'object', properties: {} }
      },
      schema: { safeParse: () => ({ success: true, data: {} }) } as never,
      execute: async () => ({ ok: true, data: { running: true } })
    })

    const autoGate = new ApprovalGate((req) => {
      autoGate.respond(req.id, true)
    })
    const loop2 = new ToolCallingLoop(
      new ToolExecutor(registry, autoGate, () => {}, [], ''),
      () => {},
      () => registry.listDefinitions()
    )

    const task = await loop2.runTask({
      userMessage: "Open Notepad and type 'FRIDAY is working!'",
      provider: testOllamaProvider(),
      memoryFacts: []
    })

    expect(ollamaClient.runOllamaTurn).toHaveBeenCalled()
    const turnMock = vi.mocked(ollamaClient.runOllamaTurn)
    expect(turnMock.mock.calls[0][0].systemInstruction).toBe(AUTOMATION_SYSTEM_PROMPT)
    expect(turnMock.mock.calls[0][0].tools.length).toBeGreaterThan(0)
    expect(task.status).toBe('completed')
    expect(task.steps.some((s) => s.toolName === 'desktop_launch')).toBe(true)
    expect(task.steps.some((s) => s.toolName === 'desktop_type_text')).toBe(true)
    execSpy.mockRestore()
  })
})
