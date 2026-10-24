import os from 'node:os'
import { describe, expect, it } from 'vitest'
import { PlaywrightService } from '../../electron/main/automation/playwright-service'

const runBrowser = process.env.RUN_BROWSER_TESTS === '1'

describe.runIf(runBrowser)('PlaywrightService', () => {
  it(
    'navigates to example.com',
    async () => {
      const pw = new PlaywrightService(os.tmpdir())
      const page = await pw.ensurePage('test', true)
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30_000 })
      expect(await page.title()).toMatch(/example/i)
      await pw.close()
    },
    45_000
  )
})
