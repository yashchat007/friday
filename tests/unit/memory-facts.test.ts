import { describe, expect, it } from 'vitest'
import { isSensitiveFact, mergeFactList, shouldForgetFromMessage } from '../../electron/main/memory/memory-facts'

describe('memory facts', () => {
  it('deduplicates facts by normalized key', () => {
    const first = mergeFactList([], "User's name is Yash")
    const second = mergeFactList(first.facts, "User's name is yash")
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
