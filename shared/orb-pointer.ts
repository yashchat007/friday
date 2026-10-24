/** Pixels of movement before a pointer gesture counts as drag (not click). */
export const ORB_DRAG_CLICK_THRESHOLD_PX = 6

export function shouldTreatOrbGestureAsClick(totalDragPixels: number): boolean {
  return totalDragPixels < ORB_DRAG_CLICK_THRESHOLD_PX
}

export function accumulateOrbDragDistance(
  total: number,
  dx: number,
  dy: number
): number {
  return total + Math.hypot(dx, dy)
}
