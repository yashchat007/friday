import { app, BrowserWindow, ipcMain, screen, type Tray } from 'electron'
import {
  destroyBrowserWindows,
  resolveMainWindowCloseAction,
  shouldCreateOrShowOrb,
  shouldHandleDevProcessExitSignal,
  shouldRunShutdown
} from './app-lifecycle'
import { AgentService, onSettingsChanged } from './agent/agent-service'
import { PlaywrightService } from './automation/playwright-service'
import { defaultAllowedRoots } from './automation/path-policy'
import { createMemoryDb, type MemoryStore } from './memory/db'
import { getSettings, setSettings } from './settings'
import { ApprovalGate } from './tools/approval-gate'
import { ToolExecutor } from './tools/executor'
import { ToolRegistry } from './tools/registry'
import { registerAllTools } from './tools/register-all'
import { createChatWindow } from './windows'
import { createTray } from './tray'
import { checkOllamaStatus, warmOllamaModel } from './agent/providers/ollama-client'
import { resolveOllamaModel } from './agent/providers/ollama-options'
import { applySettingsPatch, redactSettingsForRenderer } from '../../shared/settings-secrets'
import type { AgentEvent, FridaySettings, SendTaskPayload } from '../../shared/types/ipc'
import { runQuickAction, type QuickActionId } from './quick-actions'
import { readSystemMetrics } from './system/system-metrics'
import {
  applyAgentEvent,
  IDLE_VISUAL,
  type FridayVisualSnapshot
} from '../../shared/agent-visual-state'
import { installMainDiagnostics, logOrb, logStartup, logStartupError } from './startup-log'
import {
  clampOrbPosition,
  createFloatingOrbWindow,
  recoverOrbPositionIfNeeded,
  resizeOrbWindow,
  resolveOrbInitialPosition
} from './orb-window'
import { terminateFridayOwnedElectronTree } from './friday-process-cleanup'
import { registerFridayGlobalShortcut, unregisterFridayGlobalShortcuts } from './global-shortcut'
import { resolveProviderCapabilities } from './agent/providers/provider-capabilities'

installMainDiagnostics()

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  chatWindow?.show()
  chatWindow?.focus()
})

let chatWindow: BrowserWindow | null = null
let orbWindow: BrowserWindow | null = null
let tray: Tray | null = null
let memory: MemoryStore | null = null
let agent: AgentService | null = null
let shuttingDown = false
let bootstrapComplete = false
const fridayElectronExecPath = process.execPath
const fridayRootPid = process.pid

const registry = new ToolRegistry()
let playwright: PlaywrightService | null = null

let visualSnapshot: FridayVisualSnapshot = IDLE_VISUAL

function isQuittingApp(): boolean {
  return shuttingDown || (app as typeof app & { isQuitting?: boolean }).isQuitting === true
}

function destroyAllFridayWindows(): number {
  const tracked = [orbWindow, chatWindow].filter(
    (w): w is BrowserWindow => Boolean(w && !w.isDestroyed())
  )
  for (const win of tracked) {
    win.removeAllListeners()
  }
  orbWindow = null
  chatWindow = null
  const remaining = BrowserWindow.getAllWindows()
  const destroyed = destroyBrowserWindows(remaining)
  logStartup('destroyAllFridayWindows', { tracked: tracked.length, destroyed })
  return destroyed
}

