import { describe, expect, it, vi } from 'vitest'
import {
  buildLaunchStoreAppScript,
  buildDiagnosticsSummary,
  classifyWhatsAppState,
  classifyWhatsAppWindow,
  discoverWhatsAppStartApp,
  containsTechnicalWhatsAppDiagnostics,
  formatWhatsAppLaunchMessage,
  isWhatsAppLaunchHardFailure,
  sanitizeWhatsAppUserError,
  launchWhatsAppDesktop,
  parseDiscoverWhatsAppOutput,
  parseFocusOutput,
  parseWhatsAppProbeOutput,
  pickBestWhatsAppWindow,
  presentableWhatsAppWindows,
  probeWhatsAppRuntime,
  DISCOVER_WHATSAPP_START_APP_SCRIPT,
  WHATSAPP_PROBE_SCRIPT,
  WHATSAPP_WIN32_HELPER,
  buildFocusWhatsAppScript
} from '../../electron/main/automation/whatsapp-desktop'

function isWhatsAppProbeScript(script: string): boolean {
  return script === WHATSAPP_PROBE_SCRIPT || (script.includes('procOut') && script.includes('visibleWindows = $winOut'))
}

function isWhatsAppFocusScript(script: string): boolean {
  return script.includes('ActivateBest') && script.includes('foregroundVerified')
}

const AUMID = '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App'

const mainWindow = {
  title: 'WhatsApp',
  pid: 2,
  handle: 100,
  className: 'ApplicationFrameWindow',
  hostProcess: 'ApplicationFrameHost',
  width: 900,
  height: 700
}

const internalWindow = {
  title: 'WhatsApp',
  pid: 1,
  handle: 50,
  className: 'WinUIDesktopWin32WindowClass',
  hostProcess: 'WhatsApp.Root',
  width: 0,
  height: 0
}

const webviewWindow = {
  title: '(25) WhatsApp',
  pid: 3,
  handle: 60,
  className: 'Chrome_WidgetWin_1',
  hostProcess: 'msedgewebview2',
  width: 400,
  height: 300
}

function mockDiscover() {
  return JSON.stringify({
    found: true,
    name: 'WhatsApp',
    appId: AUMID,
    candidates: []
  })
}

function mockAumidOk() {
  return JSON.stringify({ ok: true, hr: 0, pid: 42 })
}

