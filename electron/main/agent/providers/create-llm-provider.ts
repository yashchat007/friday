import type { FridaySettings } from '../../../../shared/types/ipc'
import type { LlmProvider } from './model-types'
import { GeminiProvider } from './gemini-provider'
import { OllamaProvider } from './ollama-provider'

export function createLlmProvider(settings: FridaySettings): LlmProvider {
  if (settings.aiProvider === 'gemini') {
    return new GeminiProvider(settings)
  }
  return new OllamaProvider(settings)
}
