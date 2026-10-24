import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { getSettings } from '../settings'
import type { BrowserAutomationMode } from './browser-mode'
import { acquirePageForHost, verifyNavigation } from './chrome-cdp'
import { connectChromeSession } from './chrome-session'
import { sanitizeAutomationError } from './cdp-probe'
import { openUrlInSystemChrome } from './windows-chrome-launch'

export class PlaywrightService {
  private readonly userDataPath: string
  private readonly profileDir: string
  private testBrowser: Browser | null = null
  private testContext: BrowserContext | null = null
  private testPage: Page | null = null
  private cdpBrowser: Browser | null = null
  private lastMode: BrowserAutomationMode | null = null
  private lastCdpError: string | null = null

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath
    this.profileDir = path.join(userDataPath, 'chrome-automation-profile')
  }

  getLastCdpError(): string | null {
    return this.lastCdpError
  }

  async ensurePage(mode: BrowserAutomationMode, headlessTest = true): Promise<Page> {
    if (mode === 'test') {
      return this.ensureTestPage(headlessTest)
    }
    return this.ensureExistingChromePage()
  }

  private async ensureTestPage(headless: boolean): Promise<Page> {
    if (!this.testBrowser) {
      this.testBrowser = await chromium.launch({
        headless,
        args: ['--autoplay-policy=no-user-gesture-required']
      })
    }
    if (!this.testContext) {
      this.testContext = await this.testBrowser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: 'en-US'
      })
    }
    if (!this.testPage) {
      this.testPage = await this.testContext.newPage()
    }
    this.lastMode = 'test'
    return this.testPage
  }

  private async ensureCdpBrowser(): Promise<Browser> {
    if (this.cdpBrowser) return this.cdpBrowser
    const session = await connectChromeSession(this.userDataPath)
    if (!session.ok) {
      this.lastCdpError = session.error
      throw new Error(session.error)
    }
    this.lastCdpError = null
    this.cdpBrowser = session.browser
    return this.cdpBrowser
  }

  private async ensureExistingChromePage(): Promise<Page> {
    const settings = getSettings()
    if (!settings.chromeAttachEnabled) {
      throw new Error(
        'Chrome attach is disabled in Settings. Enable "Use existing Chrome (CDP)" or use test browser mode for CI.'
      )
    }
    try {
      const browser = await this.ensureCdpBrowser()
      const page = await acquirePageForHost(browser, 'google.com')
      this.lastMode = 'user'
      return page
    } catch (err) {
      this.cdpBrowser = null
      const message = sanitizeAutomationError(err instanceof Error ? err.message : String(err))
      this.lastCdpError = message
      throw new Error(message)
    }
  }

  async navigateInExistingChrome(url: string): Promise<{
    ok: boolean
    url?: string
    title?: string
    error?: string
    verified?: boolean
    launchedChrome?: boolean
  }> {
    const settings = getSettings()
    if (settings.playwrightHeadless) {
      const page = await this.ensureTestPage(true)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      const host = new URL(url).hostname
      const verified = await verifyNavigation(page, host)
      return {
        ok: verified,
        url: page.url(),
        title: await page.title(),
        verified,
        error: verified ? undefined : 'Navigation could not be verified'
      }
    }

    if (!settings.chromeAttachEnabled) {
      return {
        ok: false,
        verified: false,
        error: 'Chrome attach is disabled in Settings.'
      }
    }

    try {
      const host = new URL(url).hostname
      const session = await connectChromeSession(this.userDataPath)
      if (!session.ok) {
        return { ok: false, verified: false, error: session.error }
      }
      this.cdpBrowser = session.browser
      const page = await acquirePageForHost(this.cdpBrowser, host, url)
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {})
      const verified = await verifyNavigation(page, host)
      return {
        ok: verified,
        url: page.url(),
        title: await page.title(),
        verified,
        launchedChrome: session.launched
      }
    } catch (err) {
      this.cdpBrowser = null
      const message = sanitizeAutomationError(err instanceof Error ? err.message : String(err))
      return { ok: false, error: message, verified: false }
    }
  }

  async openInSystemBrowser(url: string): Promise<{ ok: boolean; error?: string }> {
    return openUrlInSystemChrome(url)
  }

  getPage(): Page | null {
    if (this.lastMode === 'test') return this.testPage
    const pages = this.cdpBrowser?.contexts().flatMap((c) => c.pages()) ?? []
    return pages[0] ?? null
  }

  async close(): Promise<void> {
    await this.testContext?.close()
    await this.testBrowser?.close()
    await this.cdpBrowser?.close().catch(() => {})
    this.testPage = null
    this.testContext = null
    this.testBrowser = null
    this.cdpBrowser = null
    this.lastMode = null
  }
}
