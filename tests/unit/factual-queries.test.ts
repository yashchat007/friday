import { describe, expect, it } from 'vitest'
import {
  buildDeterministicConversationResponse,
  isCalendarQuery,
  isMemoryRecallQuery,
  matchFactsToQuery
} from '../../electron/main/agent/factual-queries'

describe('factual queries', () => {
  it('detects calendar questions', () => {
    expect(isCalendarQuery('What is on my calendar today?')).toBe(true)
    expect(isCalendarQuery('Do I have a meeting with Rishabh at 2 PM?')).toBe(true)
    expect(isCalendarQuery('Open YouTube')).toBe(false)
  })

  it('refuses calendar without inventing events', () => {
    const reply = buildDeterministicConversationResponse('Any meetings today?', [])
    expect(reply).toMatch(/don't have access to a calendar/i)
    expect(reply).not.toMatch(/Rishabh|Aaradhya|12:30/i)
  })

  it('answers memory recall only from stored facts', () => {
    const facts = ['Working on Sprint 1 of DSA']
    expect(isMemoryRecallQuery('Do you remember my note about DSA?')).toBe(true)
    const reply = buildDeterministicConversationResponse('Do you remember my note about DSA?', facts)
    expect(reply).toContain('Sprint 1 of DSA')
    expect(reply).toMatch(/saved personal facts/i)
  })

  it('admits when no matching memory exists', () => {
    const reply = buildDeterministicConversationResponse('Do you remember lunch with Aaradhya?', [
      'User name is Yash'
    ])
    expect(reply).toMatch(/don't have a saved fact/i)
    expect(reply).not.toMatch(/Aaradhya at/i)
  })

  it('matchFactsToQuery uses keywords', () => {
    expect(matchFactsToQuery('note about sprint dsa', ['Sprint 1 of DSA', 'likes tea'])).toEqual([
      'Sprint 1 of DSA'
    ])
  })
})
