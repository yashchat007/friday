import { describe, expect, it } from 'vitest'
import {
  resolveGeminiCapabilities,
  resolveOllamaCapabilities
} from '../../electron/main/agent/providers/provider-capabilities'

describe('provider capabilities', () => {
  it('treats default Ollama model as text-only', () => {
    const caps = resolveOllamaCapabilities({
      aiProvider: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.1',
      ollamaConversationModel: '',
      ollamaKeepAlive: '30m',
      ollamaChatNumPredict: 256,
      geminiApiKey: '',
      geminiModel: '',
      allowedPaths: [],
      playwrightHeadless: false,
      particleOverlayEnabled: false,
      floatingOrbEnabled: true,
      globalShortcutChat: '',
      particleCount: 12_000,
      speechEnabled: false,
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
    })
    expect(caps.visionImages).toBe(false)
    expect(caps.toolCalling).toBe(true)
  })

  it('detects llava as vision-capable on Ollama', () => {
    const caps = resolveOllamaCapabilities({
      aiProvider: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llava:13b',
      ollamaConversationModel: '',
      ollamaKeepAlive: '30m',
      ollamaChatNumPredict: 256,
      geminiApiKey: '',
      geminiModel: '',
      allowedPaths: [],
      playwrightHeadless: false,
      particleOverlayEnabled: false,
      floatingOrbEnabled: true,
      globalShortcutChat: '',
      particleCount: 12_000,
      speechEnabled: false,
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
    })
    expect(caps.visionImages).toBe(true)
  })

  it('requires Gemini API key for cloud vision', () => {
    expect(resolveGeminiCapabilities({ geminiApiKey: '', geminiModel: 'gemini-2.0-flash' }).visionImages).toBe(
      false
    )
    expect(
      resolveGeminiCapabilities({ geminiApiKey: 'key', geminiModel: 'gemini-2.0-flash' }).visionImages
    ).toBe(true)
  })
})
