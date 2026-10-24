import { getSettings } from './settings'
import type { PlaywrightService } from './automation/playwright-service'
import { launchWindowsApp } from './automation/windows-app-launch'

export type QuickActionId =
  | 'youtube'
  | 'whatsapp'
  | 'search_web'
  | 'explain_code'
  | 'write_note'
  | 'more'

export type QuickActionDeps = {
  runAutomationMessage?: (message: string) => Promise<void>
}

export async function runQuickAction(
  id: QuickActionId,
  playwright: PlaywrightService,
  deps: QuickActionDeps = {}
): Promise<{ ok: boolean; message: string; composerPrefill?: string; openMore?: boolean }> {
  const settings = getSettings()

  if (
    !settings.chromeAttachEnabled &&
    !settings.playwrightHeadless &&
    (id === 'youtube' || id === 'search_web')
  ) {
    return {
      ok: false,
      message:
        'Chrome attach is disabled in Settings. Enable "Use existing Chrome via localhost CDP" and start Chrome with --remote-debugging-port=9222.'
    }
  }

  switch (id) {
    case 'youtube': {
      const url = settings.youtubeUrl?.trim() || 'https://www.youtube.com/'
      const nav = await playwright.navigateInExistingChrome(url)
      if (nav.ok && nav.verified) {
        const extra = nav.launchedChrome
          ? ' FRIDAY started a debug-enabled Chrome window — log in to YouTube there if needed.'
          : ''
        return { ok: true, message: `YouTube opened in Chrome (${nav.url ?? url}).${extra}` }
      }
      return { ok: false, message: nav.error ?? 'Could not verify YouTube navigation in Chrome.' }
    }
    case 'whatsapp': {
      const launch = await launchWindowsApp('whatsapp')
      if (!launch.ok) {
        return { ok: false, message: launch.error ?? 'Could not launch WhatsApp Desktop.' }
      }
      return {
        ok: launch.whatsapp?.stage !== 'failed',
        message: launch.userMessage ?? 'WhatsApp launch requested.'
      }
    }
    case 'search_web': {
      const nav = await playwright.navigateInExistingChrome('https://www.google.com/')
      if (nav.ok && nav.verified) {
        const extra = nav.launchedChrome
          ? ' FRIDAY started a debug-enabled Chrome window — sign in once if needed.'
          : ''
        return {
          ok: true,
          message: `Google opened in Chrome.${extra}`,
          composerPrefill: 'Search the web for '
        }
      }
      return {
        ok: false,
        message: nav.error ?? 'Could not open Google in Chrome.',
        composerPrefill: 'Search the web for '
      }
    }
    case 'explain_code':
      return {
        ok: true,
        message: 'Paste your code in the composer, or describe what to explain.',
        composerPrefill: 'Explain this code:\n\n'
      }
    case 'write_note': {
      if (deps.runAutomationMessage) {
        await deps.runAutomationMessage('Open Notepad on my computer.')
        return { ok: true, message: 'Opening Notepad…' }
      }
      return { ok: false, message: 'Automation is not ready. Try again in a moment.' }
    }
    case 'more':
      return { ok: true, message: '', openMore: true }
    default:
      return { ok: false, message: 'Unknown action.' }
  }
}
