import { z } from 'zod'
import type { RegisteredTool } from '../../../../shared/types/tools'
import { resolveBrowserMode } from '../../automation/browser-mode'
import { runYouTubeSearchAndPlay } from '../../automation/youtube-automation'
import type { PlaywrightService } from '../../automation/playwright-service'
import { defineTool } from '../define-tool'

export function createBrowserTools(
  playwright: PlaywrightService,
  useTestBrowser: () => boolean
): RegisteredTool[] {
  const pageForSession = async () => {
    const mode = resolveBrowserMode(useTestBrowser())
    return playwright.ensurePage(mode, mode === 'test')
  }

  const navigateSchema = z.object({ url: z.string().url() })
  const clickSchema = z.object({ selector: z.string() })
  const fillSchema = z.object({ selector: z.string(), text: z.string() })
  const pressSchema = z.object({ key: z.string() })
  const youtubeSchema = z.object({ query: z.string().min(1) })
  const snapshotSchema = z.object({})

  return [
    defineTool(
      {
        name: 'browser_navigate',
        description: 'Navigate the browser to a URL and verify the page loaded',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url']
        }
      },
      navigateSchema,
      async (args) => {
        const mode = resolveBrowserMode(useTestBrowser())
        try {
          if (mode === 'user') {
            const nav = await playwright.navigateInExistingChrome(args.url)
            if (nav.ok && nav.verified) {
              return {
                ok: true,
                data: {
                  url: nav.url,
                  title: nav.title,
                  verified: true
                }
              }
            }
          }
          const page = await pageForSession()
          const response = await page.goto(args.url, {
            waitUntil: 'domcontentloaded',
            timeout: 45_000
          })
          await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
          const host = new URL(args.url).hostname
          const verified = page.url().includes(host.replace(/^www\./, ''))
          if (!verified) {
            return { ok: false, error: 'Navigation did not reach the requested site.' }
          }
          return {
            ok: true,
            data: {
              url: page.url(),
              status: response?.status() ?? null,
              title: await page.title(),
              verified: true
            }
          }
        } catch (err) {
          if (mode === 'user') {
            const nav = await playwright.navigateInExistingChrome(args.url)
            if (nav.ok && nav.verified) {
              return {
                ok: true,
                data: {
                  url: nav.url,
                  title: nav.title,
                  verified: true
                }
              }
            }
            return {
              ok: false,
              error: nav.error ?? (err instanceof Error ? err.message : String(err))
            }
          }
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err)
          }
        }
      }
    ),
    defineTool(
      {
        name: 'browser_click',
        description: 'Click an element by CSS selector',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: { selector: { type: 'string' } },
          required: ['selector']
        }
      },
      clickSchema,
      async (args) => {
        const page = await pageForSession()
        await page.click(args.selector, { timeout: 15_000 })
        return { ok: true, data: { selector: args.selector, url: page.url() } }
      }
    ),
    defineTool(
      {
        name: 'browser_fill',
        description: 'Fill an input by CSS selector',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string' },
            text: { type: 'string' }
          },
          required: ['selector', 'text']
        }
      },
      fillSchema,
      async (args) => {
        const page = await pageForSession()
        await page.fill(args.selector, args.text, { timeout: 15_000 })
        return { ok: true, data: { selector: args.selector } }
      }
    ),
    defineTool(
      {
        name: 'browser_press_key',
        description: 'Press a keyboard key in the browser page',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: { key: { type: 'string' } },
          required: ['key']
        }
      },
      pressSchema,
      async (args) => {
        const page = await pageForSession()
        await page.keyboard.press(args.key)
        return { ok: true, data: { key: args.key } }
      }
    ),
    defineTool(
      {
        name: 'browser_youtube_search_play',
        description:
          'Open YouTube, search for a query, open the best matching result, and verify playback.',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Song or video title to search' } },
          required: ['query']
        }
      },
      youtubeSchema,
      async (args) => {
        const page = await pageForSession()
        const result = await runYouTubeSearchAndPlay(page, args.query)
        if (!result.ok) {
          return { ok: false, error: result.error ?? 'YouTube automation failed' }
        }
        if (!result.url?.includes('watch') || !result.videoId) {
          return { ok: false, error: 'Could not verify YouTube watch page' }
        }
        if (!result.playing) {
          return {
            ok: false,
            error: result.error ?? 'YouTube playback could not be verified'
          }
        }
        return {
          ok: true,
          data: {
            query: result.query,
            url: result.url,
            videoId: result.videoId,
            title: result.title,
            selectedTitle: result.selectedTitle,
            playing: true
          }
        }
      }
    ),
    defineTool(
      {
        name: 'browser_snapshot',
        description: 'Get page title, URL, and visible text excerpt for reasoning',
        risk: 'safe',
        parameters: { type: 'object', properties: {} }
      },
      snapshotSchema,
      async () => {
        const page = await pageForSession()
        const text = await page.evaluate(() => {
          const body = document.body
          return body?.innerText?.slice(0, 4000) ?? ''
        })
        return {
          ok: true,
          data: {
            url: page.url(),
            title: await page.title(),
            text
          }
        }
      }
    )
  ]
}
