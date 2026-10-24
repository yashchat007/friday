import type { FridaySettings } from '../../../../shared/types/ipc'
import { isWhatsAppSendRequest } from '../../automation/whatsapp-intent'
import { parseYouTubePlayQuery } from '../youtube-playbook'
import { CONFIGURED_DESKTOP_APPS, knownSiteUrl } from './registry'

export type DirectAction =
  | { kind: 'open_url'; url: string; label: string }
  | { kind: 'google_search'; query: string }
  | { kind: 'launch_app'; app: string; label: string }

const COMPLEX_LLM_HINT =
  /\b(summarize|summary|explain|analyze|compare|write me|draft|research and|find .+ and)\b/i

const OPEN_VERB =
  /\b(?:open|launch|start|run|go to|take me to)\s+(?:the\s+)?(?:website\s+)?/i

export function parseGoogleSearchQuery(message: string): string | null {
  const patterns = [
    /\bsearch\s+(?:the\s+)?(?:web|google)\s+for\s+(.+)/i,
    /\bsearch\s+google\s+for\s+(.+)/i,
    /\bgoogle\s+search\s+for\s+(.+)/i
  ]
  for (const re of patterns) {
    const m = message.match(re)
    if (m?.[1]) return m[1].replace(/[.?!]+$/, '').trim()
  }
  return null
}

export function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function parseExplicitHttpsUrl(message: string): string | null {
  const m = message.match(/\b(?:open|launch|go to|visit)\s+(?:the\s+)?(https?:\/\/[^\s]+)/i)
  if (!m?.[1]) return null
  try {
    const url = new URL(m[1])
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

function parseSiteName(message: string, settings: FridaySettings): DirectAction | null {
  const t = message.trim()
  const patterns = [
    /\b(?:open|launch|start|go to|take me to)\s+(?:the\s+)?(?:website\s+)?([a-z][a-z0-9\s.-]{0,24})\s*[.!?]*$/i,
    /\b(?:open|launch|start|go to|take me to)\s+(?:the\s+)?(?:website\s+)?([a-z][a-z0-9\s.-]{0,24})\b/i
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (!m?.[1]) continue
    const name = m[1].trim().toLowerCase()
    if (CONFIGURED_DESKTOP_APPS.has(name.replace(/\s+/g, ''))) continue
    const url = knownSiteUrl(name, settings)
    if (url) {
      return { kind: 'open_url', url, label: name }
    }
  }
  return null
}

export function parseWhatsAppDesktopLaunch(message: string): DirectAction | null {
  const t = message.trim()
  if (!/\bwhatsapp\b/i.test(t)) return null
  if (!/\b(?:open|launch|start|run)\b/i.test(t)) return null
  return { kind: 'launch_app', app: 'whatsapp', label: 'WhatsApp' }
}

function parseDesktopApp(message: string): DirectAction | null {
  const m = message.match(
    /\b(?:open|launch|start|run)\s+(?:the\s+)?(?:desktop\s+)?(?:app\s+)?([a-z][a-z0-9_-]{0,24})\s*[.!?]*$/i
  )
  if (!m?.[1]) return null
  const app = m[1].trim().toLowerCase()
  if (!CONFIGURED_DESKTOP_APPS.has(app)) return null
  return { kind: 'launch_app', app, label: app }
}

/**
 * Deterministic open/search/launch commands that must not wait on the LLM.
 */
export function parseDirectAction(message: string, settings: FridaySettings): DirectAction | null {
  const t = message.trim()
  if (!t || t.length > 240) return null
  if (parseYouTubePlayQuery(t)) return null
  const whatsappDesktop = parseWhatsAppDesktopLaunch(t)
  if (whatsappDesktop) return whatsappDesktop
  if (isWhatsAppSendRequest(t)) return null
  if (COMPLEX_LLM_HINT.test(t)) return null

  const google = parseGoogleSearchQuery(t)
  if (google) {
    return { kind: 'google_search', query: google }
  }

  const https = parseExplicitHttpsUrl(t)
  if (https) {
    return { kind: 'open_url', url: https, label: https }
  }

  const app = parseDesktopApp(t)
  if (app) return app

  if (OPEN_VERB.test(t)) {
    const site = parseSiteName(t, settings)
    if (site) return site
  }

  return null
}
