import { describe, expect, it } from 'vitest'
import { isSensitiveFact, mergeFactList, shouldForgetFromMessage } from '../../electron/main/memory/memory-facts'
import { SAMPLE_USER_FACT, SAMPLE_USER_NAME } from '../fixtures/sample-user'

describe('memory facts', () => {
  it('deduplicates facts by normalized key', () => {
    const first = mergeFactList([], SAMPLE_USER_FACT)
    const second = mergeFactList(first.facts, `User's name is ${SAMPLE_USER_NAME.toLowerCase()}`)
    expect(second.facts).toHaveLength(1)
    expect(second.added).toBe(false)
  })

  it('rejects sensitive facts', () => {
    expect(isSensitiveFact('my password is secret')).toBe(true)
    const { facts, added } = mergeFactList([], 'my password is secret')
    expect(added).toBe(false)
    expect(facts).toHaveLength(0)
  })

  it('detects forget requests', () => {
    expect(shouldForgetFromMessage("don't remember that")).toBe(true)
  })
})