function ensureOrbWindow(): BrowserWindow | null {
  if (!shouldCreateOrShowOrb(shuttingDown)) {
    logOrb('ensureOrbWindow skipped (shutdown in progress)', { shuttingDown })
    return orbWindow
  }
  if (orbWindow && !orbWindow.isDestroyed()) return orbWindow
  const settings = getSettings()
  const pos = resolveOrbInitialPosition(settings.orbX, settings.orbY, false)
  logOrb('ensureOrbWindow creating', {
    floatingOrbEnabled: settings.floatingOrbEnabled,
    saved: { orbX: settings.orbX, orbY: settings.orbY },
    resolved: pos
  })
  if (pos.recovered) {
    setSettings({ orbX: pos.x, orbY: pos.y })
    logOrb('persisted recovered orb position', { x: pos.x, y: pos.y })
  }
  orbWindow = createFloatingOrbWindow({
    x: pos.x,
    y: pos.y,
    expanded: false
  })
  attachWindowDiagnostics(orbWindow, 'orb')
  orbWindow.on('moved', () => {
    if (!orbWindow || orbWindow.isDestroyed()) return
    const b = orbWindow.getBounds()
    setSettings({ orbX: b.x, orbY: b.y })
  })
  orbWindow.webContents.on('did-finish-load', () => {
    orbWindow?.webContents.send('friday:visual-state', visualSnapshot)
  })
  return orbWindow
}

function presentOrbWindow(win: BrowserWindow, focusPanel: boolean): void {
  const reveal = () => {
    if (win.isDestroyed()) return
    win.show()
    win.moveTop()
    if (focusPanel) win.focus()
    logOrb('presentOrbWindow visible', {
      focusPanel,
      bounds: win.getBounds(),
      visible: win.isVisible(),
      destroyed: win.isDestroyed()
    })
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', reveal)
  } else {
    reveal()
  }
}

function showOrb(focusPanel = false): void {
  if (!shouldCreateOrShowOrb(shuttingDown)) {
    logOrb('showOrb skipped (shutdown in progress)')
    return
  }
  const win = ensureOrbWindow()
  if (!win) return
  if (focusPanel) {
    const bounds = win.getBounds()
    resizeOrbWindow(win, true, bounds.x, bounds.y)
    setSettings({ orbPanelExpanded: true, floatingOrbEnabled: true, particleOverlayEnabled: true })
    win.webContents.send('friday:orb-panel-command', 'open')
  }
  presentOrbWindow(win, focusPanel)
  setSettings({ floatingOrbEnabled: true, particleOverlayEnabled: true })
}

function hideOrb(): void {
  if (orbWindow && !orbWindow.isDestroyed()) {
    const b = orbWindow.getBounds()
    resizeOrbWindow(orbWindow, false, b.x, b.y)
    orbWindow.webContents.send('friday:orb-panel-command', 'close')
    orbWindow.hide()
  }
  setSettings({ floatingOrbEnabled: false, particleOverlayEnabled: false, orbPanelExpanded: false })
}

function broadcast(event: AgentEvent): void {
  chatWindow?.webContents.send('friday:agent-event', event)
  orbWindow?.webContents.send('friday:agent-event', event)
  visualSnapshot = applyAgentEvent(visualSnapshot, event)
  orbWindow?.webContents.send('friday:visual-state', visualSnapshot)
  if (event.type === 'approval_required' && shouldCreateOrShowOrb(shuttingDown)) {
    showOrb(true)
    chatWindow?.show()
  }
}

export function setSpeechVisualEnergy(energy: number): void {
  visualSnapshot =
    energy > 0
      ? { state: 'speaking', energy: Math.min(1, energy), shockwaveTick: visualSnapshot.shockwaveTick }
      : { ...IDLE_VISUAL, shockwaveTick: visualSnapshot.shockwaveTick }
  orbWindow?.webContents.send('friday:visual-state', visualSnapshot)
}

const approvalGate = new ApprovalGate((request) => {
  broadcast({ type: 'approval_required', request })
})

let executor: ToolExecutor | null = null

function hideChatToTray(): void {
  chatWindow?.hide()
}

function requestMainWindowClose(): void {
  if (resolveMainWindowCloseAction(isQuittingApp()) === 'allow-close') return
  void shutdown()
}

function toggleOverlay(): void {
  const win = orbWindow && !orbWindow.isDestroyed() ? orbWindow : null
  if (win?.isVisible()) {
    hideOrb()
    return
  }
  showOrb(false)
}

