import { describe, expect, it, vi } from 'vitest'
import * as ollamaClient from '../../electron/main/agent/providers/ollama-client'
import { parseDirectAction, buildGoogleSearchUrl } from '../../electron/main/agent/direct-actions/parse'
import { executeDirectAction } from '../../electron/main/agent/direct-actions/execute'
import type { FridaySettings } from '../../shared/types/ipc'
import type { ToolExecutor } from '../../electron/main/tools/executor'
import type { TaskRun } from '../../shared/types/tools'

const settings = {
  youtubeUrl: 'https://www.youtube.com/',
  whatsappWebUrl: 'https://web.whatsapp.com/'
} as FridaySettings

describe('direct actions', () => {
  it('parses Open LeetCode without LLM keywords', () => {
    const action = parseDirectAction('open leetcode', settings)
    expect(action).toEqual({ kind: 'open_url', url: 'https://leetcode.com', label: 'leetcode' })
  })

  it('parses Google search', () => {
    const action = parseDirectAction('Search Google for binary search tutorials', settings)
    expect(action?.kind).toBe('google_search')
    if (action?.kind === 'google_search') {
      expect(buildGoogleSearchUrl(action.query)).toContain(encodeURIComponent('binary search tutorials'))
    }
  })

  it('routes WhatsApp to desktop launch', () => {
    const action = parseDirectAction('Open WhatsApp', settings)
    expect(action).toEqual({ kind: 'launch_app', app: 'whatsapp', label: 'WhatsApp' })
  })

  it('routes open whatsapp with send wording to desktop launch (not web CDP)', () => {
    const action = parseDirectAction('open whatsapp and send Me a message "hi"', settings)
    expect(action).toEqual({ kind: 'launch_app', app: 'whatsapp', label: 'WhatsApp' })
  })

  it('skips explain requests for LLM', () => {
    expect(parseDirectAction('Explain binary search', settings)).toBeNull()
  })

  it('returns null for unknown apps', () => {
    expect(parseDirectAction('open foobarapp', settings)).toBeNull()
  })

  it('executes open_url via browser_navigate', async () => {
    const runStep = vi.fn().mockResolvedValue({
      ok: true,
      result: { url: 'https://leetcode.com', title: 'LeetCode', verified: true }
    })
    const executor = { runStep } as unknown as ToolExecutor
    const taskRun: TaskRun = {
      id: 't1',
      userMessage: 'open leetcode',
      status: 'running',
      steps: [],
      startedAt: Date.now()
    }
    const result = await executeDirectAction(executor, taskRun, {
      kind: 'open_url',
      url: 'https://leetcode.com',
      label: 'leetcode'
    })
    expect(result.ok).toBe(true)
    expect(runStep).toHaveBeenCalledWith(taskRun, 'browser_navigate', { url: 'https://leetcode.com' })
  })

  it('does not call Ollama for direct routing (agent uses parse only)', () => {
    const spy = vi.spyOn(ollamaClient, 'runOllamaTurn')
    parseDirectAction('open leetcode', settings)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
