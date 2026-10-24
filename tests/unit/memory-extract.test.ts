import { describe, expect, it } from 'vitest'
import { JsonMemoryStore } from '../../electron/main/memory/json-memory'
import { extractAndStoreFacts } from '../../electron/main/agent/memory-extract'
import os from 'node:os'
import path from 'node:path'
import { SAMPLE_USER_FACT, SAMPLE_USER_NAME } from '../fixtures/sample-user'

describe('extractAndStoreFacts', () => {
  it('stores name from natural introduction', () => {
    const memory = new JsonMemoryStore(path.join(os.tmpdir(), `friday-mem-${Date.now()}`))
    extractAndStoreFacts(`My name is ${SAMPLE_USER_NAME}. What is my name?`, memory)
    expect(memory.recentFacts()).toContain(SAMPLE_USER_FACT)
    memory.close()
  })

  it('stores explicit remember phrases', () => {
    const memory = new JsonMemoryStore(path.join(os.tmpdir(), `friday-mem-${Date.now()}`))
    extractAndStoreFacts('Remember that I am building FRIDAY', memory)
    expect(memory.recentFacts().some((f) => /FRIDAY/i.test(f))).toBe(true)
    memory.close()
  })
})