function registerChatShortcut(): void {
  const accelerator = getSettings().globalShortcutChat || 'CommandOrControl+Shift+Space'
  const result = registerFridayGlobalShortcut(accelerator, () => showOrb(true))
  if (!result.ok) {
    logStartupError('global shortcut registration failed', result.error)
  }
}

async function shutdown(): Promise<void> {
  if (!shouldRunShutdown(shuttingDown)) return
  shuttingDown = true
  ;(app as typeof app & { isQuitting?: boolean }).isQuitting = true
  logStartup('shutdown begin', { bootstrapComplete })

  try {
    unregisterFridayGlobalShortcuts()
  } catch (err) {
    logStartupError('unregister shortcuts failed', err)
  }
  approvalGate.clear()
  agent?.cancelActiveTask()

  destroyAllFridayWindows()

  tray?.destroy()
  tray = null

  try {
    await playwright?.close()
  } catch (err) {
    logStartupError('playwright close failed', err)
  }
  try {
    memory?.close()
  } catch (err) {
    logStartupError('memory close failed', err)
  }

  try {
    const killed = await terminateFridayOwnedElectronTree(fridayRootPid, fridayElectronExecPath)
    logStartup('terminateFridayOwnedElectronTree', { killed, rootPid: fridayRootPid })
  } catch (err) {
    logStartupError('FRIDAY electron tree cleanup failed', err)
  }

  app.quit()
  setImmediate(() => {
    if (BrowserWindow.getAllWindows().length > 0) {
      destroyAllFridayWindows()
    }
    app.exit(0)
  })
}

function attachWindowDiagnostics(win: BrowserWindow, label: string): void {
  win.webContents.on('did-finish-load', () => {
    logStartup(`${label} did-finish-load`, win.webContents.getURL())
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logStartupError(`${label} did-fail-load`, { code, desc, url })
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    logStartupError(`${label} render-process-gone`, details)
  })
  win.on('unresponsive', () => logStartupError(`${label} unresponsive`))
}

