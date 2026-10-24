import { describe, expect, it } from 'vitest'
import {
  applyStartupOrbDisplayPolicy,
  clampOrbPositionWithDisplays,
  defaultOrbPositionOnDisplay,
  isOrbFullyWithinAnyWorkArea,
  pickDisplayForOrb,
  resolveOrbPositionWithDisplays,
  workAreasShareEdge,
  type DisplayWorkArea
} from '../../shared/orb-geometry'

const laptop: DisplayWorkArea = { x: 0, y: 0, width: 1920, height: 1080 }
const extendedLeft: DisplayWorkArea = { x: -1920, y: 0, width: 1920, height: 1080 }
const displays = [laptop, extendedLeft]

/** User-reported Windows layout (stacked extended above laptop with a vertical gap). */
const USER_PRIMARY: DisplayWorkArea = { x: 0, y: 0, width: 1280, height: 752 }
const USER_SECONDARY: DisplayWorkArea = { x: -1596, y: -1080, width: 1920, height: 1032 }
const USER_DISPLAYS = [USER_PRIMARY, USER_SECONDARY]

describe('orb geometry multi-monitor', () => {
  const orbW = 96
  const orbH = 96

  it('clamps on displays with negative coordinates', () => {
    const pos = clampOrbPositionWithDisplays(-1950, 40, orbW, orbH, displays)
    expect(pos.x).toBeGreaterThanOrEqual(extendedLeft.x)
    expect(pos.x + orbW).toBeLessThanOrEqual(extendedLeft.x + extendedLeft.width)
  })

  it('follows cursor onto laptop display while dragging', () => {
    const cursor = { x: 100, y: 400 }
    const pos = clampOrbPositionWithDisplays(-100, 400, orbW, orbH, displays, cursor)
    expect(pos.x).toBeGreaterThanOrEqual(laptop.x)
    expect(pos.x + orbW).toBeLessThanOrEqual(laptop.x + laptop.width)
  })

  it('picks display under cursor', () => {
    const d = pickDisplayForOrb({ x: -500, y: 100, width: orbW, height: orbH }, displays, {
      x: 50,
      y: 200
    })
    expect(d).toEqual(laptop)
  })

  it('recovers saved position when extended monitor is gone', () => {
    const saved = { x: -1800, y: 900 }
    const pos = resolveOrbPositionWithDisplays(saved.x, saved.y, orbW, orbH, [laptop], laptop)
    expect(pos.recovered).toBe(true)
    expect(isOrbFullyWithinAnyWorkArea(pos.x, pos.y, orbW, orbH, [laptop])).toBe(true)
    expect(pos.x).toBeGreaterThanOrEqual(0)
  })

  it('defaults to bottom-right of primary display', () => {
    const pos = defaultOrbPositionOnDisplay(laptop, orbW, orbH)
    expect(pos.x).toBe(laptop.x + laptop.width - orbW - 24)
    expect(pos.y).toBe(laptop.y + laptop.height - orbH - 24)
  })

  it('requires the full orb window inside a work area (not a 24px sliver)', () => {
    const straddle = resolveOrbPositionWithDisplays(-776, -40, orbW, orbH, USER_DISPLAYS, USER_PRIMARY)
    expect(straddle.recovered).toBe(true)
    expect(isOrbFullyWithinAnyWorkArea(straddle.x, straddle.y, orbW, orbH, USER_DISPLAYS)).toBe(true)
    expect(straddle.x).toBeGreaterThanOrEqual(USER_PRIMARY.x)
  })

  it('user report: recovers -776,-885 to primary when stacked extended has a gap above laptop', () => {
    expect(workAreasShareEdge(USER_PRIMARY, USER_SECONDARY)).toBe(false)
    const base = resolveOrbPositionWithDisplays(-776, -885, orbW, orbH, USER_DISPLAYS, USER_PRIMARY)
    const pos = applyStartupOrbDisplayPolicy(base, orbW, orbH, USER_DISPLAYS, USER_PRIMARY)
    expect(pos.recovered).toBe(true)
    expect(pos.x).toBe(USER_PRIMARY.x + USER_PRIMARY.width - orbW - 24)
    expect(pos.y).toBe(USER_PRIMARY.y + USER_PRIMARY.height - orbH - 24)
    expect(isOrbFullyWithinAnyWorkArea(pos.x, pos.y, orbW, orbH, [USER_PRIMARY])).toBe(true)
  })

  it('preserves valid coords on edge-adjacent extended-left monitor', () => {
    expect(workAreasShareEdge(laptop, extendedLeft)).toBe(true)
    const base = resolveOrbPositionWithDisplays(-1800, 400, orbW, orbH, displays, laptop)
    const pos = applyStartupOrbDisplayPolicy(base, orbW, orbH, displays, laptop)
    expect(pos.recovered).toBe(false)
    expect(pos.x).toBe(-1800)
    expect(pos.y).toBe(400)
  })

  it('recovers when extended display is disconnected', () => {
    const pos = resolveOrbPositionWithDisplays(-776, -885, orbW, orbH, [USER_PRIMARY], USER_PRIMARY)
    expect(pos.recovered).toBe(true)
    expect(pos.x).toBe(USER_PRIMARY.x + USER_PRIMARY.width - orbW - 24)
    expect(pos.y).toBe(USER_PRIMARY.y + USER_PRIMARY.height - orbH - 24)
  })
})
