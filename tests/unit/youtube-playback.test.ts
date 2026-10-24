import { describe, expect, it } from 'vitest'
import { isPlaybackAdvancing, isVideoActivelyPlaying, playbackVerified } from '../../electron/main/automation/youtube-playback'

describe('youtube playback verification', () => {
  it('detects active playback', () => {
    expect(isVideoActivelyPlaying({ currentTime: 0.2, paused: false, readyState: 4 })).toBe(true)
    expect(isVideoActivelyPlaying({ currentTime: 0, paused: true, readyState: 2 })).toBe(false)
  })

  it('detects advancing time', () => {
    const before = { currentTime: 0.1, paused: false, readyState: 3 }
    const after = { currentTime: 0.25, paused: false, readyState: 4 }
    expect(playbackVerified(before, after)).toBe(true)
  })
})
