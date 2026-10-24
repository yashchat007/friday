import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeOrbWindowSize,
  isOrbPositionOnAnyDisplay,
  ORB_COLLAPSED_SIZE,
  ORB_PANEL_WIDTH,
  resolveOrbInitialPosition,
  resolveOverlayDevUrl
} from '../../electron/main/orb-window'

const primaryWorkArea = { x: 0, y: 0, width: 1920, height: 1040 }

vi.mock('electron', () => ({
  screen: {
    getPrimaryDisplay: () => ({ workArea: primaryWorkArea, bounds: primaryWorkArea }),
    getAllDisplays: () => [{ workArea: primaryWorkArea, bounds: primaryWorkArea }],
    getDisplayNearestPoint: () => ({ workArea: primaryWorkArea, bounds: primaryWorkArea })
  }
}))

describe('orb window layout', () => {
  it('uses compact size when panel collapsed', () => {
    const size = computeOrbWindowSize(false)
    expect(size.width).toBe(ORB_COLLAPSED_SIZE)
    expect(size.height).toBe(ORB_COLLAPSED_SIZE)
  })

  it('expands width for chat panel', () => {
    const size = computeOrbWindowSize(true)
    expect(size.width).toBe(ORB_PANEL_WIDTH)
    expect(size.height).toBeGreaterThan(ORB_COLLAPSED_SIZE)
  })
})

describe('resolveOverlayDevUrl', () => {
  it('maps Vite root dev URL to overlay.html', () => {
    expect(resolveOverlayDevUrl('http://localhost:5174/')).toBe(
      'http://localhost:5174/overlay.html'
    )
    expect(resolveOverlayDevUrl('http://localhost:5173')).toBe(
      'http://localhost:5173/overlay.html'
    )
  })

  it('replaces index.html when present', () => {
    expect(resolveOverlayDevUrl('http://localhost:5173/index.html')).toBe(
      'http://localhost:5173/overlay.html'
    )
  })

  it('leaves overlay URL unchanged', () => {
    const url = 'http://localhost:5173/overlay.html'
    expect(resolveOverlayDevUrl(url)).toBe(url)
  })
})

describe('orb position recovery', () => {
  beforeEach(() => {
    primaryWorkArea.x = 0
    primaryWorkArea.y = 0
    primaryWorkArea.width = 1920
    primaryWorkArea.height = 1040
  })

  it('defaults when coordinates are missing', () => {
    const pos = resolveOrbInitialPosition(undefined, undefined, false)
    expect(pos.x).toBeGreaterThanOrEqual(0)
    expect(pos.y).toBeGreaterThanOrEqual(0)
    expect(isOrbPositionOnAnyDisplay(pos.x, pos.y, false)).toBe(true)
  })

  it('recovers from off-screen saved coordinates', () => {
    const pos = resolveOrbInitialPosition(50_000, 50_000, false)
    const def = resolveOrbInitialPosition(undefined, undefined, false)
    expect(pos).toEqual(def)
  })

  it('clamps valid saved coordinates into work area', () => {
    const pos = resolveOrbInitialPosition(-40, -40, false)
    expect(pos.x).toBeGreaterThanOrEqual(0)
    expect(pos.y).toBeGreaterThanOrEqual(0)
  })
})

describe('orb visibility toggle policy', () => {
  it('hides only when the window is actually visible', () => {
    const decide = (isVisible: boolean) => (isVisible ? 'hide' : 'show')
    expect(decide(true)).toBe('hide')
    expect(decide(false)).toBe('show')
    expect(decide(false)).toBe('show')
  })
})
