import { describe, expect, it } from 'vitest'
import {
  accumulateOrbDragDistance,
  ORB_DRAG_CLICK_THRESHOLD_PX,
  shouldTreatOrbGestureAsClick
} from '../../shared/orb-pointer'

describe('orb pointer gestures', () => {
  it('treats small movement as click', () => {
    expect(shouldTreatOrbGestureAsClick(0)).toBe(true)
    expect(shouldTreatOrbGestureAsClick(ORB_DRAG_CLICK_THRESHOLD_PX - 1)).toBe(true)
  })

  it('treats larger movement as drag', () => {
    expect(shouldTreatOrbGestureAsClick(ORB_DRAG_CLICK_THRESHOLD_PX)).toBe(false)
    expect(shouldTreatOrbGestureAsClick(20)).toBe(false)
  })

  it('accumulates drag distance', () => {
    const total = accumulateOrbDragDistance(0, 3, 4)
    expect(total).toBe(5)
  })
})
