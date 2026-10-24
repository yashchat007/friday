import { randomUUID } from 'node:crypto'

export interface UserMemoryFact {
  id: string
  fact: string
  createdAt: number
  updatedAt?: number
}

export function normalizeFactText(fact: string): string {
  return fact.replace(/\s+/g, ' ').trim()
}

export function factKey(fact: string): string {
  return normalizeFactText(fact).toLowerCase()
}

export function isSensitiveFact(fact: string): boolean {
  const t = fact.toLowerCase()
  if (/\b(ssn|social security|credit card|password|passcode|pin)\b/.test(t)) return true
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(fact)) return true
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(fact)) return true
  return false
}

export function shouldForgetFromMessage(message: string): boolean {
  return /\b(don'?t|do not|never)\s+remember\b/i.test(message) || /\bforget\s+(that|this)\b/i.test(message)
}

export function mergeFactList(
  facts: UserMemoryFact[],
  incoming: string
): { facts: UserMemoryFact[]; added: boolean } {
  const text = normalizeFactText(incoming)
  if (!text || text.length < 3 || isSensitiveFact(text)) {
    return { facts, added: false }
  }
  const key = factKey(text)
  const idx = facts.findIndex((f) => factKey(f.fact) === key)
  const now = Date.now()
  if (idx >= 0) {
    const next = [...facts]
    next[idx] = { ...next[idx], fact: text, updatedAt: now }
    return { facts: next, added: false }
  }
  return {
    facts: [...facts, { id: randomUUID(), fact: text, createdAt: now }],
    added: true
  }
}

export function migrateLegacyFacts(raw: { fact: string; createdAt: number; id?: string }[]): UserMemoryFact[] {
  const out: UserMemoryFact[] = []
  for (const row of raw ?? []) {
    const text = normalizeFactText(row.fact)
    if (!text) continue
    const key = factKey(text)
    if (out.some((f) => factKey(f.fact) === key)) continue
    out.push({
      id: row.id ?? randomUUID(),
      fact: text,
      createdAt: row.createdAt ?? Date.now()
    })
  }
  return out
}
