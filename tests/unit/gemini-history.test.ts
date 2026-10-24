import { describe, expect, it } from 'vitest'
import { appendFunctionResponses, appendModelTurn } from '../../electron/main/agent/providers/gemini-history'
import type { GeminiContent } from '../../electron/main/agent/providers/gemini-types'

describe('gemini history', () => {
  it('stores function responses as user parts', () => {
    const contents: GeminiContent[] = []
    appendModelTurn(contents, '', [{ name: 'desktop_launch', args: { app: 'notepad' } }])
    appendFunctionResponses(
      contents,
      [{ name: 'desktop_launch', args: { app: 'notepad' } }],
      [{ ok: true, result: { processName: 'notepad' } }]
    )

    expect(contents).toHaveLength(2)
    expect(contents[1].role).toBe('user')
    expect(contents[1].parts[0]).toMatchObject({
      functionResponse: { name: 'desktop_launch' }
    })
  })
})
