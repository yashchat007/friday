import { Menu, Tray, nativeImage, BrowserWindow, app } from 'electron'
import path from 'node:path'

export function createTray(params: {
  chatWindow: BrowserWindow
  onHideToTray: () => void
  onToggleOverlay: () => void
  onCancelTask: () => void
  onQuit: () => void
}): Tray {
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  const tray = new Tray(nativeImage.createEmpty())
  try {
    tray.setImage(iconPath)
  } catch {
    // optional icon
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show FRIDAY',
      click: () => {
        params.chatWindow.show()
        params.chatWindow.focus()
      }
    },
    {
      label: 'Hide to tray',
      click: () => params.onHideToTray()
    },
    {
      label: 'Show / Hide Floating Orb',
      click: () => params.onToggleOverlay()
    },
    {
      label: 'Cancel Active Task',
      click: () => params.onCancelTask()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => params.onQuit()
    }
  ])

  tray.setToolTip('FRIDAY')
  tray.setContextMenu(menu)
  tray.on('double-click', () => {
    params.chatWindow.show()
    params.chatWindow.focus()
  })

  return tray
}
