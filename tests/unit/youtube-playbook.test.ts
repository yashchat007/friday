import { describe, expect, it } from 'vitest'
import { isYouTubePlayRequest, parseYouTubePlayQuery } from '../../electron/main/agent/youtube-playbook'

describe('youtube playbook parsing', () => {
  it('extracts quoted song from YouTube play request', () => {
    const msg = "Open YouTube and play the song 'Desi Boys' on my laptop."
    expect(isYouTubePlayRequest(msg)).toBe(true)
    expect(parseYouTubePlayQuery(msg)).toBe('Desi Boys')
  })

  it('parses open youtube and play without quotes', () => {
    expect(parseYouTubePlayQuery('Open YouTube and play Desi Boys')).toBe('Desi Boys')
  })

  it('returns null for casual chat', () => {
    expect(parseYouTubePlayQuery('hi there')).toBeNull()
    expect(parseYouTubePlayQuery('how do I play chess')).toBeNull()
  })
})
