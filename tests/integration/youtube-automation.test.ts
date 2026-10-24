import os from 'node:os'
import { describe, expect, it } from 'vitest'
import { PlaywrightService } from '../../electron/main/automation/playwright-service'
import { runYouTubeSearchAndPlay } from '../../electron/main/automation/youtube-automation'

const runBrowser = process.env.RUN_BROWSER_TESTS === '1'

describe.runIf(runBrowser)('YouTube automation (live)', () => {
  it('searches and opens a watch page', async () => {
    const pw = new PlaywrightService(os.tmpdir())
    const page = await pw.ensurePage('test', true)
    const result = await runYouTubeSearchAndPlay(page, 'Desi Boys')
    if (!result.ok) {
      console.info('[youtube-live]', result.error, result.playbackFailure)
    }
    expect(result.ok, result.error ?? 'unknown failure').toBe(true)
    expect(result.url).toMatch(/youtube\.com\/watch/)
    expect(result.videoId).toBeTruthy()
    expect(result.selectedTitle?.toLowerCase()).toMatch(/desi/)
    expect(result.playing).toBe(true)
    await pw.close()
  }, 120_000)
})
