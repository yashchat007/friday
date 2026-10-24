import { describe, expect, it } from 'vitest'
import { JsonMemoryStore } from '../../electron/main/memory/json-memory'
import { extractAndStoreFacts } from '../../electron/main/agent/memory-extract'
import os from 'node:os'
import path from 'node:path'

describe('extractAndStoreFacts', () => {
  it('stores name from natural introduction', () => {
    const memory = new JsonMemoryStore(path.join(os.tmpdir(), `friday-mem-${Date.now()}`))
    extractAndStoreFacts('My name is Yash. What is my name?', memory)
    expect(memory.recentFacts()).toContain("User's name is Yash")
    memory.close()
  })

  it('stores explicit remember phrases', () => {
    const memory = new JsonMemoryStore(path.join(os.tmpdir(), `friday-mem-${Date.now()}`))
    extractAndStoreFacts('Remember that I am building FRIDAY', memory)
    expect(memory.recentFacts().some((f) => /FRIDAY/i.test(f))).toBe(true)
    memory.close()
  })
})
