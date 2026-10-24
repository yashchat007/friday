import { describe, expect, it } from 'vitest'
import { sanitizeAssistantText } from '../../electron/main/agent/output-sanitize'

describe('sanitizeAssistantText', () => {
  it('removes trailing tool JSON from assistant text', () => {
    const raw =
      'Notepad has been launched.\n\n{"name": "desktop_type_text", "parameters": {"text": "FRIDAY is working!"}}'
    expect(sanitizeAssistantText(raw)).toBe('Notepad has been launched.')
  })
})
