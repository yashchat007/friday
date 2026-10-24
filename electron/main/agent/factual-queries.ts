/** Detect questions about calendar / schedule — no calendar integration exists in FRIDAY. */
export function isCalendarQuery(message: string): boolean {
  const t = message.trim()
  if (!t) return false
  return (
    /\b(calendar|schedule|agenda|appointment|appointments)\b/i.test(t) ||
    /\b(meeting|meetings)\b/i.test(t) ||
    /\bwhat(?:'s| is) on (?:my )?(?:plate|day)\b/i.test(t) ||
    /\bdo i have (?:a |any )?(?:meeting|appointment)\b/i.test(t) ||
    /\bwhen is my\b/i.test(t) ||
    (/\b(at|@)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(t) &&
      /\b(meeting|lunch|call|appointment)\b/i.test(t))
  )
}

/** User asks what FRIDAY remembers — answer from persisted facts only. */
export function isMemoryRecallQuery(message: string): boolean {
  const t = message.trim()
  if (!t) return false
  return (
    /\bdo you remember\b/i.test(t) ||
    /\bwhat do you (know|remember) about me\b/i.test(t) ||
    /\bwhat did i (tell|say|mention)\b/i.test(t) ||
    /\bwhat(?:'s| is) in my (?:notes|memory|personal memory)\b/i.test(t) ||
    /\brecall (?:my|the|what)\b/i.test(t) ||
    /\bremember (?:my|the) (?:note|message|fact)\b/i.test(t)
  )
}

function recallKeywords(message: string): string[] {
  const about = message.match(/\b(?:about|regarding|on)\s+(.+?)(?:\?|$)/i)
  const phrase = (about?.[1] ?? message).replace(/[.?!]+$/, '').trim()
  const tokens = phrase
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3)
  return [...new Set(tokens)].slice(0, 8)
}

export function matchFactsToQuery(message: string, facts: string[]): string[] {
  const keys = recallKeywords(message)
  if (!keys.length) return facts
  const matched = facts.filter((fact) => {
    const lower = fact.toLowerCase()
    return keys.some((k) => lower.includes(k))
  })
  return matched
}

export function buildDeterministicConversationResponse(message: string, facts: string[]): string | null {
  if (isCalendarQuery(message)) {
    return (
      "I don't have access to a calendar or scheduling app on this PC, so I can't see meetings, lunches, or appointments. " +
      "I only know what's in our current chat and personal facts you've saved in Settings. " +
      "If you want me to remember something, say it explicitly or add it under Personal Memory."
    )
  }

  if (isMemoryRecallQuery(message)) {
    const matched = matchFactsToQuery(message, facts)
    if (matched.length > 0) {
      return (
        "From your saved personal facts only (not from a calendar or external app):\n- " +
        `${matched.join('\n- ')}\n\n` +
        "I won't invent other memories or events beyond this list."
      )
    }
    if (facts.length === 0) {
      return (
        "I don't have any saved personal facts for you yet. " +
        "Tell me something to remember, use /remember …, or add facts in Settings → Personal Memory."
      )
    }
    return (
      "I don't have a saved fact that matches that question. Your stored personal facts are:\n- " +
      `${facts.join('\n- ')}\n\n` +
      "I can't confirm notes or appointments that aren't in this list."
    )
  }

  return null
}
