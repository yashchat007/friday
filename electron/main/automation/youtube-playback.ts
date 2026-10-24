/** Playback verification helpers (unit-testable). */

export type VideoSample = {
  currentTime: number
  paused: boolean
  readyState: number
}

export function isVideoActivelyPlaying(sample: VideoSample): boolean {
  return !sample.paused && sample.currentTime > 0.08
}

export function isPlaybackAdvancing(before: VideoSample, after: VideoSample): boolean {
  if (before.readyState < 2 && after.readyState < 2) return false
  return after.currentTime > before.currentTime + 0.04
}

export function playbackVerified(before: VideoSample, after: VideoSample): boolean {
  return isVideoActivelyPlaying(after) || isPlaybackAdvancing(before, after)
}

export type PlaybackFailureReason =
  | 'no_video_element'
  | 'autoplay_blocked'
  | 'stalled'
  | 'timeout'

export function describePlaybackFailure(reason: PlaybackFailureReason): string {
  switch (reason) {
    case 'no_video_element':
      return 'No HTML5 video element found on the watch page.'
    case 'autoplay_blocked':
      return 'Video loaded but playback did not start (autoplay may be blocked). Try headed browser mode in Settings.'
    case 'stalled':
      return 'Video element found but playback stalled.'
    case 'timeout':
      return 'Timed out waiting for playback to start.'
  }
}