async function bootstrap(): Promise<void> {
  if (shuttingDown) {
    logOrb('clearing spurious shuttingDown flag before bootstrap (early dev exit signal)')
    shuttingDown = false
    ;(app as typeof app & { isQuitting?: boolean }).isQuitting = false
  }
  logStartup('app.whenReady — initializing')
  const userData = app.getPath('userData')
  logStartup('userData', userData)

  memory = await createMemoryDb(userData)
  memory.beginSession()
  playwright = new PlaywrightService(userData)
  executor = new ToolExecutor(
    registry,
    approvalGate,
    broadcast,
    getSettings().allowedPaths.length ? getSettings().allowedPaths : defaultAllowedRoots(),
    userData
  )
  registerAllTools(
    registry,
    playwright,
    () => executor?.getAllowedPaths() ?? defaultAllowedRoots(),
    () => getSettings().playwrightHeadless
  )
  agent = new AgentService(registry, executor, memory, approvalGate, broadcast)

  chatWindow = createChatWindow()
  attachWindowDiagnostics(chatWindow, 'chat')

  chatWindow.on('close', (e) => {
    if (resolveMainWindowCloseAction(isQuittingApp()) === 'shutdown') {
      e.preventDefault()
      requestMainWindowClose()
    }
  })

  tray = createTray({
    chatWindow,
    onHideToTray: hideChatToTray,
    onToggleOverlay: toggleOverlay,
    onCancelTask: () => agent?.cancelActiveTask(),
    onQuit: () => {
      void shutdown()
    }
  })

  ipcMain.handle('friday:get-settings', () => redactSettingsForRenderer(getSettings()))
  ipcMain.handle('friday:set-settings', (_e, patch: Partial<FridaySettings>) => {
    const next = setSettings(applySettingsPatch(patch))
    onSettingsChanged()
    if (patch.allowedPaths && executor) {
      executor.setAllowedPaths(patch.allowedPaths)
    }
    if (patch.globalShortcutChat !== undefined) {
      unregisterFridayGlobalShortcuts()
      registerChatShortcut()
    }
    if (patch.floatingOrbEnabled === false) {
      hideOrb()
    } else if (patch.floatingOrbEnabled === true) {
      showOrb(false)
    }
    return redactSettingsForRenderer(next)
  })
  ipcMain.handle('friday:get-messages', () => memory?.recentMessages() ?? [])
  ipcMain.handle('friday:get-memories', () => memory?.listFacts() ?? [])
  ipcMain.handle('friday:update-memory', (_e, id: string, fact: string) => memory?.updateFact(id, fact) ?? false)
  ipcMain.handle('friday:delete-memory', (_e, id: string) => memory?.deleteFact(id) ?? false)
  ipcMain.handle('friday:clear-memories', () => {
    memory?.clearAllFacts()
  })
  ipcMain.handle('friday:clear-session', () => {
    memory?.clearSessionMessages()
  })
  ipcMain.handle('friday:get-system-metrics', () => readSystemMetrics())
  ipcMain.handle('friday:get-provider-capabilities', () => resolveProviderCapabilities(getSettings()))
  ipcMain.handle('friday:get-orb-state', () => ({
    panelExpanded: Boolean(getSettings().orbPanelExpanded)
  }))
  ipcMain.handle('friday:set-orb-panel-expanded', (_e, expanded: boolean) => {
    if (!shouldCreateOrShowOrb(shuttingDown)) return
    const win = ensureOrbWindow()
    if (!win) return
    const bounds = win.getBounds()
    resizeOrbWindow(win, expanded, bounds.x, bounds.y)
    setSettings({ orbPanelExpanded: expanded })
    if (!win.isVisible()) presentOrbWindow(win, false)
  })
  ipcMain.handle('friday:save-orb-position', () => {
    if (!orbWindow) return
    const b = orbWindow.getBounds()
    setSettings({ orbX: b.x, orbY: b.y })
  })
  ipcMain.handle(
    'friday:move-orb-by',
    (_e, dx: number, dy: number, cursorX?: number, cursorY?: number) => {
      if (!shouldCreateOrShowOrb(shuttingDown)) return
      if (!orbWindow || orbWindow.isDestroyed()) return
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
      const expanded = Boolean(getSettings().orbPanelExpanded)
      const b = orbWindow.getBounds()
      const cursor =
        Number.isFinite(cursorX) && Number.isFinite(cursorY)
          ? { x: cursorX as number, y: cursorY as number }
          : undefined
      const next = clampOrbPosition(b.x + Math.round(dx), b.y + Math.round(dy), expanded, cursor)
      orbWindow.setBounds({ ...b, x: next.x, y: next.y })
      setSettings({ orbX: next.x, orbY: next.y })
    }
  )
  ipcMain.handle('friday:quick-action', async (_e, id: string) => {
    if (!playwright) return { ok: false, message: 'Browser service not ready.' }
    return runQuickAction(id as QuickActionId, playwright, {
      runAutomationMessage: async (message) => {
        if (!agent) throw new Error('Agent not initialized')
        await agent.handleUserMessage({ message })
      }
    })
  })
  ipcMain.on('friday:window-minimize', () => chatWindow?.minimize())
  ipcMain.on('friday:hide-to-tray', () => hideChatToTray())
  ipcMain.on('friday:window-maximize', () => {
    if (!chatWindow) return
    if (chatWindow.isMaximized()) chatWindow.unmaximize()
    else chatWindow.maximize()
  })
  ipcMain.on('friday:window-close', () => requestMainWindowClose())
  ipcMain.handle('friday:get-ollama-status', async () => {
    const settings = getSettings()
    return checkOllamaStatus(settings.ollamaBaseUrl, settings.ollamaModel)
  })
  ipcMain.handle('friday:send-task', async (_e, payload: SendTaskPayload) => {
    if (!agent) throw new Error('Agent not initialized')
    await agent.handleUserMessage(payload)
  })
  ipcMain.handle('friday:cancel-task', () => {
    agent?.cancelActiveTask()
  })
  ipcMain.handle('friday:is-task-running', () => agent?.isRunning() ?? false)
  ipcMain.handle('friday:respond-approval', (_e, approvalId: string, approved: boolean) => {
    approvalGate.respond(approvalId, approved)
  })
  ipcMain.handle('friday:toggle-overlay', () => toggleOverlay())
  ipcMain.on('friday:speech-visual', (_e, energy: number) => {
    if (typeof energy === 'number') setSpeechVisualEnergy(energy)
  })

  const settings = getSettings()
  if (settings.aiProvider === 'ollama') {
    const model = resolveOllamaModel(settings, 'conversation')
    void warmOllamaModel(settings.ollamaBaseUrl, model, settings.ollamaKeepAlive || '30m')
  }

  registerChatShortcut()

  const orbEnabled = settings.floatingOrbEnabled !== false
  logOrb('bootstrap orb policy', {
    floatingOrbEnabled: settings.floatingOrbEnabled,
    orbEnabled,
    orbPanelExpanded: settings.orbPanelExpanded,
    shuttingDown
  })
  if (orbEnabled) {
    showOrb(false)
    if (settings.orbPanelExpanded) {
      const win = ensureOrbWindow()
      win?.webContents.once('did-finish-load', () => {
        if (!shuttingDown && orbWindow && !orbWindow.isDestroyed()) {
          showOrb(true)
        }
      })
    }
  } else {
    logOrb('orb disabled in settings — not shown at startup')
  }

  screen.on('display-removed', () => {
    if (!orbWindow || orbWindow.isDestroyed() || shuttingDown) return
    const expanded = Boolean(getSettings().orbPanelExpanded)
    const b = orbWindow.getBounds()
    const recovered = recoverOrbPositionIfNeeded(b.x, b.y, expanded)
    if (recovered.recovered) {
      resizeOrbWindow(orbWindow, expanded, recovered.x, recovered.y)
      setSettings({ orbX: recovered.x, orbY: recovered.y })
      logStartup('orb display-removed recovery', recovered)
    }
  })

  bootstrapComplete = true
  logStartup('bootstrap complete')
}

