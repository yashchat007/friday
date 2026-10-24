import { describe, expect, it } from 'vitest'
import { ORB_OVERLAY_TRANSPARENT_CSS, ORB_VISIBLE_DIAMETER_PX } from '../../shared/orb-overlay-styles'
import {
  ORB_COLLAPSED_SIZE,
  ORB_TRANSPARENT_WINDOW_OPTIONS
} from '../../electron/main/orb-window'

describe('orb transparency configuration', () => {
  it('matches collapsed window size to visible orb diameter', () => {
    expect(ORB_COLLAPSED_SIZE).toBe(ORB_VISIBLE_DIAMETER_PX)
  })

  it('uses frameless transparent BrowserWindow options', () => {
    expect(ORB_TRANSPARENT_WINDOW_OPTIONS.transparent).toBe(true)
    expect(ORB_TRANSPARENT_WINDOW_OPTIONS.frame).toBe(false)
    expect(ORB_TRANSPARENT_WINDOW_OPTIONS.hasShadow).toBe(false)
    expect(ORB_TRANSPARENT_WINDOW_OPTIONS.backgroundColor).toBe('#00000000')
  })

  it('documents overlay transparent root CSS', () => {
    expect(ORB_OVERLAY_TRANSPARENT_CSS).toMatch(/background:\s*transparent/)
    expect(ORB_OVERLAY_TRANSPARENT_CSS).toMatch(/orb-hit-target/)
  })
})
