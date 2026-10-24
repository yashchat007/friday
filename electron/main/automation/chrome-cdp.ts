import { chromium, type Browser, type Page } from 'playwright'

export const CHROME_CDP_SETUP_HINT =
  'To automate your existing Chrome window, start Chrome with remote debugging on localhost only, for example: ' +
  '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 ' +
  '(use your normal profile shortcut if you already use debugging). FRIDAY connects only to http://127.0.0.1 — not exposed to the network.'

export function isAllowedCdpEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint)
    if (u.protocol !== 'http:') return false
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  } catch {
    return false
  }
}

export async function connectChromeOverCdp(endpoint: string): Promise<Browser> {
  if (!isAllowedCdpEndpoint(endpoint)) {
    throw new Error('Chrome CDP endpoint must be http://127.0.0.1 or http://localhost')
  }
  return chromium.connectOverCDP(endpoint, { timeout: 12_000 })
}

/** Prefer an open tab on the same host; otherwise reuse the active tab or open a new one in the default context. */
export async function acquirePageForHost(browser: Browser, host: string, navigateUrl?: string): Promise<Page> {
  const contexts = browser.contexts()
  const allPages: Page[] = []
  for (const ctx of contexts) {
    allPages.push(...ctx.pages())
  }

  const matching = allPages.filter((p) => {
    try {
      return new URL(p.url()).hostname.includes(host)
    } catch {
      return false
    }
  })
  if (matching.length > 0) {
    const page = matching[0]
    await page.bringToFront().catch(() => {})
    if (navigateUrl) {
      await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    }
    return page
  }

  const ctx = contexts[0]
  if (!ctx) {
    throw new Error('No Chrome browser context available over CDP.')
  }
  const page = allPages[0] ?? (await ctx.newPage())
  await page.bringToFront().catch(() => {})
  if (navigateUrl) {
    await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  }
  return page
}

export async function verifyNavigation(page: Page, expectedHost: string): Promise<boolean> {
  try {
    const url = page.url()
    const host = new URL(url).hostname
    return host.includes(expectedHost.replace(/^www\./, ''))
  } catch {
    return false
  }
}
