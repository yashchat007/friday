import type { ChatMessage } from '../../../shared/types/ipc'

/** Detect YouTube play/search requests and extract the search query. */
export function parseYouTubePlayQuery(userMessage: string, context?: ChatMessage[]): string | null {
  const text = userMessage.trim()
  if (!/\byoutube\b/i.test(text) && !/\b(play|search)\b.*\b(song|video|music)\b/i.test(text)) {
    return null
  }
  if (!/\b(play|open|search|find)\b/i.test(text)) return null

  const quoted = text.match(/['"]([^'"]+)['"]/)
  if (quoted?.[1]) return quoted[1].trim()

  const playSong = text.match(/\bplay\s+(?:the\s+)?(?:song|video|track)\s+(.+?)(?:\s+on\b|\s+in\b|$)/i)
  if (playSong?.[1]) return playSong[1].replace(/\s+on\s+(?:my\s+)?(?:laptop|pc|computer).*$/i, '').trim()

  const playBare = text.match(/\bplay\s+(.+?)\s+on\s+(?:youtube|my\s+laptop)/i)
  if (playBare?.[1]) return playBare[1].replace(/^the\s+/i, '').trim()

  const searchFor = text.match(/\bsearch\s+(?:for\s+)?(.+?)(?:\s+on\s+youtube|\s+in\s+youtube|$)/i)
  if (searchFor?.[1]) return searchFor[1].trim()

  if (/\byoutube\b/i.test(text)) {
    const ytPlay = text.match(/\bplay\s+(.+?)(?:\s+on\s+(?:my\s+)?(?:laptop|pc|computer).*)?$/i)
    if (ytPlay?.[1]) {
      return ytPlay[1]
        .replace(/\s+on\s+(?:my\s+)?(?:laptop|pc|computer).*$/i, '')
        .replace(/^the\s+/i, '')
        .trim()
    }
  }

  if (context?.length) {
    const blob = context.slice(-6).map((m) => m.content).join('\n')
    if (/\b(youtube|youtube\.com)\b/i.test(blob)) {
      const searchFor = text.match(/\bsearch(?:\s+for)?\s+(.+)/i)
      if (searchFor?.[1]) {
        return searchFor[1].replace(/[.?!]+$/, '').trim()
      }
      const play = text.match(/\bplay\s+(?:the\s+)?(?:first|top)?\s*(?:result|video|song)?\s*(.+)?/i)
      if (play && /\b(first|result|video|song)\b/i.test(text)) {
        return play[1]?.trim() || 'top result'
      }
    }
  }

  return null
}

export function isYouTubePlayRequest(userMessage: string): boolean {
  return parseYouTubePlayQuery(userMessage) !== null
}
