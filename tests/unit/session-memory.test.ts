import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JsonMemoryStore } from '../../electron/main/memory/json-memory'

describe('session vs persistent memory', () => {
  let dir: string

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `friday-session-${Date.now()}`)
    fs.mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('archives prior chat on beginSession but keeps facts', () => {
    const store = new JsonMemoryStore(dir)
    store.saveMessage({ id: '1', role: 'user', content: 'old chat', createdAt: 1 })
    store.addFact('User prefers dark mode')
    store.beginSession()
    expect(store.recentMessages()).toEqual([])
    expect(store.recentFacts()).toContain('User prefers dark mode')
    const archived = (store as JsonMemoryStore & { archivedSessionCount(): number }).archivedSessionCount()
    expect(archived).toBe(1)
  })

  it('simulates restart with empty visible chat and surviving facts', () => {
    const store1 = new JsonMemoryStore(dir)
    store1.saveMessage({ id: '1', role: 'user', content: 'hello', createdAt: 1 })
    store1.addFact('Project: FRIDAY UI')
    store1.close()

    const store2 = new JsonMemoryStore(dir)
    store2.beginSession()
    expect(store2.recentMessages()).toHaveLength(0)
    expect(store2.recentFacts()).toContain('Project: FRIDAY UI')
  })

  it('supports editing and deleting individual facts', () => {
    const store = new JsonMemoryStore(dir)
    store.addFact('Favorite editor: VS Code')
    const [fact] = store.listFacts()
    expect(store.updateFact(fact.id, 'Favorite editor: Cursor')).toBe(true)
    expect(store.recentFacts()[0]).toContain('Cursor')
    expect(store.deleteFact(fact.id)).toBe(true)
    expect(store.listFacts()).toHaveLength(0)
  })

  it('clearSessionMessages does not remove facts', () => {
    const store = new JsonMemoryStore(dir)
    store.saveMessage({ id: '1', role: 'user', content: 'x', createdAt: 1 })
    store.addFact('likes tea')
    store.clearSessionMessages()
    expect(store.recentMessages()).toHaveLength(0)
    expect(store.recentFacts()).toContain('likes tea')
  })
})
