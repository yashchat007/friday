import type { ChatMessage } from '../../../shared/types/ipc'

export interface ArchivedSession {
  archivedAt: number
  messages: ChatMessage[]
}

const MAX_ARCHIVE_SESSIONS = 24

/** Move current session messages into archive; keep data for debugging, not UI. */
export function archiveSessionMessages(
  messages: ChatMessage[],
  archive: ArchivedSession[]
): { session: ChatMessage[]; archive: ArchivedSession[] } {
  if (messages.length === 0) {
    return { session: [], archive }
  }
  const nextArchive = [...archive, { archivedAt: Date.now(), messages: [...messages] }]
  while (nextArchive.length > MAX_ARCHIVE_SESSIONS) {
    nextArchive.shift()
  }
  return { session: [], archive: nextArchive }
}
