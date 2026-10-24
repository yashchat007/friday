import http from 'node:http'

export type CdpProbeResult =
  | { ok: true; browser: string; webSocketDebuggerUrl: string }
  | { ok: false; code: 'refused' | 'timeout' | 'invalid' | 'http'; message: string }

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

export function sanitizeAutomationError(raw: string): string {
  let t = stripAnsi(raw)
  t = t.replace(/browserType\.connectOverCDP:\s*/gi, '')
  t = t.replace(/Call log:[\s\S]*/i, '')
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  if (t.length > 480) t = `${t.slice(0, 477)}…`
  return t
}

export function cdpRefusedMessage(port: number): string {
  return (
    `Chrome is not listening for automation on port ${port}. ` +
    `Either close Chrome and start it with --remote-debugging-port=${port} using your profile, ` +
    `or enable "Launch Chrome for FRIDAY" in Settings so FRIDAY can open a debug-enabled Chrome window (log in to YouTube/WhatsApp once in that window).`
  )
}

/** HTTP probe — checks DevTools JSON/version before Playwright connectOverCDP. */
export function probeCdpEndpoint(endpoint: string, timeoutMs = 2500): Promise<CdpProbeResult> {
  return new Promise((resolve) => {
    let url: URL
    try {
      url = new URL(endpoint)
      if (url.protocol !== 'http:' || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')) {
        resolve({ ok: false, code: 'invalid', message: 'CDP endpoint must be http://127.0.0.1 or localhost' })
        return
      }
    } catch {
      resolve({ ok: false, code: 'invalid', message: 'Invalid CDP URL' })
      return
    }

    const path = '/json/version'
    const req = http.get(
      { hostname: url.hostname, port: url.port || 9222, path, timeout: timeoutMs },
      (res) => {
        let body = ''
        res.on('data', (c) => {
          body += c
        })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            resolve({ ok: false, code: 'http', message: `CDP HTTP ${res.statusCode}` })
            return
          }
          try {
            const json = JSON.parse(body) as { Browser?: string; webSocketDebuggerUrl?: string }
            if (!json.webSocketDebuggerUrl) {
              resolve({ ok: false, code: 'http', message: 'CDP responded but webSocketDebuggerUrl is missing' })
              return
            }
            resolve({
              ok: true,
              browser: json.Browser ?? 'Chrome',
              webSocketDebuggerUrl: json.webSocketDebuggerUrl
            })
          } catch {
            resolve({ ok: false, code: 'http', message: 'CDP returned invalid JSON' })
          }
        })
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, code: 'timeout', message: 'CDP probe timed out' })
    })
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        resolve({ ok: false, code: 'refused', message: cdpRefusedMessage(Number(url.port) || 9222) })
        return
      }
      resolve({ ok: false, code: 'refused', message: err.message })
    })
  })
}

export async function waitForCdp(endpoint: string, maxWaitMs = 15_000): Promise<CdpProbeResult> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const probe = await probeCdpEndpoint(endpoint, 2000)
    if (probe.ok) return probe
    await new Promise((r) => setTimeout(r, 400))
  }
  return probeCdpEndpoint(endpoint, 2000)
}
