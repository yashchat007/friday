import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_CHROME_PATHS = [
  path.join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Google',
    'Chrome',
    'Application',
    'chrome.exe'
  ),
  path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe')
]

export function resolveChromeExecutable(customPath?: string): string | null {
  const trimmed = customPath?.trim()
  if (trimmed && fs.existsSync(trimmed)) return trimmed
  for (const p of DEFAULT_CHROME_PATHS) {
    if (p && fs.existsSync(p)) return p
  }
  return null
}

/** Opens a URL in the user's installed Google Chrome (visible), without automation verification. */
export function openUrlInSystemChrome(url: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('cmd.exe', ['/c', 'start', '""', 'chrome', url], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore'
    })
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('spawn', () => {
      child.unref()
      resolve({ ok: true })
    })
  })
}

/**
 * Launches a visible Chrome with localhost remote debugging and a dedicated profile.
 * Does not terminate the user's normal Chrome session.
 */
export function launchChromeWithDebugging(params: {
  userDataDir: string
  port: number
  executablePath?: string
  startUrl?: string
}): { ok: boolean; error?: string; executable?: string } {
  const exe = resolveChromeExecutable(params.executablePath)
  if (!exe) {
    return { ok: false, error: 'Google Chrome was not found. Set the Chrome path in Settings.' }
  }
  fs.mkdirSync(params.userDataDir, { recursive: true })
  const args = [
    `--remote-debugging-port=${params.port}`,
    `--user-data-dir=${params.userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=TranslateUI'
  ]
  if (params.startUrl) args.push(params.startUrl)

  try {
    const child = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false })
    child.unref()
    return { ok: true, executable: exe }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
