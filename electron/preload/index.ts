import { contextBridge, ipcRenderer } from 'electron'
import type { FridayApi } from '../../shared/friday-api'
import type { AgentEvent } from '../../shared/types/ipc'

const fridayApi: FridayApi = {
  getSettings: () => ipcRenderer.invoke('friday:get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('friday:set-settings', patch),
  getMessages: () => ipcRenderer.invoke('friday:get-messages'),
  getMemories: () => ipcRenderer.invoke('friday:get-memories'),
  updateMemory: (id: string, fact: string) => ipcRenderer.invoke('friday:update-memory', id, fact),
  deleteMemory: (id: string) => ipcRenderer.invoke('friday:delete-memory', id),
  clearMemories: () => ipcRenderer.invoke('friday:clear-memories'),
  clearSession: () => ipcRenderer.invoke('friday:clear-session'),
  getSystemMetrics: () => ipcRenderer.invoke('friday:get-system-metrics'),
  runQuickAction: (id: string) => ipcRenderer.invoke('friday:quick-action', id),
  windowMinimize: () => ipcRenderer.send('friday:window-minimize'),
  windowMaximize: () => ipcRenderer.send('friday:window-maximize'),
  windowClose: () => ipcRenderer.send('friday:window-close'),
  hideToTray: () => ipcRenderer.send('friday:hide-to-tray'),
  getOllamaStatus: () => ipcRenderer.invoke('friday:get-ollama-status'),
  sendTask: (payload) => ipcRenderer.invoke('friday:send-task', payload),
  respondApproval: (approvalId: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke('friday:respond-approval', approvalId, approved),
  toggleOverlay: (): Promise<void> => ipcRenderer.invoke('friday:toggle-overlay'),
  getOrbState: (): Promise<{ panelExpanded: boolean }> => ipcRenderer.invoke('friday:get-orb-state'),
  setOrbPanelExpanded: (expanded: boolean): Promise<void> =>
    ipcRenderer.invoke('friday:set-orb-panel-expanded', expanded),
  saveOrbPosition: (): Promise<void> => ipcRenderer.invoke('friday:save-orb-position'),
  moveOrbBy: (dx: number, dy: number, cursorX?: number, cursorY?: number): Promise<void> =>
    ipcRenderer.invoke('friday:move-orb-by', dx, dy, cursorX, cursorY),
  onOrbPanelCommand: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, cmd: 'open' | 'close' | 'toggle') => handler(cmd)
    ipcRenderer.on('friday:orb-panel-command', listener)
    return () => ipcRenderer.removeListener('friday:orb-panel-command', listener)
  },
  getProviderCapabilities: () => ipcRenderer.invoke('friday:get-provider-capabilities'),
  cancelTask: (): Promise<void> => ipcRenderer.invoke('friday:cancel-task'),
  isTaskRunning: (): Promise<boolean> => ipcRenderer.invoke('friday:is-task-running'),
  onAgentEvent: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, event: AgentEvent) => handler(event)
    ipcRenderer.on('friday:agent-event', listener)
    return () => ipcRenderer.removeListener('friday:agent-event', listener)
  },
  setSpeechVisualEnergy: (energy: number): void => {
    ipcRenderer.send('friday:speech-visual', energy)
  }
}

contextBridge.exposeInMainWorld('friday', fridayApi)
