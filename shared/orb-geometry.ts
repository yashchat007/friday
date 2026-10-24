export type OrbRect = { x: number; y: number; width: number; height: number }
export type DisplayWorkArea = { x: number; y: number; width: number; height: number }

export type ResolvedOrbPosition = {
  x: number
  y: number
  recovered: boolean
}

export function intersectDisplayWorkAreas(a: DisplayWorkArea, b: DisplayWorkArea): DisplayWorkArea | null {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  if (x2 <= x1 || y2 <= y1) return null
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function intersectionArea(rect: OrbRect, area: DisplayWorkArea): number {
  const x1 = Math.max(rect.x, area.x)
  const y1 = Math.max(rect.y, area.y)
  const x2 = Math.min(rect.x + rect.width, area.x + area.width)
  const y2 = Math.min(rect.y + rect.height, area.y + area.height)
  if (x2 <= x1 || y2 <= y1) return 0
  return (x2 - x1) * (y2 - y1)
}

/** Entire window rect must fit inside the display work area (not a partial overlap). */
export function isRectFullyInsideWorkArea(rect: OrbRect, area: DisplayWorkArea): boolean {
  return (
    rect.x >= area.x &&
    rect.y >= area.y &&
    rect.x + rect.width <= area.x + area.width &&
    rect.y + rect.height <= area.y + area.height
  )
}

export function findWorkAreaContainingRect(
  rect: OrbRect,
  displays: DisplayWorkArea[]
): DisplayWorkArea | undefined {
  return displays.find((d) => isRectFullyInsideWorkArea(rect, d))
}

export function isOrbFullyWithinAnyWorkArea(
  x: number,
  y: number,
  width: number,
  height: number,
  displays: DisplayWorkArea[]
): boolean {
  const rect: OrbRect = { x, y, width, height }
  return findWorkAreaContainingRect(rect, displays) !== undefined
}

/** Prefer the display under the cursor while dragging; otherwise largest overlap with the window. */
export function pickDisplayForOrb(
  windowRect: OrbRect,
  displays: DisplayWorkArea[],
  cursor?: { x: number; y: number }
): DisplayWorkArea {
  if (displays.length === 0) {
    return { x: 0, y: 0, width: 1920, height: 1080 }
  }
  if (cursor) {
    for (const d of displays) {
      if (
        cursor.x >= d.x &&
        cursor.x < d.x + d.width &&
        cursor.y >= d.y &&
        cursor.y < d.y + d.height
      ) {
        return d
      }
    }
  }
  const containing = findWorkAreaContainingRect(windowRect, displays)
  if (containing) return containing

  let best = displays[0]
  let bestArea = -1
  for (const d of displays) {
    const area = intersectionArea(windowRect, d)
    if (area > bestArea) {
      bestArea = area
      best = d
    }
  }
  return best
}

export function clampRectToWorkArea(
  rect: OrbRect,
  area: DisplayWorkArea
): { x: number; y: number } {
  const maxX = area.x + area.width - rect.width
  const maxY = area.y + area.height - rect.height
  return {
    x: Math.min(Math.max(area.x, rect.x), Math.max(area.x, maxX)),
    y: Math.min(Math.max(area.y, rect.y), Math.max(area.y, maxY))
  }
}

export function clampOrbPositionWithDisplays(
  x: number,
  y: number,
  width: number,
  height: number,
  displays: DisplayWorkArea[],
  cursor?: { x: number; y: number }
): { x: number; y: number } {
  const rect: OrbRect = { x, y, width, height }
  const display = pickDisplayForOrb(rect, displays, cursor)
  return clampRectToWorkArea(rect, display)
}

/**
 * @deprecated Prefer `isOrbFullyWithinAnyWorkArea` for orb placement.
 * Partial visibility (e.g. 24px) is not enough for a draggable orb.
 */
export function isWindowVisibleOnDisplays(
  x: number,
  y: number,
  width: number,
  height: number,
  displays: DisplayWorkArea[],
  minVisiblePx = 24
): boolean {
  if (minVisiblePx >= width * height) {
    return isOrbFullyWithinAnyWorkArea(x, y, width, height, displays)
  }
  const rect: OrbRect = { x, y, width, height }
  for (const d of displays) {
    if (intersectionArea(rect, d) >= minVisiblePx) return true
  }
  return false
}

export function defaultOrbPositionOnDisplay(
  area: DisplayWorkArea,
  width: number,
  height: number,
  margin = 24
): { x: number; y: number } {
  return {
    x: area.x + area.width - width - margin,
    y: area.y + area.height - height - margin
  }
}

/** True when two work areas share an edge and overlap along that edge (no dead zone between them). */
export function workAreasShareEdge(a: DisplayWorkArea, b: DisplayWorkArea): boolean {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  const xOverlap = Math.min(ax2, bx2) - Math.max(a.x, b.x)
  const yOverlap = Math.min(ay2, by2) - Math.max(a.y, b.y)
  if (ax2 === b.x || bx2 === a.x) return yOverlap > 0
  if (ay2 === b.y || by2 === a.y) return xOverlap > 0
  return false
}

export function isSameWorkArea(a: DisplayWorkArea, b: DisplayWorkArea): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/**
 * At startup, keep orbs on secondary monitors that are edge-adjacent to the primary.
 * Positions on disjoint monitors (e.g. stacked with a gap) recover to the primary.
 */
export function applyStartupOrbDisplayPolicy(
  resolved: ResolvedOrbPosition,
  width: number,
  height: number,
  displays: DisplayWorkArea[],
  primary: DisplayWorkArea
): ResolvedOrbPosition {
  const rect: OrbRect = { x: resolved.x, y: resolved.y, width, height }
  const host = findWorkAreaContainingRect(rect, displays)

  if (!host) {
    return {
      ...defaultOrbPositionOnDisplay(primary, width, height),
      recovered: true
    }
  }

  if (isSameWorkArea(host, primary) || displays.length < 2) {
    return resolved
  }

  if (!workAreasShareEdge(primary, host)) {
    return {
      ...defaultOrbPositionOnDisplay(primary, width, height),
      recovered: true
    }
  }

  return resolved
}

export function resolveOrbPositionWithDisplays(
  x: number | undefined,
  y: number | undefined,
  width: number,
  height: number,
  displays: DisplayWorkArea[],
  primary?: DisplayWorkArea
): ResolvedOrbPosition {
  const fallbackDisplay = primary ?? displays[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }

  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      ...defaultOrbPositionOnDisplay(fallbackDisplay, width, height),
      recovered: true
    }
  }

  const rect: OrbRect = { x, y, width, height }
  const containing = findWorkAreaContainingRect(rect, displays)
  if (containing) {
    const clamped = clampRectToWorkArea(rect, containing)
    const recovered = clamped.x !== x || clamped.y !== y
    return { ...clamped, recovered }
  }

  const clamped = clampOrbPositionWithDisplays(x, y, width, height, displays)
  const clampedRect: OrbRect = { x: clamped.x, y: clamped.y, width, height }
  if (findWorkAreaContainingRect(clampedRect, displays)) {
    return {
      ...defaultOrbPositionOnDisplay(fallbackDisplay, width, height),
      recovered: true
    }
  }

  return {
    ...defaultOrbPositionOnDisplay(fallbackDisplay, width, height),
    recovered: true
  }
}
