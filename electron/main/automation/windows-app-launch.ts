import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import {
  defaultPowerShellRunner,
  formatWhatsAppLaunchMessage,
  isWhatsAppLaunchHardFailure,
  launchWhatsAppDesktop,
  type WhatsAppLaunchResult
} from './whatsapp-desktop'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Safe alias → executable mapping (no user-controlled shell commands). */
export const WINDOWS_APP_ALIASES: Record<string, string> = {
  notepad: 'notepad.exe',
  calc: 'calc.exe',
  calculator: 'calc.exe',
  mspaint: 'mspaint.exe',
  paint: 'mspaint.exe'
}

export type WindowsAppLaunchResult = {
  ok: boolean
  executable?: string
  processName?: string
  error?: string
  userMessage?: string
  whatsapp?: WhatsAppLaunchResult
}

export function resolveWindowsAppExecutable(alias: string): string | null {
  const key = alias.trim().toLowerCase()
  if (key === 'whatsapp') return 'store:whatsapp'
  const exe = WINDOWS_APP_ALIASES[key]
  return exe ?? null
}

export async function launchWindowsApp(alias: string, waitMs = 800): Promise<WindowsAppLaunchResult> {
  const key = alias.trim().toLowerCase()
  if (key === 'whatsapp') {
    const result = await launchWhatsAppDesktop({
      runPowerShell: defaultPowerShellRunner(),
      sleep
    })
    const userMessage = formatWhatsAppLaunchMessage(result)
    const hardFailure = isWhatsAppLaunchHardFailure(result)
    return {
      ok: !hardFailure,
      userMessage,
      whatsapp: { ...result, message: userMessage },
      error: hardFailure ? userMessage : undefined
    }
  }

  const executable = resolveWindowsAppExecutable(alias)
  if (!executable) {
    return {
      ok: false,
      error: `"${alias}" is not a configured desktop app. Supported apps: ${[...Object.keys(WINDOWS_APP_ALIASES), 'whatsapp'].join(', ')}.`
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('cmd.exe', ['/c', 'start', '', executable], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.on('error', reject)
      child.unref()
      resolve()
    })
    await sleep(waitMs)
    const processName = executable.replace(/\.exe$/i, '').split(/[/\\]/).pop() ?? executable
    return { ok: true, executable, processName }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/** @deprecated Legacy path probe — Store WhatsApp uses {@link launchWhatsAppDesktop}. */
export function whatsAppDesktopExecutable(): string {
  const local = process.env.LOCALAPPDATA
  if (local) {
    const exe = path.join(local, 'WhatsApp', 'WhatsApp.exe')
    if (fs.existsSync(exe)) return exe
  }
  return 'whatsapp'
}
