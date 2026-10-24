/** Remove leaked tool-call JSON / pseudo tool syntax from model text shown to the user. */
export function sanitizeAssistantText(text: string): string {
  let out = text.trim()
  if (!out) return out

  // Strip trailing JSON tool-call blobs models sometimes emit as plain text.
  out = out.replace(/\s*\{[\s\S]*"name"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:[\s\S]*\}\s*$/m, '').trim()
  out = out.replace(/\s*\{"name"\s*:\s*"desktop_[^"]+"[\s\S]*\}\s*$/m, '').trim()

  // Collapse multiple blank lines after stripping.
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

export function isJunkContextMessage(content: string): boolean {
  const c = content.trim()
  if (!c) return true
  if (c.includes('[GoogleGenerativeAI Error]')) return true
  if (c.includes('functionCalls is not a function')) return true
  if (c.startsWith('Error:')) return true
  if (c.includes('Role \'function\' is not supported')) return true
  if (c.includes('thought_signature')) return true
  return false
}

export function hasLeakedToolSyntax(content: string): boolean {
  return /\{"name"\s*:\s*"(desktop_|file_|browser_|run_)/.test(content)
}
