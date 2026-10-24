import path from 'node:path'
import type { Browser } from 'playwright'
import { getSettings } from '../settings'
import {
  cdpRefusedMessage,
  probeCdpEndpoint,
  sanitizeAutomationError,
  waitForCdp
} from './cdp-probe'
import { connectChromeOverCdp, isAllowedCdpEndpoint } from './chrome-cdp'
import { launchChromeWithDebugging } from './windows-chrome-launch'

export type ChromeSessionResult =
  | { ok: true; browser: Browser; endpoint: string; launched: boolean }
  | { ok: false; error: string; code: 'refused' | 'invalid' | 'launch_failed' }

export async function connectChromeSession(userDataPath: string): Promise<ChromeSessionResult> {
  const settings = getSettings()
  const endpoint = settings.chromeCdpUrl?.trim() || 'http://127.0.0.1:9222'
  if (!isAllowedCdpEndpoint(endpoint)) {
    return { ok: false, code: 'invalid', error: 'Chrome CDP URL must be http://127.0.0.1 or localhost only.' }
  }

  let probe = await probeCdpEndpoint(endpoint)
  let launched = false

  if (!probe.ok && settings.chromeAutoLaunchDebug !== false) {
    const port = Number(new URL(endpoint).port) || 9222
    const profileDir = path.join(userDataPath, 'chrome-cdp-profile')
    const launch = launchChromeWithDebugging({
      userDataDir: profileDir,
      port,
      executablePath: settings.chromeExecutablePath,
      startUrl: 'about:blank'
    })
    if (!launch.ok) {
      return {
        ok: false,
        code: 'launch_failed',
        error: launch.error ?? 'Could not start Chrome for automation.'
      }
    }
    launched = true
    probe = await waitForCdp(endpoint, 18_000)
  }

  if (!probe.ok) {
    const port = Number(new URL(endpoint).port) || 9222
    return {
      ok: false,
      code: probe.code === 'refused' ? 'refused' : 'invalid',
      error: probe.message || cdpRefusedMessage(port)
    }
  }

  try {
    const browser = await connectChromeOverCdp(endpoint)
    return { ok: true, browser, endpoint, launched }
  } catch (err) {
    return {
      ok: false,
      code: 'refused',
      error: sanitizeAutomationError(err instanceof Error ? err.message : String(err))
    }
  }
}
