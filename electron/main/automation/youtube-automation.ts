import type { Page } from 'playwright'
import {
  describePlaybackFailure,
  playbackVerified,
  type PlaybackFailureReason,
  type VideoSample
} from './youtube-playback'
import {
  extractYouTubeVideoId,
  isYouTubeMatchAcceptable,
  pickBestYouTubeResultIndex
} from './youtube-search-utils'

export type YouTubePlayResult = {
  ok: boolean
  query: string
  url?: string
  videoId?: string
  title?: string
  selectedTitle?: string
  playing?: boolean
  playbackFailure?: PlaybackFailureReason
  error?: string
}

async function dismissConsentIfPresent(page: Page): Promise<void> {
  const selectors = [
    'button[aria-label*="Accept" i]',
    'button:has-text("Accept all")',
    'button:has-text("Reject all")',
    'form[action*="consent"] button',
    'tp-yt-paper-button:has-text("Accept all")'
  ]
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1200 })) {
        await btn.click({ timeout: 3000 })
        await page.waitForTimeout(600)
        return
      }
    } catch {
      // continue
    }
  }
}

async function readVideoSample(page: Page): Promise<VideoSample | null> {
  return page.evaluate(() => {
    const video = document.querySelector('video')
    if (!video) return null
    return {
      currentTime: video.currentTime,
      paused: video.paused,
      readyState: video.readyState
    }
  })
}

async function tryStartPlayback(page: Page): Promise<void> {
  try {
    await page.locator('video').first().click({ timeout: 3000, force: true })
    await page.waitForTimeout(400)
  } catch {
    // ignore
  }
  try {
    await page.locator('.ytp-large-play-button, button[aria-label*="Play" i]').first().click({
      timeout: 4000
    })
    await page.waitForTimeout(800)
  } catch {
    try {
      await page.keyboard.press('k')
      await page.waitForTimeout(600)
    } catch {
      // ignore
    }
  }
  try {
    await page.evaluate(async () => {
      const video = document.querySelector('video')
      if (!video) return
      video.muted = true
      try {
        await video.play()
      } catch {
        // gesture or policy may still block
      }
    })
    await page.waitForTimeout(600)
  } catch {
    // ignore
  }
}

export async function waitForVerifiedPlayback(
  page: Page,
  timeoutMs = 14_000
): Promise<{ playing: boolean; reason?: PlaybackFailureReason }> {
  const deadline = Date.now() + timeoutMs
  let last: VideoSample | null = null
  let attempts = 0

  while (Date.now() < deadline) {
    const sample = await readVideoSample(page)
    if (!sample) {
      await page.waitForTimeout(400)
      continue
    }
    if (last && playbackVerified(last, sample)) {
      return { playing: true }
    }
    last = sample
    if (attempts % 3 === 0) {
      await tryStartPlayback(page)
    }
    attempts++
    await page.waitForTimeout(500)
  }

  const final = await readVideoSample(page)
  if (!final) return { playing: false, reason: 'no_video_element' }
  if (last && playbackVerified(last, final)) return { playing: true }
  if (final.paused && final.currentTime < 0.05) {
    return { playing: false, reason: 'autoplay_blocked' }
  }
  return { playing: false, reason: 'timeout' }
}

async function openSearchResults(page: Page, query: string): Promise<void> {
  const encoded = encodeURIComponent(query)
  await page.goto(`https://www.youtube.com/results?search_query=${encoded}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000
  })
  await dismissConsentIfPresent(page)

  if (!page.url().includes('/results')) {
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await dismissConsentIfPresent(page)
    const search = page.locator('input#search, input[name="search_query"], yt-searchbox input').first()
    await search.waitFor({ state: 'visible', timeout: 20_000 })
    await search.fill(query)
    await search.press('Enter')
    await page.waitForURL(/youtube\.com\/results/, { timeout: 25_000 })
  }
}

async function selectBestResult(page: Page, query: string): Promise<{ clicked: boolean; selectedTitle?: string }> {
  await page.locator('ytd-video-renderer a#video-title, a#video-title').first().waitFor({
    state: 'visible',
    timeout: 20_000
  })
  const titles = await page.locator('ytd-video-renderer a#video-title, a#video-title').allTextContents()
  const trimmed = titles.map((t) => t.trim()).filter(Boolean)
  if (trimmed.length === 0) {
    return { clicked: false }
  }

  const bestIdx = pickBestYouTubeResultIndex(query, trimmed)
  const selectedTitle = trimmed[bestIdx]
  if (!isYouTubeMatchAcceptable(query, selectedTitle)) {
    return { clicked: false, selectedTitle }
  }

  const link = page.locator('ytd-video-renderer a#video-title, a#video-title').nth(bestIdx)
  await link.click({ timeout: 15_000 })
  return { clicked: true, selectedTitle }
}

async function readWatchPageTitle(page: Page): Promise<string> {
  try {
    const meta = page.locator('h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string').first()
    const text = await meta.textContent({ timeout: 8000 })
    if (text?.trim()) return text.trim()
  } catch {
    // fall through
  }
  return (await page.title()).replace(/ - YouTube$/, '').trim()
}

async function finalizeWatchPage(page: Page, q: string, selectedTitle?: string): Promise<YouTubePlayResult> {
  const videoId = extractYouTubeVideoId(page.url())
  const watchTitle = await readWatchPageTitle(page)
  if (!videoId) {
    return { ok: false, query: q, error: 'Could not parse video id from watch URL' }
  }
  if (!isYouTubeMatchAcceptable(q, watchTitle)) {
    return {
      ok: false,
      query: q,
      url: page.url(),
      videoId,
      title: watchTitle,
      selectedTitle,
      error: `Opened video does not match query (got "${watchTitle}")`
    }
  }

  const playback = await waitForVerifiedPlayback(page)
  if (!playback.playing) {
    const reason = playback.reason ?? 'timeout'
    return {
      ok: false,
      query: q,
      url: page.url(),
      videoId,
      title: watchTitle,
      selectedTitle: selectedTitle ?? watchTitle,
      playing: false,
      playbackFailure: reason,
      error: describePlaybackFailure(reason)
    }
  }

  return {
    ok: true,
    query: q,
    url: page.url(),
    videoId,
    title: watchTitle,
    selectedTitle: selectedTitle ?? watchTitle,
    playing: true
  }
}

export async function runYouTubeSearchAndPlay(page: Page, query: string): Promise<YouTubePlayResult> {
  const q = query.trim()
  if (!q) {
    return { ok: false, query, error: 'Search query is empty' }
  }

  try {
    await openSearchResults(page, q)

    if (page.url().includes('/watch')) {
      return finalizeWatchPage(page, q)
    }

    const { clicked, selectedTitle } = await selectBestResult(page, q)
    if (!clicked) {
      return {
        ok: false,
        query: q,
        selectedTitle,
        error: selectedTitle
          ? `No sufficiently matching result for "${q}" (best: "${selectedTitle}")`
          : 'No YouTube search results found'
      }
    }

    await page.waitForURL(/\/watch\?v=/, { timeout: 30_000 })
    await page.waitForTimeout(800)
    return finalizeWatchPage(page, q, selectedTitle)
  } catch (err) {
    return {
      ok: false,
      query: q,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
