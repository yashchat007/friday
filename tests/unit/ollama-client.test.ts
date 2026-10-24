import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkOllamaStatus, runOllamaTurn } from '../../electron/main/agent/providers/ollama-client'

describe('Ollama client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checkOllamaStatus detects installed model tags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/version')) {
          return { ok: true, json: async () => ({ version: '0.5.0' }) }
        }
        return {
          ok: true,
          json: async () => ({ models: [{ name: 'llama3.1:latest' }] })
        }
      })
    )

    const status = await checkOllamaStatus('http://localhost:11434', 'llama3.1')
    expect(status.reachable).toBe(true)
    expect(status.modelAvailable).toBe(true)
    expect(status.version).toBe('0.5.0')
  })

  it('runOllamaTurn parses streamed tool_calls', async () => {
    const chunks = [
      JSON.stringify({
        message: {
          tool_calls: [{ function: { name: 'desktop_type_text', arguments: { text: 'hi' } } }]
        }
      }),
      JSON.stringify({ message: { content: '' }, done: true })
    ]
    const encoder = new TextEncoder()
    let i = 0
    const body = {
      getReader: () => ({
        read: async () => {
          if (i >= chunks.length) return { done: true, value: undefined }
          const value = encoder.encode(`${chunks[i++]}\n`)
          return { done: false, value }
        }
      })
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body
      }))
    )

    const result = await runOllamaTurn({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      systemInstruction: 'test',
      messages: [{ role: 'user', content: 'type hi' }],
      tools: [],
      options: { keep_alive: '30m', num_predict: 256 }
    })

    expect(result.toolCalls).toEqual([{ name: 'desktop_type_text', args: { text: 'hi' } }])
    const fetchMock = vi.mocked(fetch)
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(requestBody.keep_alive).toBe('30m')
    expect(requestBody.options.num_predict).toBe(256)
  })
})
