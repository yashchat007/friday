import { describe, expect, it } from 'vitest'
import { shouldCreateOrShowOrb } from '../../electron/main/app-lifecycle'
import { resolveOverlayDevUrl } from '../../electron/main/orb-window'

describe('orb startup policy', () => {
  it('creates orb when enabled and not shutting down', () => {
    expect(shouldCreateOrShowOrb(false)).toBe(true)
  })

  it('does not create orb during shutdown', () => {
    expect(shouldCreateOrShowOrb(true)).toBe(false)
  })

  it('resolves overlay renderer URL for electron-vite dev server', () => {
    expect(resolveOverlayDevUrl('http://localhost:5173/')).toBe('http://localhost:5173/overlay.html')
    expect(resolveOverlayDevUrl('http://localhost:5173/index.html')).toBe(
      'http://localhost:5173/overlay.html'
    )
  })
})
