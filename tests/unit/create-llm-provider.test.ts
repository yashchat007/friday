import { describe, expect, it } from 'vitest'
import { createLlmProvider } from '../../electron/main/agent/providers/create-llm-provider'
import type { FridaySettings } from '../../shared/types/ipc'

const base: FridaySettings = {
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

describe('createLlmProvider', () => {
  it('defaults to Ollama provider', () => {
    expect(createLlmProvider(base).id).toBe('ollama')
  })

  it('returns Gemini provider when configured', () => {
    expect(createLlmProvider({ ...base, aiProvider: 'gemini' }).id).toBe('gemini')
  })
})
