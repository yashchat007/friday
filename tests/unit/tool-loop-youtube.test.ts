import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { ToolCallingLoop } from '../../electron/main/agent/tool-loop'
import * as ollamaClient from '../../electron/main/agent/providers/ollama-client'
import { testOllamaProvider } from './test-ollama-provider'

describe('ToolCallingLoop YouTube playbook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('completes YouTube request via playbook without calling Ollama', async () => {
    const registry = new ToolRegistry()
    const gate = new ApprovalGate((req) => {
      gate.respond(req.id, true)
    })
    const executor = new ToolExecutor(registry, gate, () => {}, [], '')
    const ollamaSpy = vi.spyOn(ollamaClient, 'runOllamaTurn')

    registry.register({
      definition: {
        name: 'browser_youtube_search_play',
        description: 'youtube',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query']
        }
      },
      schema: { safeParse: () => ({ success: true, data: { query: 'Desi Boys' } }) } as never,
      execute: async () => ({
        ok: true,
        data: {
          url: 'https://www.youtube.com/watch?v=test',
          videoId: 'test',
          playing: true,
          query: 'Desi Boys',
          selectedTitle: 'Desi Boys Official'
        }
      })
    })

    const loop = new ToolCallingLoop(executor, () => {}, () => registry.listDefinitions())
    const task = await loop.runTask({
      userMessage: "Open YouTube and play the song 'Desi Boys' on my laptop.",
      provider: testOllamaProvider(),
      memoryFacts: [],
      intent: 'automation'
    })

    expect(ollamaSpy).not.toHaveBeenCalled()
    expect(task.status).toBe('completed')
    expect(task.steps.some((s) => s.toolName === 'browser_youtube_search_play' && s.ok)).toBe(true)
    expect(task.assistantSummary).toMatch(/Desi Boys/i)
  })
})
