import type { FridaySettings } from '../../../../shared/types/ipc'
import type { UserIntent } from '../intent-router'

export type OllamaRequestOptions = {
  keep_alive: string
  num_predict?: number
  num_ctx?: number
}

const DEFAULT_KEEP_ALIVE = '30m'

export function resolveOllamaModel(settings: FridaySettings, intent: UserIntent): string {
  if (intent === 'conversation') {
    const chat = settings.ollamaConversationModel?.trim()
    if (chat) return chat
  }
  return settings.ollamaModel
}

export function ollamaRequestOptions(settings: FridaySettings, intent: UserIntent): OllamaRequestOptions {
  const keepAlive = settings.ollamaKeepAlive?.trim() || DEFAULT_KEEP_ALIVE
  if (intent === 'conversation') {
    const numPredict = settings.ollamaChatNumPredict ?? 256
    return { keep_alive: keepAlive, num_predict: numPredict }
  }
  return { keep_alive: keepAlive }
}
