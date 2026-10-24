import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import {
  applyStartupOrbDisplayPolicy,
  clampOrbPositionWithDisplays,
  defaultOrbPositionOnDisplay,
  intersectDisplayWorkAreas,
  isOrbFullyWithinAnyWorkArea,
  resolveOrbPositionWithDisplays,
  type DisplayWorkArea,
  type ResolvedOrbPosition
} from '../../shared/orb-geometry'
import { mainDir, preloadScriptPath } from './paths'
import { logOrb, logOrbError } from './startup-log'

/** Collapsed orb BrowserWindow size (matches visible 96px sphere + ring). */
export const ORB_COLLAPSED_SIZE = 96

export const ORB_TRANSPARENT_WINDOW_OPTIONS = {
  frame: false,
  transparent: true,
  resizable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  hasShadow: false,
  backgroundColor: '#00000000' as const
}
export const ORB_PANEL_WIDTH = 380
export const ORB_PANEL_HEIGHT = 400

/** Usable desktop region: intersection of monitor bounds and OS work area (taskbar, etc.). */
export function listDisplayWorkAreas(): DisplayWorkArea[] {
  const areas: DisplayWorkArea[] = []
  for (const d of screen.getAllDisplays()) {
    const bounds = { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height }
    const work = { x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height }
    const effective = intersectDisplayWorkAreas(bounds, work) ?? work
    areas.push(effective)
  }
  return areas
}

export function primaryDisplayWorkArea(): DisplayWorkArea {
  return { ...screen.getPrimaryDisplay().workArea }
}

/** Dev server URL for the overlay entry (Vite serves `/overlay.html`, not only `index.html` swap). */
export function resolveOverlayDevUrl(rendererDevUrl: string): string {
  const trimmed = rendererDevUrl.trim()
  if (trimmed.includes('overlay.html')) return trimmed
  if (/index\.html(?=[$?#]|$)/i.test(trimmed)) {
    return trimmed.replace(/index\.html/i, 'overlay.html')
  }
  const base = trimmed.replace(/\/$/, '')
  return `${base}/overlay.html`
}

export function computeOrbWindowSize(expanded: boolean): { width: number; height: number } {
  if (!expanded) {
    return { width: ORB_COLLAPSED_SIZE, height: ORB_COLLAPSED_SIZE }
  }
  return {
    width: ORB_PANEL_WIDTH,
    height: ORB_COLLAPSED_SIZE + ORB_PANEL_HEIGHT + 8
  }
}

export function defaultOrbPosition(): { x: number; y: number } {
  const { width, height } = computeOrbWindowSize(false)
  return defaultOrbPositionOnDisplay(primaryDisplayWorkArea(), width, height)
}

export function isOrbPositionOnAnyDisplay(
  x: number,
  y: number,
  expanded: boolean
): boolean {
  const { width, height } = computeOrbWindowSize(expanded)
  return isOrbFullyWithinAnyWorkArea(x, y, width, height, listDisplayWorkAreas())
}

export function clampOrbPosition(
  x: number,
  y: number,
  expanded: boolean,
  cursor?: { x: number; y: number }
): { x: number; y: number } {
  const { width, height } = computeOrbWindowSize(expanded)
  return clampOrbPositionWithDisplays(x, y, width, height, listDisplayWorkAreas(), cursor)
}

/** Restore saved coords when valid; otherwise default bottom-right of primary display. */
export function resolveOrbInitialPosition(
  x: number | undefined,
  y: number | undefined,
  expanded: boolean
): ResolvedOrbPosition {
  const { width, height } = computeOrbWindowSize(expanded)
  const displays = listDisplayWorkAreas()
  const primary = primaryDisplayWorkArea()
  const resolved = resolveOrbPositionWithDisplays(x, y, width, height, displays, primary)
  const withPolicy = applyStartupOrbDisplayPolicy(resolved, width, height, displays, primary)
  logOrb('resolveOrbInitialPosition', {
    saved: { x, y },
    resolved: withPolicy,
    displayCount: displays.length,
    displays: displays.map((d) => ({ x: d.x, y: d.y, w: d.width, h: d.height }))
  })
  return withPolicy
}

export function loadOrbRenderer(win: BrowserWindow): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    const overlayUrl = resolveOverlayDevUrl(devUrl)
    void win.loadURL(overlayUrl)
    return overlayUrl
  }
  const file = path.join(mainDir, '../renderer/overlay.html')
  void win.loadFile(file)
  return file
}

export function createFloatingOrbWindow(params: {
  x?: number
  y?: number
  expanded?: boolean
}): BrowserWindow {
  const expanded = params.expanded ?? false
  const displays = listDisplayWorkAreas()
  const pos = resolveOrbInitialPosition(params.x, params.y, expanded)
  const size = computeOrbWindowSize(expanded)
  logOrb('createFloatingOrbWindow', {
    expanded,
    bounds: { x: pos.x, y: pos.y, width: size.width, height: size.height },
    displayCount: displays.length,
    displays: displays.map((d) => ({ x: d.x, y: d.y, w: d.width, h: d.height }))
  })

  const win = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
    ...ORB_TRANSPARENT_WINDOW_OPTIONS,
    movable: false,
    show: false,
    focusable: true,
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  win.setBackgroundColor('#00000000')
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const target = loadOrbRenderer(win)
  logOrb('loadOrbRenderer', { target })

  let loadRecoveryAttempted = false
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logOrbError('did-fail-load', { code, desc, url, target })
    if (loadRecoveryAttempted || win.isDestroyed()) return
    loadRecoveryAttempted = true
    const fallback = defaultOrbPosition()
    logOrb('recovering from load failure — reset position and retry', fallback)
    win.setBounds({ ...win.getBounds(), x: fallback.x, y: fallback.y })
    try {
      loadOrbRenderer(win)
    } catch (err) {
      logOrbError('load retry failed', err)
    }
  })

  win.once('ready-to-show', () => {
    logOrb('ready-to-show', {
      destroyed: win.isDestroyed(),
      visible: win.isVisible(),
      bounds: win.getBounds()
    })
  })

  return win
}

export function resizeOrbWindow(win: BrowserWindow, expanded: boolean, x: number, y: number): void {
  const prev = win.getBounds()
  const wasExpanded = prev.height > ORB_COLLAPSED_SIZE + 24
  const size = computeOrbWindowSize(expanded)
  let ny = y
  if (expanded && !wasExpanded) {
    ny = y - (size.height - prev.height)
  } else if (!expanded && wasExpanded) {
    ny = y + (prev.height - size.height)
  }
  const clamped = clampOrbPosition(x, ny, expanded)
  if (!isOrbPositionOnAnyDisplay(clamped.x, clamped.y, expanded)) {
    const fallback = defaultOrbPosition()
    clamped.x = fallback.x
    clamped.y = fallback.y
  }
  win.setBounds({
    x: clamped.x,
    y: clamped.y,
    width: size.width,
    height: size.height
  })
}

/** Re-clamp orb when displays change (e.g. monitor disconnected). */
export function recoverOrbPositionIfNeeded(
  x: number,
  y: number,
  expanded: boolean
): ResolvedOrbPosition {
  const { width, height } = computeOrbWindowSize(expanded)
  const displays = listDisplayWorkAreas()
  const primary = primaryDisplayWorkArea()
  return resolveOrbPositionWithDisplays(x, y, width, height, displays, primary)
}
