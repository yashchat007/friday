import type { BrowserWindow } from 'electron'

export const SHUTDOWN_STEPS = [
  'markShuttingDown',
  'unregisterShortcuts',
  'cancelActiveTask',
  'destroyAllWindows',
  'destroyTray',
  'closePlaywright',
  'closeMemory',
  'appExit'
] as const

export type ShutdownStep = (typeof SHUTDOWN_STEPS)[number]

/** Second and later shutdown calls must not recreate work or race window teardown. */
export function shouldRunShutdown(alreadyShuttingDown: boolean): boolean {
  return !alreadyShuttingDown
}

export function destroyBrowserWindows(windows: BrowserWindow[]): number {
  let destroyed = 0
  for (const win of windows) {
    if (win.isDestroyed()) continue
    win.removeAllListeners()
    win.destroy()
    destroyed += 1
  }
  return destroyed
}

/** Collapsed orb bounds when the chat panel is not open (avoids empty transparent regions). */
export function orbWindowShouldBeExpanded(panelExpanded: boolean, orbVisible: boolean): boolean {
  return orbVisible && panelExpanded
}

export function shouldCreateOrShowOrb(shuttingDown: boolean): boolean {
  return !shuttingDown
}

/**
 * Windows dev often emits stdin `close` before Electron is ready. Ignore until bootstrap
 * finishes so we do not set `shuttingDown` and block orb creation.
 */
export function shouldHandleDevProcessExitSignal(bootstrapComplete: boolean): boolean {
  return bootstrapComplete
}

/** Main window title-bar / close control: full quit (not hide-to-tray). */
export function resolveMainWindowCloseAction(isQuitting: boolean): 'shutdown' | 'allow-close' {
  return isQuitting ? 'allow-close' : 'shutdown'
}

export function isHideToTrayAction(action: 'hide-to-tray' | 'shutdown'): boolean {
  return action === 'hide-to-tray'
}
