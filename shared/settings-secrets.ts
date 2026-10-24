import type { FridaySettings } from './types/ipc'

export type FridaySettingsSecretsMeta = {
  /** True when a Gemini key is stored locally; value is never sent to the renderer. */
  geminiApiKeyConfigured: boolean
  /** True when a weather API key is stored locally; value is never sent to the renderer. */
  weatherApiKeyConfigured: boolean
}

export type FridaySettingsForRenderer = FridaySettings & FridaySettingsSecretsMeta

export function redactSettingsForRenderer(settings: FridaySettings): FridaySettingsForRenderer {
  return {
    ...settings,
    geminiApiKey: '',
    weatherApiKey: '',
    geminiApiKeyConfigured: Boolean(settings.geminiApiKey?.trim()),
    weatherApiKeyConfigured: Boolean(settings.weatherApiKey?.trim())
  }
}

/** Drop empty secret fields so a masked settings save does not wipe stored keys. */
export function applySettingsPatch(
  patch: Partial<FridaySettings>
): Partial<FridaySettings> {
  const next = { ...patch }
  if (next.geminiApiKey !== undefined && !next.geminiApiKey.trim()) {
    delete next.geminiApiKey
  }
  if (next.weatherApiKey !== undefined && !next.weatherApiKey.trim()) {
    delete next.weatherApiKey
  }
  return next
}
