import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveUserPath } from '../../electron/main/automation/path-policy'

describe('resolveUserPath', () => {
  it('allows paths under allowed roots', () => {
    const home = os.homedir()
    const docs = path.join(home, 'Documents')
    const resolved = resolveUserPath(docs, [home])
    expect(resolved).toBe(path.resolve(docs))
  })

  it('blocks paths outside allowed roots', () => {
    expect(() => resolveUserPath('C:\\Windows\\System32', [os.homedir()])).toThrow(/not allowed/i)
  })
})
