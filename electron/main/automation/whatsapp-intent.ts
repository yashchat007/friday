export interface WhatsAppSendIntent {
  contactName: string
  rawMessage: string
}

/** Parse "Message Rahul that I'll be 20 minutes late" style requests. */
export function parseWhatsAppSendIntent(text: string): WhatsAppSendIntent | null {
  const t = text.trim()
  const patterns = [
    /\bmessage\s+([A-Za-z][A-Za-z0-9\s'.-]{0,40}?)\s+(?:that|to say|saying)\s+(.+)/i,
    /\btell\s+([A-Za-z][A-Za-z0-9\s'.-]{0,40}?)\s+(?:that\s+)?(.+)/i,
    /\btext\s+([A-Za-z][A-Za-z0-9\s'.-]{0,40}?)\s+(?:that\s+)?(.+)/i
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1] && m?.[2]) {
      const contact = m[1].trim().replace(/\s+/g, ' ')
      const raw = m[2].trim().replace(/[.?!]+$/, '').trim()
      if (contact.length >= 2 && raw.length >= 2) {
        return { contactName: contact, rawMessage: raw }
      }
    }
  }
  return null
}

/** WhatsApp Web automation (Chrome/CDP) — not desktop launch. */
export function isWhatsAppWebSendRequest(text: string): boolean {
  return parseWhatsAppSendIntent(text) !== null
}

/** @deprecated Use isWhatsAppWebSendRequest for browser send playbooks. */
export function isWhatsAppSendRequest(text: string): boolean {
  return isWhatsAppWebSendRequest(text)
}
