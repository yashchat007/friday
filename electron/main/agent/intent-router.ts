export type UserIntent = 'conversation' | 'automation'

/** Hypothetical / instructional phrasing — explain, do not execute. */
const INSTRUCTIONAL =
  /\b(how\s+(would|do|can|should|could)\s+(i|we|you)|how\s+to|what\s+is\s+the\s+way|explain\s+how|tell\s+me\s+how)\b/i

/** Direct action verbs that imply changing the machine state. */
const ACTION_VERBS =
  /\b(open|launch|start|run|execute|play|search|create|delete|remove|move|rename|copy|write|save|type|click|press|navigate|browse|go\s+to|visit|download|upload|close|kill|quit|install|uninstall|list\s+(files|folder)|read\s+file|take\s+screenshot)\b/i

/** Short social openers with no action request. */
export function isSocialOpener(text: string): boolean {
  const t = text.trim()
  if (t.length > 80) return false
  return /^(hi|hello|hey|yo|good\s+(morning|afternoon|evening)|sup)\b/i.test(t) && !ACTION_VERBS.test(t)
}

/** Questions that seek information, not side effects (unless they also contain clear action verbs). */
function isInformationalQuestion(text: string): boolean {
  const t = text.trim()
  const hasQuestion = /\?/.test(t) || /^(what|who|when|where|why|which|how|is|are|do|does|can|could|would|tell\s+me)\b/i.test(t)
  if (!hasQuestion) return false
  if (INSTRUCTIONAL.test(t)) return true
  if (ACTION_VERBS.test(t)) return false
  return true
}

/** User shares a fact and may ask about it in the same message. */
export function isRecallFromContext(text: string): boolean {
  const t = text.trim()
  const sharesFact = /\b(my name is|call me|i am|i'm|i live in|i work at|remember that)\b/i.test(t)
  const asksBack = /\?/.test(t) || /\b(what is my|who am i|repeat|recall)\b/i.test(t)
  return sharesFact && asksBack
}

/**
 * Route user input: default to conversation unless the message clearly requests
 * an action on the computer (imperative automation), not hypotheticals.
 */
export function classifyUserIntent(message: string): UserIntent {
  const text = message.trim()
  if (!text) return 'conversation'

  if (isSocialOpener(text)) return 'conversation'
  if (INSTRUCTIONAL.test(text)) return 'conversation'
  if (isRecallFromContext(text)) return 'conversation'
  if (isInformationalQuestion(text) && !ACTION_VERBS.test(text)) return 'conversation'

  if (ACTION_VERBS.test(text)) return 'automation'

  return 'conversation'
}
