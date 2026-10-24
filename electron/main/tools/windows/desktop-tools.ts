import { spawn } from 'node:child_process'
import { z } from 'zod'
import type { RegisteredTool } from '../../../../shared/types/tools'
import { WINDOWS_APP_ALIASES } from '../../automation/windows-app-launch'
import { defineTool } from '../define-tool'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function escapeSendKeys(text: string): string {
  return text.replace(/[+^%~()[\]{}]/g, (c) => `{${c}}`)
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += String(d)
    })
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`))
    })
  })
}

const launchSchema = z.object({
  app: z.string().min(1),
  waitMs: z.number().int().min(0).max(10_000).optional()
})

const typeSchema = z.object({
  text: z.string(),
  processName: z.string().optional(),
  delayMs: z.number().int().min(0).max(10_000).optional()
})

const verifySchema = z.object({ processName: z.string().min(1) })

export function createDesktopTools(): RegisteredTool[] {
  return [
    defineTool(
      {
        name: 'desktop_launch',
        description:
          'Launch a Windows desktop application. Use app names like notepad, calc, mspaint, or a full path to an .exe. Prefer this over path_resolve for opening apps.',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            app: { type: 'string', description: 'App alias (notepad) or executable path' },
            waitMs: { type: 'number', description: 'Milliseconds to wait after launch (default 600)' }
          },
          required: ['app']
        }
      },
      launchSchema,
      async (args) => {
        const key = args.app.trim().toLowerCase()
        const executable = WINDOWS_APP_ALIASES[key] ?? args.app
        const waitMs = args.waitMs ?? 600

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
        return { ok: true, data: { app: args.app, executable, processName, waitMs } }
      }
    ),
    defineTool(
      {
        name: 'desktop_type_text',
        description:
          'Type text into the foreground window of a running desktop app (e.g. Notepad). Focuses the newest window for the given process name, then sends keystrokes. Use after desktop_launch.',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            processName: {
              type: 'string',
              description: 'Process name without .exe, e.g. notepad (default notepad)'
            },
            delayMs: { type: 'number', description: 'Delay before typing (default 500)' }
          },
          required: ['text']
        }
      },
      typeSchema,
      async (args) => {
        const processName = (args.processName ?? 'notepad').replace(/\.exe$/i, '')
        const delayMs = args.delayMs ?? 500
        const escaped = escapeSendKeys(args.text)
        const script = `
$ErrorActionPreference = 'Stop'
Start-Sleep -Milliseconds ${delayMs}
$procs = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending
if (-not $procs) { throw "Process '${processName}' is not running" }
$p = $procs | Select-Object -First 1
if ($p.MainWindowHandle -eq 0) { throw "Process '${processName}' has no main window yet" }
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FridayWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
[FridayWin32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
[FridayWin32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 350
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped.replace(/'/g, "''")}')
Write-Output "typed"
`
        await runPowerShell(script)
        return { ok: true, data: { processName, chars: args.text.length } }
      }
    ),
    defineTool(
      {
        name: 'desktop_verify_process',
        description: 'Check whether a Windows process is running (verification after launch).',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: {
            processName: { type: 'string', description: 'Process name without .exe' }
          },
          required: ['processName']
        }
      },
      verifySchema,
      async (args) => {
        const processName = args.processName.replace(/\.exe$/i, '')
        const script = `
$procs = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue
@{ running = ($null -ne $procs); count = @($procs).Count } | ConvertTo-Json -Compress
`
        const output = await runPowerShell(script)
        const data = JSON.parse(output) as { running: boolean; count: number }
        return { ok: true, data: { processName, ...data } }
      }
    )
  ]
}
