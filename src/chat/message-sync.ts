import type { ChatMessage } from '../../shared/types/ipc'

/**
 * After task_finished the renderer should reload messages from the main process
 * (single source of truth). Appending assistant text locally and then reloading
 * duplicates the same turn.
 */
export function shouldAppendAssistantOnTaskFinished(): boolean {
  return false
}

/** Detect duplicate assistant rows that share the same normalized content. */
export function findDuplicateAssistantContent(messages: ChatMessage[]): string[] {
  const seen = new Map<string, number>()
  const dupes: string[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    const key = m.content.trim()
    if (!key) continue
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    if (n === 2) dupes.push(key)
  }
  return dupes
}
