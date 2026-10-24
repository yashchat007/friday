import { app, globalShortcut } from 'electron'

export function registerFridayGlobalShortcut(
  accelerator: string,
  onActivate: () => void
): { ok: boolean; error?: string } {
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator)
    }
    const registered = globalShortcut.register(accelerator, onActivate)
    if (!registered) {
      return { ok: false, error: `Shortcut already taken: ${accelerator}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function unregisterFridayGlobalShortcuts(): void {
  if (!app.isReady()) return
  globalShortcut.unregisterAll()
}
