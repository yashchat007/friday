import { OllamaProvider } from '../../electron/main/agent/providers/ollama-provider'
import type { FridaySettings } from '../../shared/types/ipc'

const baseSettings: FridaySettings = {
  aiProvider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  ollamaConversationModel: '',
  ollamaKeepAlive: '30m',
  ollamaChatNumPredict: 256,
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  allowedPaths: [],
  playwrightHeadless: false,
  particleOverlayEnabled: false,
  floatingOrbEnabled: true,
  globalShortcutChat: 'CommandOrControl+Shift+Space',
  particleCount: 12_000,
  speechEnabled: true,
  speechVoiceName: '',
  youtubeUrl: '',
  whatsappWebUrl: '',
  chromeAttachEnabled: false,
  chromeAutoLaunchDebug: false,
  chromeExecutablePath: '',
  chromeCdpUrl: '',
  locationLabel: '',
  weatherApiKey: '',
  weatherCity: ''
}

export function testOllamaProvider(overrides: Partial<FridaySettings> = {}) {
  return new OllamaProvider({ ...baseSettings, ...overrides })
}
