import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { resolveOverlayDevUrl } from './orb-window'
import { overlayPreloadScriptPath, preloadScriptPath } from './paths'

export function createChatWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'FRIDAY',
    backgroundColor: '#0a0f1a',
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl).catch((err) => {
      console.error('[friday:startup] chat loadURL failed', devUrl, err)
    })
  } else {
    const file = path.join(__dirname, '../renderer/index.html')
    void win.loadFile(file).catch((err) => {
      console.error('[friday:startup] chat loadFile failed', file, err)
    })
  }

  return win
}

export function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: overlayPreloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(resolveOverlayDevUrl(process.env.ELECTRON_RENDERER_URL))
  } else {
    win.loadFile(path.join(__dirname, '../renderer/overlay.html'))
  }

  return win
}
