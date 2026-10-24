import { describe, expect, it } from 'vitest'
import {
  extractYouTubeVideoId,
  isYouTubeMatchAcceptable,
  pickBestYouTubeResultIndex,
  scoreYouTubeTitle
} from '../../electron/main/automation/youtube-search-utils'

describe('youtube search utils', () => {
  it('scores Desi Boys above unrelated titles', () => {
    const titles = [
      'Random vlog daily life',
      'Desi Boys | Full Song | Official Video',
      'How to cook pasta'
    ]
    expect(pickBestYouTubeResultIndex('Desi Boys', titles)).toBe(1)
    expect(scoreYouTubeTitle('Desi Boys', titles[1])).toBeGreaterThan(scoreYouTubeTitle('Desi Boys', titles[0]))
  })

  it('accepts reasonable title matches', () => {
    expect(isYouTubeMatchAcceptable('Desi Boys', 'Desi Boys - Official Music Video')).toBe(true)
    expect(isYouTubeMatchAcceptable('Desi Boys', 'Unrelated Topic')).toBe(false)
  })

  it('extracts video id from watch url', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=foo')).toBe('dQw4w9WgXcQ')
  })
})
