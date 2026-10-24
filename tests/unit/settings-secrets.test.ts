import { describe, expect, it } from 'vitest'
import { applySettingsPatch, redactSettingsForRenderer } from '../../shared/settings-secrets'
import type { FridaySettings } from '../../shared/types/ipc'

const base: FridaySettings = {
  aiProvider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  ollamaConversationModel: '',
  ollamaKeepAlive: '30m',
  ollamaChatNumPredict: 256,
  geminiApiKey: 'secret-gemini',
  geminiModel: 'gemini-2.0-flash',
  allowedPaths: [],
  playwrightHeadless: false,
  particleOverlayEnabled: false,
  floatingOrbEnabled: true,
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
  weatherApiKey: 'secret-weather',
  weatherCity: ''
}

describe('settings-secrets', () => {
  it('redacts API keys for renderer IPC', () => {
    const view = redactSettingsForRenderer(base)
    expect(view.geminiApiKey).toBe('')
    expect(view.weatherApiKey).toBe('')
    expect(view.geminiApiKeyConfigured).toBe(true)
    expect(view.weatherApiKeyConfigured).toBe(true)
    expect(view.ollamaModel).toBe('llama3.1')
  })

  it('preserves stored secrets when patch sends empty strings', () => {
    const patch = applySettingsPatch({ geminiApiKey: '', weatherApiKey: '', ollamaModel: 'x' })
    expect(patch.geminiApiKey).toBeUndefined()
    expect(patch.weatherApiKey).toBeUndefined()
    expect(patch.ollamaModel).toBe('x')
  })

  it('allows setting a new non-empty secret', () => {
    const patch = applySettingsPatch({ geminiApiKey: 'new-key' })
    expect(patch.geminiApiKey).toBe('new-key')
  })
})
