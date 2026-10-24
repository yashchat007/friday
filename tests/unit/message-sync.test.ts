import { describe, expect, it } from 'vitest'
import {
  findDuplicateAssistantContent,
  shouldAppendAssistantOnTaskFinished
} from '../../src/chat/message-sync'

describe('message sync', () => {
  it('uses server reload only after task_finished (no local assistant append)', () => {
    expect(shouldAppendAssistantOnTaskFinished()).toBe(false)
  })

  it('detects duplicate assistant content from append+reload', () => {
    const dupes = findDuplicateAssistantContent([
      { id: '1', role: 'user', content: 'hi', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'Hello!', createdAt: 2 },
      { id: '3', role: 'assistant', content: 'Hello!', createdAt: 3 }
    ])
    expect(dupes).toEqual(['Hello!'])
  })
})
