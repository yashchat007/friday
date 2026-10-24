import { describe, expect, it } from 'vitest'
import { resolveBrowserMode } from '../../electron/main/automation/browser-mode'

describe('browser mode', () => {
  it('uses test browser when headless setting is on', () => {
    expect(resolveBrowserMode(true)).toBe('test')
    expect(resolveBrowserMode(false)).toBe('user')
  })
})