describe('whatsapp desktop MSIX', () => {
  it('generated Win32 C# avoids inline out declarations (Add-Type / older compiler)', () => {
    const unsupportedInlineOut = /out uint _/
    expect(WHATSAPP_WIN32_HELPER).not.toMatch(unsupportedInlineOut)
    expect(buildFocusWhatsAppScript()).not.toMatch(unsupportedInlineOut)
    expect(WHATSAPP_WIN32_HELPER).toContain('out fgPid')
    expect(WHATSAPP_WIN32_HELPER).toContain('out targetPid')
  })

  it('parses Get-StartApps discovery JSON and prefers !App AUMID', () => {
    const entry = parseDiscoverWhatsAppOutput(
      JSON.stringify({
        found: true,
        name: 'WhatsApp',
        appId: AUMID,
        candidates: [{ name: 'WhatsApp', appId: AUMID }]
      })
    )
    expect(entry?.appId).toContain('!App')
  })

  it('classifies internal and webview windows separately from main app', () => {
    expect(classifyWhatsAppWindow(internalWindow)).toBe('internal')
    expect(classifyWhatsAppWindow(webviewWindow)).toBe('webview_helper')
    expect(classifyWhatsAppWindow(mainWindow)).toBe('main_app')
    expect(presentableWhatsAppWindows([internalWindow, webviewWindow, mainWindow])).toHaveLength(1)
    expect(pickBestWhatsAppWindow([webviewWindow, mainWindow])?.handle).toBe(100)
  })

  it('classifies runtime state from presentable windows only', () => {
    expect(
      classifyWhatsAppState({
        processes: [{ name: 'WhatsApp.Root', id: 1 }],
        visibleWindows: [internalWindow, webviewWindow],
        presentableWindows: []
      })
    ).toBe('launcher_only')
    expect(
      classifyWhatsAppState({
        processes: [{ name: 'WhatsApp.Root', id: 1 }],
        visibleWindows: [internalWindow, mainWindow],
        presentableWindows: [mainWindow]
      })
    ).toBe('window_visible')
  })

  it('parses focus output requiring foregroundVerified for ok', () => {
    const verified = parseFocusOutput(
      JSON.stringify({
        foregroundVerified: true,
        setForegroundReturned: true,
        targetHandle: 100,
        foregroundHandle: 100,
        windowCount: 1,
        candidateCount: 3
      })
    )
    expect(verified.ok).toBe(true)
    const blocked = parseFocusOutput(
      JSON.stringify({
        foregroundVerified: false,
        setForegroundReturned: true,
        targetHandle: 50,
        foregroundHandle: 999,
        error: 'foreground_not_verified'
      })
    )
    expect(blocked.ok).toBe(false)
  })

  it('never exposes technical diagnostics in user-facing launch messages', () => {
    const msg = formatWhatsAppLaunchMessage({
      ok: true,
      stage: 'process_detected',
      message: '',
      aumid: AUMID,
      probe: {
        processes: [{ name: 'WhatsApp.Root', id: 1 }],
        visibleWindows: [internalWindow],
        presentableWindows: []
      },
      diagnostics: {
        launchMethodsTried: ['open_application_activation'],
        launchNotes: ['hr=-2147024891'],
        activationFocused: false,
        foregroundVerified: false,
        focusAttempts: 1,
        launchCount: 1,
        pollRounds: 1,
        trace: []
      }
    })
    expect(containsTechnicalWhatsAppDiagnostics(msg)).toBe(false)
    expect(sanitizeWhatsAppUserError('AUMID foo · processes: WhatsApp.Root(1)')).not.toMatch(/AUMID/)
  })

  it('classifies hard vs soft launch outcomes', () => {
    expect(
      isWhatsAppLaunchHardFailure({
        ok: false,
        stage: 'failed',
        message: ''
      })
    ).toBe(true)
    expect(
      isWhatsAppLaunchHardFailure({
        ok: true,
        stage: 'process_detected',
        message: '',
        probe: { processes: [{ name: 'WhatsApp.Root', id: 1 }], visibleWindows: [], presentableWindows: [] }
      })
    ).toBe(false)
  })

  it('builds AppsFolder launch without hardcoded WindowsApps path', () => {
    const script = buildLaunchStoreAppScript(AUMID)
    expect(script).toContain('shell:AppsFolder')
    expect(script).not.toContain('WindowsApps')
  })

  it('uses a short user message when process runs but window is unconfirmed', () => {
    const msg = formatWhatsAppLaunchMessage({
      ok: true,
      stage: 'process_detected',
      message: '',
      aumid: AUMID,
      probe: {
        processes: [{ name: 'WhatsApp.Root', id: 14948 }],
        visibleWindows: [internalWindow],
        presentableWindows: []
      },
      diagnostics: {
        launchMethodsTried: ['open_application_activation'],
        launchNotes: [],
        activationFocused: false,
        foregroundVerified: false,
        focusAttempts: 1,
        launchCount: 1,
        pollRounds: 3,
        trace: []
      }
    })
    expect(msg).toMatch(/couldn't confirm its window/i)
    expect(msg).not.toMatch(/AUMID/i)
    expect(msg).not.toMatch(/WhatsApp\.Root/)
  })

  it('uses a short user message when main window exists but foreground is not verified', () => {
    const msg = formatWhatsAppLaunchMessage({
      ok: true,
      stage: 'window_confirmed',
      message: '',
      aumid: AUMID,
      probe: {
        processes: [{ name: 'WhatsApp.Root', id: 1 }],
        visibleWindows: [internalWindow, mainWindow],
        presentableWindows: [mainWindow]
      },
      diagnostics: {
        launchMethodsTried: ['open_application_activation'],
        launchNotes: [],
        activationFocused: false,
        foregroundVerified: false,
        focusAttempts: 2,
        launchCount: 2,
        pollRounds: 1,
        trace: []
      }
    })
    expect(msg).toMatch(/couldn't bring it to the front/i)
    expect(msg).not.toContain('hwnd=')
  })

  it('activates via AUMID and succeeds when presentable window is foreground-verified', async () => {
    let aumidCalls = 0
    const runPowerShell = vi.fn(async (script: string) => {
      if (script === DISCOVER_WHATSAPP_START_APP_SCRIPT) return mockDiscover()
      if (script.includes('ActivateApplication')) {
        aumidCalls++
        return mockAumidOk()
      }
      if (isWhatsAppProbeScript(script)) {
        return JSON.stringify({
          processes: [{ name: 'ApplicationFrameHost', id: 2 }],
          visibleWindows: [mainWindow]
        })
      }
      if (isWhatsAppFocusScript(script)) {
        return JSON.stringify({
          foregroundVerified: true,
          setForegroundReturned: true,
          targetHandle: 100,
          foregroundHandle: 100,
          windowCount: 1,
          candidateCount: 2,
          role: 'main_app',
          sample: 'WhatsApp|ApplicationFrameWindow|host=ApplicationFrameHost|hwnd=100'
        })
      }
      return ''
    })
    const result = await launchWhatsAppDesktop({
      runPowerShell,
      sleep: async () => {},
      coldPollAttempts: 1,
      coldPollIntervalMs: 1
    })
    expect(aumidCalls).toBeGreaterThanOrEqual(1)
    expect(result.ok).toBe(true)
    expect(result.diagnostics?.foregroundVerified).toBe(true)
    expect(result.probe?.presentableWindows).toHaveLength(1)
    expect(runPowerShell).not.toHaveBeenCalledWith(expect.stringContaining('shell:AppsFolder'))
  })

  it('does not succeed when only internal/helper windows are detected', async () => {
    const runPowerShell = vi.fn(async (script: string) => {
      if (script === DISCOVER_WHATSAPP_START_APP_SCRIPT) return mockDiscover()
      if (isWhatsAppProbeScript(script)) {
        return JSON.stringify({
          processes: [{ name: 'WhatsApp.Root', id: 1 }],
          visibleWindows: [internalWindow, webviewWindow]
        })
      }
      if (script.includes('ActivateApplication')) return mockAumidOk()
      if (isWhatsAppFocusScript(script)) {
        return JSON.stringify({
          foregroundVerified: false,
          error: 'no_presentable_target',
          candidateCount: 2
        })
      }
      return ''
    })
    const result = await launchWhatsAppDesktop({
      runPowerShell,
      sleep: async () => {},
      coldPollAttempts: 2,
      coldPollIntervalMs: 1
    })
    expect(result.ok).toBe(true)
    expect(result.stage).toBe('process_detected')
    expect(result.probe?.presentableWindows).toHaveLength(0)
  })

  it('falls back to apps_folder when COM activation returns non-zero HR', async () => {
    let appsFolderCalls = 0
    const runPowerShell = vi.fn(async (script: string) => {
      if (script === DISCOVER_WHATSAPP_START_APP_SCRIPT) return mockDiscover()
      if (script.includes('ActivateApplication')) {
        return JSON.stringify({ ok: false, hr: -2147024891, pid: 0, error: 'HRESULT -2147024891' })
      }
      if (script.includes('shell:AppsFolder')) {
        appsFolderCalls++
        return JSON.stringify({ ok: true })
      }
      if (isWhatsAppProbeScript(script)) {
        return JSON.stringify({
          processes: [{ name: 'WhatsApp.Root', id: 1 }],
          visibleWindows: []
        })
      }
      if (isWhatsAppFocusScript(script)) {
        return JSON.stringify({ foregroundVerified: false, error: 'no_presentable_window' })
      }
      return ''
    })
    await launchWhatsAppDesktop({
      runPowerShell,
      sleep: async () => {},
      coldPollAttempts: 1,
      coldPollIntervalMs: 1
    })
    expect(appsFolderCalls).toBe(1)
  })

  it('records PowerShell errors from focus', async () => {
    const runPowerShell = vi.fn(async (script: string) => {
      if (script === DISCOVER_WHATSAPP_START_APP_SCRIPT) return mockDiscover()
      if (script.includes('ActivateApplication')) return mockAumidOk()
      if (isWhatsAppProbeScript(script)) {
        return JSON.stringify({
          processes: [{ name: 'ApplicationFrameHost', id: 1 }],
          visibleWindows: [mainWindow]
        })
      }
      if (isWhatsAppFocusScript(script)) {
        throw new Error('Add-Type: type already exists')
      }
      return ''
    })
    const result = await launchWhatsAppDesktop({
      runPowerShell,
      sleep: async () => {},
      coldPollAttempts: 1,
      coldPollIntervalMs: 1
    })
    const focusTrace = result.diagnostics?.trace.find((t) => t.event === 'focus')
    expect(focusTrace?.detail).toMatch(/ps_error=/)
    expect(result.ok).toBe(true)
    expect(result.stage).toBe('window_confirmed')
  })

  it('does not call apps_folder when AUMID activation succeeds', async () => {
    let appsFolderCalls = 0
    const runPowerShell = vi.fn(async (script: string) => {
      if (script === DISCOVER_WHATSAPP_START_APP_SCRIPT) return mockDiscover()
      if (script.includes('ActivateApplication')) return mockAumidOk()
      if (script.includes('shell:AppsFolder')) {
        appsFolderCalls++
        return JSON.stringify({ ok: true })
      }
      if (isWhatsAppProbeScript(script)) {
        return JSON.stringify({ processes: [], visibleWindows: [] })
      }
      return ''
    })
    await launchWhatsAppDesktop({
      runPowerShell,
      sleep: async () => {},
      coldPollAttempts: 1,
      coldPollIntervalMs: 1
    })
    expect(appsFolderCalls).toBe(0)
  })

  it('discoverWhatsAppStartApp uses runner output', async () => {
    const entry = await discoverWhatsAppStartApp(async () =>
      JSON.stringify({ found: true, name: 'WhatsApp', appId: 'X.WhatsAppDesktop_y!App', candidates: [] })
    )
    expect(entry?.name).toBe('WhatsApp')
  })

  it('buildDiagnosticsSummary lists helpers when no main window', () => {
    const s = buildDiagnosticsSummary({
      aumid: 'X!App',
      stage: 'process_detected',
      runtimeState: 'launcher_only',
      probe: {
        processes: [{ name: 'WhatsApp.Root', id: 1 }],
        visibleWindows: [internalWindow],
        presentableWindows: []
      },
      diagnostics: {
        launchMethodsTried: ['open_application_activation'],
        launchNotes: [],
        activationFocused: false,
        foregroundVerified: false,
        focusAttempts: 1,
        launchCount: 1,
        pollRounds: 2,
        trace: []
      }
    })
    expect(s).toContain('helpers only')
    expect(s).toContain('internal')
  })

  it('probeWhatsAppRuntime enriches presentableWindows', async () => {
    const probe = await probeWhatsAppRuntime(async () =>
      JSON.stringify({
        processes: [{ name: 'WhatsApp.Root', id: 1 }],
        visibleWindows: [internalWindow, mainWindow]
      })
    )
    expect(probe.presentableWindows).toHaveLength(1)
  })

  it('parseWhatsAppProbeOutput tolerates malformed JSON', () => {
    expect(parseWhatsAppProbeOutput('not-json').processes).toEqual([])
  })
})
