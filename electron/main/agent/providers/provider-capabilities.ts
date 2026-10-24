import type { FridaySettings } from '../../../../shared/types/ipc'
import type { AiProviderId } from './model-types'
import { DEFAULT_GEMINI_MODEL } from './gemini-types'
import { resolveOllamaModel } from './ollama-options'

export interface ProviderCapabilities {
  providerId: AiProviderId
  textGeneration: boolean
  toolCalling: boolean
  /** Whether image bytes can be sent to the configured text model. */
  visionImages: boolean
  visionModelId?: string
  notes?: string
}

const OLLAMA_VISION_NAME_HINTS = /llava|bakllava|moondream|minicpm-v|vision/i

export function resolveOllamaCapabilities(settings: FridaySettings): ProviderCapabilities {
  const model = resolveOllamaModel(settings, 'conversation')
  const visionImages = OLLAMA_VISION_NAME_HINTS.test(model)
  return {
    providerId: 'ollama',
    textGeneration: true,
    toolCalling: true,
    visionImages,
    visionModelId: visionImages ? model : undefined,
    notes: visionImages
      ? undefined
      : `Model "${model}" is treated as text-only. Use a vision-capable Ollama model (e.g. llava) for screen understanding.`
  }
}

export function resolveGeminiCapabilities(
  settings: Pick<FridaySettings, 'geminiApiKey' | 'geminiModel'>
): ProviderCapabilities {
  const model = settings.geminiModel || DEFAULT_GEMINI_MODEL
  return {
    providerId: 'gemini',
    textGeneration: true,
    toolCalling: true,
    visionImages: Boolean(settings.geminiApiKey?.trim()),
    visionModelId: settings.geminiApiKey?.trim() ? model : undefined,
    notes: settings.geminiApiKey?.trim()
      ? undefined
      : 'Gemini API key not configured; vision and text cloud calls are unavailable.'
  }
}

export function resolveProviderCapabilities(settings: FridaySettings): ProviderCapabilities {
  if (settings.aiProvider === 'gemini') return resolveGeminiCapabilities(settings)
  return resolveOllamaCapabilities(settings)
}
