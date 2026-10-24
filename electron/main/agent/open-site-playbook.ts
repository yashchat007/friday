import type { FridaySettings } from '../../../shared/types/ipc'
import { knownSiteUrl } from './direct-actions/registry'
import { buildGoogleSearchUrl, parseGoogleSearchQuery } from './direct-actions/parse'
import { parseYouTubePlayQuery } from './youtube-playbook'

export { buildGoogleSearchUrl }

export function resolveOpenSiteUrl(message: string, settings: FridaySettings): string | null {
  const t = message.trim().toLowerCase()
  if (/\bopen\s+(the\s+)?youtube\b/.test(t) || /\bgo\s+to\s+youtube\b/.test(t)) {
    return settings.youtubeUrl?.trim() || 'https://www.youtube.com/'
  }
  const site = message.match(/\bopen\s+(?:the\s+)?(?:website\s+)?(https?:\/\/[^\s]+)/i)
  if (site?.[1]) return site[1]
  const nameMatch = t.match(
    /\b(?:open|launch|go to|take me to)\s+(?:the\s+)?(?:website\s+)?([a-z][a-z0-9\s.-]{0,24})\b/
  )
  if (nameMatch?.[1]) {
    const url = knownSiteUrl(nameMatch[1], settings)
    if (url) return url
  }
  return null
}

export function parseWebSearchQuery(message: string): string | null {
  return parseGoogleSearchQuery(message)
}

export function isOpenSiteRequest(message: string, settings: FridaySettings): boolean {
  if (parseWebSearchQuery(message) !== null) return true
  const url = resolveOpenSiteUrl(message, settings)
  if (!url) return false
  if (/youtube/i.test(url) && parseYouTubePlayQuery(message) !== null) {
    return false
  }
  return true
}
