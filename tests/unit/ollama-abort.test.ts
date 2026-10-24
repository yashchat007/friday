import { describe, expect, it } from 'vitest'
import { runOllamaTurn } from '../../electron/main/agent/providers/ollama-client'

describe('ollama abort', () => {
  it('rejects promptly when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      runOllamaTurn({
        baseUrl: 'http://127.0.0.1:1',
        model: 'test',
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
        signal: controller.signal,
        timeoutMs: 5000
      })
    ).rejects.toThrow(/cancelled/i)
  })
})
