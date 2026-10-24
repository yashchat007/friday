import os from 'node:os'
import path from 'node:path'
import Store from 'electron-store'
import type { FridaySettings } from '../../shared/types/ipc'
import { defaultAllowedRoots } from './automation/path-policy'
import { DEFAULT_GEMINI_MODEL } from './agent/providers/gemini-types'
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from './agent/providers/ollama-types'

function electronStoreCwd(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (app?.getPath) {
      return app.getPath('userData')
    }
  } catch {
    // Vitest and other non-Electron imports
  }
  return path.join(os.tmpdir(), 'friday-electron-store')
}

const store = new Store<FridaySettings>({
  name: 'friday',
  cwd: electronStoreCwd(),
  defaults: {
    aiProvider: 'ollama',
    ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    geminiApiKey: '',
    geminiModel: DEFAULT_GEMINI_MODEL,
    ollamaConversationModel: '',
    ollamaKeepAlive: '30m',
    ollamaChatNumPredict: 256,
    allowedPaths: defaultAllowedRoots(),
    playwrightHeadless: false,
    particleOverlayEnabled: false,
    floatingOrbEnabled: true,
    orbPanelExpanded: false,
    globalShortcutChat: 'CommandOrControl+Shift+Space',
    particleCount: 12_000,
    speechEnabled: true,
    speechVoiceName: '',
    youtubeUrl: 'https://www.youtube.com/',
    whatsappWebUrl: 'https://web.whatsapp.com/',
    chromeAttachEnabled: true,
    chromeAutoLaunchDebug: true,
    chromeExecutablePath: '',
    chromeCdpUrl: 'http://127.0.0.1:9222',
    locationLabel: '',
    weatherApiKey: '',
    weatherCity: ''
  }
})

export function getSettings(): FridaySettings {
  return store.store
}

export function setSettings(patch: Partial<FridaySettings>): FridaySettings {
  store.set(patch)
  return store.store
}