function registerProcessShutdownHooks(): void {
  const trigger = (source: string) => {
    if (!shouldHandleDevProcessExitSignal(bootstrapComplete)) {
      logStartup('dev exit signal ignored (bootstrap incomplete)', { source, bootstrapComplete })
      return
    }
    if (!shuttingDown) void shutdown()
  }
  process.once('SIGINT', () => trigger('SIGINT'))
  process.once('SIGTERM', () => trigger('SIGTERM'))
  if (!app.isPackaged) {
    process.stdin?.resume()
    process.stdin?.on('close', () => trigger('stdin-close'))
  }
}

registerProcessShutdownHooks()

logStartup('waiting for app.whenReady')
app
  .whenReady()
  .then(() => bootstrap())
  .catch((err) => logStartupError('bootstrap failed', err))

app.on('activate', () => {
  chatWindow?.show()
})

app.on('window-all-closed', () => {
  // Windows: keep running in tray when chat is hidden; orb may still be open.
})

app.on('will-quit', () => {
  unregisterFridayGlobalShortcuts()
})

app.on('before-quit', () => {
  if (!shuttingDown) {
    shuttingDown = true
    ;(app as typeof app & { isQuitting?: boolean }).isQuitting = true
    unregisterFridayGlobalShortcuts()
    destroyAllFridayWindows()
    tray?.destroy()
    tray = null
  }
})
