import type { MemoryDb } from '../memory/db'
import { isSensitiveFact, shouldForgetFromMessage } from '../memory/memory-facts'

/** Persist obvious self-disclosures from natural chat (complements /remember). */
export function extractAndStoreFacts(message: string, memory: MemoryDb): void {
  if (shouldForgetFromMessage(message)) {
    memory.forgetMatching(message)
    return
  }
  const nameMatch = message.match(/\b(?:my name is|call me|i am|i'm)\s+([A-Za-z][A-Za-z\s'-]{0,40})/i)
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/[.?,!].*$/, '').trim()
    if (name.length >= 2) {
      const fact = `User's name is ${name}`
      if (!isSensitiveFact(fact)) memory.addFact(fact)
    }
  }

  const rememberMatch = message.match(/\bremember\s+(?:that\s+)?(.+)/i)
  if (rememberMatch?.[1] && !shouldForgetFromMessage(message)) {
    const fact = rememberMatch[1].replace(/[.?!]+$/, '').trim()
    if (fact.length >= 3 && fact.length <= 200 && !isSensitiveFact(fact)) {
      memory.addFact(fact)
    }
  }
}
