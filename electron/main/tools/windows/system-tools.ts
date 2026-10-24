import { spawn } from 'node:child_process'
import { z } from 'zod'
import { shell } from 'electron'
import type { RegisteredTool } from '../../../../shared/types/tools'
import { defineTool } from '../define-tool'

const DENY_PATTERNS = [
  /remove-item\s+-recurse/i,
  /format-volume/i,
  /invoke-webrequest/i,
  /curl\s+/i,
  /wget\s+/i
]

export function createSystemTools(): RegisteredTool[] {
  return [
    defineTool(
      {
        name: 'app_launch',
        description: 'Launch an application or open a file with the default app',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Executable path, file path, or app name' }
          },
          required: ['target']
        }
      },
      z.object({ target: z.string() }),
      async (args) => {
        const result = await shell.openPath(args.target)
        if (result) {
          return { ok: false, error: result }
        }
        return { ok: true, data: { target: args.target } }
      }
    ),
    defineTool(
      {
        name: 'open_external',
        description: 'Open a URL in the system default browser',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' }
          },
          required: ['url']
        }
      },
      z.object({ url: z.string().url() }),
      async (args) => {
        await shell.openExternal(args.url)
        return { ok: true, data: { url: args.url } }
      }
    ),
    defineTool(
      {
        name: 'run_powershell',
        description: 'Run a PowerShell script (sensitive, user approval required)',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            script: { type: 'string' }
          },
          required: ['script']
        }
      },
      z.object({ script: z.string().min(1) }),
      async (args) => {
        for (const pattern of DENY_PATTERNS) {
          if (pattern.test(args.script)) {
            return { ok: false, error: 'Script blocked by safety policy' }
          }
        }

        const output = await new Promise<string>((resolve, reject) => {
          const child = spawn(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', args.script],
            { windowsHide: true }
          )
          let stdout = ''
          let stderr = ''
          child.stdout.on('data', (d: Buffer | string) => {
            stdout += String(d)
          })
          child.stderr.on('data', (d: Buffer | string) => {
            stderr += String(d)
          })
          child.on('error', reject)
          child.on('close', (code: number | null) => {
            if (code === 0) resolve(stdout.trim())
            else reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`))
          })
        })

        return { ok: true, data: { output } }
      }
    )
  ]
}
