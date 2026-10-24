/** Refine user wording for WhatsApp without inventing facts. */
export function refineWhatsAppMessage(raw: string): string {
  let t = raw.trim()
  t = t.replace(/^that\s+/i, '')
  t = t.replace(/^to\s+say\s+/i, '')
  t = t.replace(/\s+/g, ' ')
  if (!t) return t
  const first = t.charAt(0).toUpperCase() + t.slice(1)
  if (!/[.!?]$/.test(first)) return `${first}.`
  return first
}

export function contactNamesMatch(expected: string, headerTitle: string): boolean {
  const a = expected.toLowerCase().replace(/\s+/g, ' ').trim()
  const b = headerTitle.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!a || !b) return false
  if (b === a || b.startsWith(a) || a.startsWith(b)) return true
  const aParts = a.split(' ')
  const bParts = b.split(' ')
  return aParts.every((p) => bParts.some((q) => q === p || q.startsWith(p)))
}
