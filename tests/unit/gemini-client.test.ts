import { afterEach, describe, expect, it, vi } from 'vitest'
import { runGeminiTurn } from '../../electron/main/agent/providers/gemini-client'

describe('runGeminiTurn', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses streamed text and function calls', async () => {
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"desktop_launch","args":{"app":"notepad"}}}]}}]}',
      '',
      'data: {"candidates":[{"content":{"parts":[{"text":"Done."}]}}]}',
      ''
    ].join('\n\n')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: {
          getReader: () => {
            const encoder = new TextEncoder()
            const chunk = encoder.encode(sse)
            let sent = false
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined }
                sent = true
                return { done: false, value: chunk }
              }
            }
          }
        }
      }))
    )

    const result = await runGeminiTurn({
      apiKey: 'test-key',
      model: 'gemini-2.0-flash',
      systemInstruction: 'test',
      contents: [{ role: 'user', parts: [{ text: 'open notepad' }] }],
      tools: []
    })

    expect(result.toolCalls).toEqual([{ name: 'desktop_launch', args: { app: 'notepad' } }])
    expect(result.text).toBe('Done.')
  })
})
