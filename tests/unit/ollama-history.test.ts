import { describe, expect, it } from 'vitest'
import { appendAssistantToolTurn, appendToolResultTurns } from '../../electron/main/agent/ollama-history'
import type { OllamaChatMessage } from '../../electron/main/agent/providers/ollama-types'

describe('Ollama history mapping', () => {
  it('stores assistant tool_calls then tool-role results', () => {
    const messages: OllamaChatMessage[] = [{ role: 'user', content: 'open notepad' }]
    appendAssistantToolTurn(messages, '', [{ name: 'desktop_launch', args: { app: 'notepad' } }])
    appendToolResultTurns(
      messages,
      [{ name: 'desktop_launch', args: { app: 'notepad' } }],
      [{ ok: true, result: { processName: 'notepad' } }]
    )

    expect(messages[1].role).toBe('assistant')
    expect(messages[1].tool_calls?.[0].function.name).toBe('desktop_launch')
    expect(messages[2].role).toBe('tool')
    expect(messages[2].tool_name).toBe('desktop_launch')
    expect(JSON.parse(messages[2].content).ok).toBe(true)
  })
})
