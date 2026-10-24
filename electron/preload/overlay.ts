import { contextBridge, ipcRenderer } from 'electron'
import type { FridayVisualSnapshot } from '../../shared/agent-visual-state'

contextBridge.exposeInMainWorld('fridayOverlay', {
  onVisualState: (handler: (snapshot: FridayVisualSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: FridayVisualSnapshot) => handler(snapshot)
    ipcRenderer.on('friday:visual-state', listener)
    return () => ipcRenderer.removeListener('friday:visual-state', listener)
  }
})
