import type { FridaySettings } from '../../../../shared/types/ipc'

/** Explicit website names → HTTPS URLs only (no arbitrary user-derived hosts). */
export function knownSiteUrl(siteKey: string, settings: FridaySettings): string | null {
  const key = siteKey.trim().toLowerCase()
  const map: Record<string, string> = {
    leetcode: 'https://leetcode.com',
    github: 'https://github.com',
    google: 'https://www.google.com',
    youtube: settings.youtubeUrl?.trim() || 'https://www.youtube.com/',
    gmail: 'https://mail.google.com',
    stackoverflow: 'https://stackoverflow.com',
    'stack overflow': 'https://stackoverflow.com',
    linkedin: 'https://www.linkedin.com',
    twitter: 'https://x.com',
    x: 'https://x.com',
    reddit: 'https://www.reddit.com',
    netflix: 'https://www.netflix.com',
    chatgpt: 'https://chat.openai.com',
    openai: 'https://chat.openai.com'
  }
  return map[key] ?? null
}

export const CONFIGURED_DESKTOP_APPS = new Set([
  'whatsapp',
  'notepad',
  'calc',
  'calculator',
  'mspaint',
  'paint'
])
