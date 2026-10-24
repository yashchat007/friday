import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryDb } from '../../electron/main/memory/db'

describe('createMemoryDb', () => {
  let dir: string

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `friday-mem-${Date.now()}`)
    fs.mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('migrates legacy JSON when SQLite backend is enabled', async () => {
    process.env.FRIDAY_MEMORY = 'sqlite'
    const jsonPath = path.join(dir, 'friday-memory.json')
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        messages: [{ id: 'm1', role: 'user', content: 'hello', createdAt: 1 }],
        taskRuns: [],
        userFacts: [{ fact: 'likes tea', createdAt: 2 }]
      })
    )
    const db = await createMemoryDb(dir)
    db.beginSession()
    expect(db.recentMessages(10)).toHaveLength(0)
    expect(db.recentFacts()).toContain('likes tea')
    db.close()
    expect(fs.existsSync(path.join(dir, 'friday-memory.sqlite'))).toBe(true)
    delete process.env.FRIDAY_MEMORY
  })
})
