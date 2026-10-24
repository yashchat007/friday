import { spawn } from 'node:child_process'

export type WhatsAppLaunchStage =
  | 'launch_requested'
  | 'process_detected'
  | 'window_confirmed'
  | 'failed'

export type WhatsAppRuntimeState = 'window_visible' | 'launcher_only' | 'not_running'

export type WhatsAppWindowRole = 'main_app' | 'internal' | 'webview_helper' | 'hosted_frame' | 'unknown'

export interface WhatsAppStartAppEntry {
  name: string
  appId: string
}

export interface WhatsAppWindowInfo {
  title: string
  pid: number
  handle: number
  className?: string
  hostProcess?: string
  iconic?: boolean
  width?: number
  height?: number
  role?: WhatsAppWindowRole
}

export interface WhatsAppRuntimeProbe {
  processes: Array<{ name: string; id: number }>
  /** All enumerated WhatsApp-related HWNDs (including helpers). */
  visibleWindows: WhatsAppWindowInfo[]
  /** Top-level presentable app shell windows only. */
  presentableWindows: WhatsAppWindowInfo[]
}

export interface WhatsAppTraceEntry {
  event: 'probe' | 'focus' | 'launch' | 'recovery' | 'state'
  windows: number
  processes: number
  detail?: string
}

export interface WhatsAppLaunchDiagnostics {
  aumid?: string
  launchMethodsTried: string[]
  launchNotes: string[]
  activationFocused: boolean
  foregroundVerified: boolean
  focusAttempts: number
  launchCount: number
  pollRounds: number
  trace: WhatsAppTraceEntry[]
}

export interface WhatsAppLaunchResult {
  ok: boolean
  stage: WhatsAppLaunchStage
  message: string
  aumid?: string
  hadExistingInstance?: boolean
  runtimeState?: WhatsAppRuntimeState
  launchMethod?: 'apps_folder' | 'application_activation' | 'protocol' | 'focus_only'
  probe?: WhatsAppRuntimeProbe
  diagnostics?: WhatsAppLaunchDiagnostics
  error?: string
}

export type PowerShellRunner = (script: string) => Promise<string>

export const LAUNCHER_RECOVERY_POLL_ATTEMPTS = 10
export const LAUNCHER_RECOVERY_POLL_MS = 400
export const COLD_START_POLL_ATTEMPTS = 14
export const COLD_START_POLL_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function defaultPowerShellRunner(): PowerShellRunner {
  return (script: string) =>
    new Promise((resolve, reject) => {
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

const AUMID_PATTERN = /^[A-Za-z0-9._!-]+$/

/** Classify HWND for tests and probe post-processing (mirrors Win32 scorer). */
export function classifyWhatsAppWindow(w: WhatsAppWindowInfo): WhatsAppWindowRole {
  const host = (w.hostProcess ?? '').toLowerCase()
  const cls = (w.className ?? '').toLowerCase()
  const title = w.title ?? ''

  if (host.includes('msedgewebview2') || cls.includes('chrome_widgetwin')) {
    return 'webview_helper'
  }
  if (cls.includes('winuidesktopwin32windowclass')) {
    return 'internal'
  }
  if (title === '(hosted frame)' && !host.includes('applicationframehost')) {
    return 'hosted_frame'
  }
  if (host.includes('applicationframehost') || cls.includes('applicationframe')) {
    if (/whatsapp/i.test(title) || title === '(hosted frame)') return 'main_app'
  }
  if (/whatsapp/i.test(title) && cls.includes('applicationframe')) {
    return 'main_app'
  }
  if (/whatsapp/i.test(title)) return 'unknown'
  return 'unknown'
}

export function presentableWhatsAppWindows(windows: WhatsAppWindowInfo[]): WhatsAppWindowInfo[] {
  return windows
    .map((w) => ({ ...w, role: classifyWhatsAppWindow(w) }))
    .filter((w) => w.role === 'main_app')
}

export function pickBestWhatsAppWindow(windows: WhatsAppWindowInfo[]): WhatsAppWindowInfo | null {
  const mains = presentableWhatsAppWindows(windows)
  if (mains.length === 0) return null
  const score = (w: WhatsAppWindowInfo): number => {
    let s = 0
    if (w.hostProcess === 'ApplicationFrameHost') s += 100
    if (w.className?.includes('ApplicationFrame')) s += 50
    if (w.title === 'WhatsApp') s += 25
    else if (/^\(\d+\) WhatsApp$/.test(w.title)) s += 15
    const area = (w.width ?? 0) * (w.height ?? 0)
    if (area >= 40_000) s += 20
    else if (area > 0 && area < 10_000) s -= 40
    if (w.iconic) s -= 15
    return s
  }
  return [...mains].sort((a, b) => score(b) - score(a))[0] ?? null
}

export function enrichProbe(probe: WhatsAppRuntimeProbe): WhatsAppRuntimeProbe {
  const visibleWindows = probe.visibleWindows.map((w) => ({
    ...w,
    role: classifyWhatsAppWindow(w)
  }))
  return {
    processes: probe.processes,
    visibleWindows,
    presentableWindows: presentableWhatsAppWindows(visibleWindows)
  }
}

export function classifyWhatsAppState(probe: WhatsAppRuntimeProbe): WhatsAppRuntimeState {
  const enriched = probe.presentableWindows?.length
    ? probe
    : enrichProbe(probe)
  if (enriched.presentableWindows.length > 0) return 'window_visible'
  if (enriched.processes.length > 0) return 'launcher_only'
  return 'not_running'
}

export function classifyWhatsAppFailureStage(probe: WhatsAppRuntimeProbe): 'process_detected' | 'launch_requested' {
  const enriched = enrichProbe(probe)
  if (enriched.processes.length > 0 || enriched.visibleWindows.length > 0) {
    return 'process_detected'
  }
  return 'launch_requested'
}

export function parseDiscoverWhatsAppOutput(output: string): WhatsAppStartAppEntry | null {
  try {
    const data = JSON.parse(output) as {
      found?: boolean
      name?: string
      appId?: string
      candidates?: Array<{ name: string; appId: string }>
    }
    if (data.candidates?.length) {
      const preferred =
        data.candidates.find((c) => c.appId.includes('WhatsAppDesktop') && c.appId.endsWith('!App')) ??
        data.candidates.find((c) => c.appId.includes('WhatsApp')) ??
        data.candidates[0]
      if (preferred && AUMID_PATTERN.test(preferred.appId)) {
        return { name: preferred.name, appId: preferred.appId }
      }
    }
    if (!data.found || !data.appId || !data.name) return null
    if (!AUMID_PATTERN.test(data.appId)) return null
    return { name: data.name, appId: data.appId }
  } catch {
    return null
  }
}

export function parseWhatsAppProbeOutput(output: string): WhatsAppRuntimeProbe {
  try {
    const data = JSON.parse(output) as WhatsAppRuntimeProbe
    const base = {
      processes: data.processes ?? [],
      visibleWindows: data.visibleWindows ?? [],
      presentableWindows: data.presentableWindows ?? []
    }
    return enrichProbe(base)
  } catch {
    return enrichProbe({ processes: [], visibleWindows: [], presentableWindows: [] })
  }
}

export interface WhatsAppFocusResult {
  ok: boolean
  foregroundVerified: boolean
  setForegroundReturned: boolean
  windowCount: number
  candidateCount: number
  targetHandle?: number
  foregroundHandle?: number
  role?: string
  error?: string
  sample?: string
}

export function parseFocusOutput(output: string): WhatsAppFocusResult {
  try {
    const data = JSON.parse(output) as WhatsAppFocusResult & { ok?: boolean }
    const foregroundVerified = Boolean(data.foregroundVerified)
    return {
      ok: foregroundVerified,
      foregroundVerified,
      setForegroundReturned: Boolean(data.setForegroundReturned),
      windowCount: data.windowCount ?? data.candidateCount ?? 0,
      candidateCount: data.candidateCount ?? data.windowCount ?? 0,
      targetHandle: data.targetHandle,
      foregroundHandle: data.foregroundHandle,
      role: data.role,
      error: data.error,
      sample: data.sample
    }
  } catch (err) {
    return {
      ok: false,
      foregroundVerified: false,
      setForegroundReturned: false,
      windowCount: 0,
      candidateCount: 0,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export function parseActivationOutput(output: string): { ok: boolean; hr?: number; pid?: number; error?: string } {
  try {
    const data = JSON.parse(output) as { ok?: boolean; hr?: number; pid?: number; error?: string }
    return { ok: Boolean(data.ok), hr: data.hr, pid: data.pid, error: data.error }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export const DISCOVER_WHATSAPP_START_APP_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$candidates = @(Get-StartApps | Where-Object { $_.AppID -like '*WhatsApp*' -or $_.Name -like '*WhatsApp*' })
$list = @($candidates | ForEach-Object { @{ name = $_.Name; appId = $_.AppID } })
$pick = $list | Where-Object { $_.appId -like '*WhatsAppDesktop*' -and $_.appId -like '*!App' } | Select-Object -First 1
if (-not $pick) { $pick = $list | Select-Object -First 1 }
if ($pick) {
  @{ found = $true; name = $pick.name; appId = $pick.appId; candidates = $list } | ConvertTo-Json -Compress -Depth 4
} else {
  @{ found = $false; candidates = @() } | ConvertTo-Json -Compress
}
`.trim()

export const WHATSAPP_WIN32_HELPER = `
using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public struct FridayRect { public int Left, Top, Right, Bottom; }
public class FridayWaWin32 {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  const uint GA_ROOT = 2;
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnum, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out FridayRect r);
  public static bool TitleHasWhatsApp(string title) {
    if (string.IsNullOrWhiteSpace(title)) return false;
    return title.IndexOf("WhatsApp", StringComparison.OrdinalIgnoreCase) >= 0;
  }
  public static string RoleFor(string title, string cls, string host) {
    if (host.IndexOf("msedgewebview2", StringComparison.OrdinalIgnoreCase) >= 0) return "webview_helper";
    if (cls.IndexOf("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase) >= 0) return "webview_helper";
    if (cls.Equals("WinUIDesktopWin32WindowClass", StringComparison.OrdinalIgnoreCase)) return "internal";
    if (host.IndexOf("ApplicationFrameHost", StringComparison.OrdinalIgnoreCase) >= 0) return "main_app";
    if (cls.IndexOf("ApplicationFrame", StringComparison.OrdinalIgnoreCase) >= 0 && TitleHasWhatsApp(title)) return "main_app";
    if (TitleHasWhatsApp(title)) return "unknown";
    return "unknown";
  }
  public static int Score(string title, string cls, string host, bool iconic, int width, int height) {
    string role = RoleFor(title, cls, host);
    if (role == "webview_helper" || role == "internal") return -10000;
    if (!TitleHasWhatsApp(title) && title != "(hosted frame)") return -5000;
    int s = 0;
    if (host.IndexOf("ApplicationFrameHost", StringComparison.OrdinalIgnoreCase) >= 0) s += 120;
    if (cls.IndexOf("ApplicationFrame", StringComparison.OrdinalIgnoreCase) >= 0) s += 60;
    if (title.Equals("WhatsApp", StringComparison.OrdinalIgnoreCase)) s += 30;
    else if (title.StartsWith("(", StringComparison.Ordinal) && title.EndsWith(" WhatsApp", StringComparison.OrdinalIgnoreCase)) s += 20;
    int area = width * height;
    if (area >= 40000) s += 25;
    else if (area > 0 && area < 10000) s -= 50;
    if (iconic) s -= 10;
    if (role == "main_app") s += 40;
    return s;
  }
  public static void CollectWindows(List<Dictionary<string, object>> bag, bool includeMinimized) {
    EnumWindows((hWnd, lParam) => {
      var titleSb = new StringBuilder(512);
      GetWindowText(hWnd, titleSb, 512);
      var title = titleSb.ToString();
      var clsSb = new StringBuilder(256);
      GetClassName(hWnd, clsSb, 256);
      var cls = clsSb.ToString();
      if (!TitleHasWhatsApp(title) && cls.IndexOf("ApplicationFrame", StringComparison.OrdinalIgnoreCase) < 0
          && !cls.Equals("WinUIDesktopWin32WindowClass", StringComparison.OrdinalIgnoreCase)
          && cls.IndexOf("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase) < 0) return true;
      bool visible = IsWindowVisible(hWnd);
      bool iconic = IsIconic(hWnd);
      if (!visible && !(includeMinimized && iconic) && !TitleHasWhatsApp(title)) return true;
      FridayRect r; GetWindowRect(hWnd, out r);
      int width = Math.Max(0, r.Right - r.Left);
      int height = Math.Max(0, r.Bottom - r.Top);
      uint pid; GetWindowThreadProcessId(hWnd, out pid);
      var row = new Dictionary<string, object>();
      row["title"] = title.Length > 0 ? title : "(hosted frame)";
      row["pid"] = (int)pid;
      row["handle"] = hWnd.ToInt64();
      row["className"] = cls;
      row["iconic"] = iconic;
      row["width"] = width;
      row["height"] = height;
      bag.Add(row);
      return true;
    }, IntPtr.Zero);
  }
  public static bool SameForegroundRoot(IntPtr target, IntPtr fg) {
    if (target == IntPtr.Zero || fg == IntPtr.Zero) return false;
    if (target == fg) return true;
    var rt = GetAncestor(target, GA_ROOT);
    var rf = GetAncestor(fg, GA_ROOT);
    return rt != IntPtr.Zero && rt == rf;
  }
  public static Dictionary<string, object> ActivateBest(List<Dictionary<string, object>> windows, string hostByPidJson) {
    var result = new Dictionary<string, object>();
    result["candidateCount"] = windows == null ? 0 : windows.Count;
    result["targetHandle"] = 0L;
    result["foregroundHandle"] = 0L;
    result["setForegroundReturned"] = false;
    result["foregroundVerified"] = false;
    result["role"] = "";
    result["sample"] = "";
    result["windowCount"] = 0;
    if (windows == null || windows.Count == 0) {
      result["error"] = "no_candidates";
      return result;
    }
    long bestHandle = 0; int bestScore = int.MinValue; string bestTitle = ""; string bestCls = ""; string bestHost = "";
    foreach (var w in windows) {
      string title = Convert.ToString(w["title"]);
      string cls = Convert.ToString(w["className"]);
      int pid = Convert.ToInt32(w["pid"]);
      string host = "";
      if (w.ContainsKey("hostProcess")) host = Convert.ToString(w["hostProcess"]);
      bool iconic = w.ContainsKey("iconic") && Convert.ToBoolean(w["iconic"]);
      int width = w.ContainsKey("width") ? Convert.ToInt32(w["width"]) : 0;
      int height = w.ContainsKey("height") ? Convert.ToInt32(w["height"]) : 0;
      int sc = Score(title, cls, host, iconic, width, height);
      if (sc > bestScore) {
        bestScore = sc; bestHandle = Convert.ToInt64(w["handle"]);
        bestTitle = title; bestCls = cls; bestHost = host;
      }
    }
    if (bestScore < 0) {
      result["error"] = "no_presentable_target";
      return result;
    }
    var hwnd = new IntPtr(bestHandle);
    result["targetHandle"] = bestHandle;
    result["role"] = RoleFor(bestTitle, bestCls, bestHost);
    result["sample"] = bestTitle + "|" + bestCls + "|host=" + bestHost + "|hwnd=" + bestHandle;
    result["windowCount"] = 1;
    if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
    else ShowWindow(hwnd, 5);
    IntPtr fgBefore = GetForegroundWindow();
    uint fgPid;
    uint fgTid = GetWindowThreadProcessId(fgBefore, out fgPid);
    uint targetPid;
    uint targetTid = GetWindowThreadProcessId(hwnd, out targetPid);
    bool attached = false;
    if (fgTid != 0 && targetTid != 0 && fgTid != targetTid) {
      attached = AttachThreadInput(fgTid, targetTid, true);
    }
    bool sfw = SetForegroundWindow(hwnd);
    BringWindowToTop(hwnd);
    try { SwitchToThisWindow(hwnd, true); } catch {}
    if (attached) AttachThreadInput(fgTid, targetTid, false);
    Thread.Sleep(120);
    IntPtr fgAfter = GetForegroundWindow();
    result["setForegroundReturned"] = sfw;
    result["foregroundHandle"] = fgAfter.ToInt64();
    bool verified = SameForegroundRoot(hwnd, fgAfter);
    result["foregroundVerified"] = verified;
    if (!verified) result["error"] = "foreground_not_verified";
    return result;
  }
}
`.trim()

export const WHATSAPP_PROBE_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$waRunning = @(Get-Process | Where-Object { $_.ProcessName -like 'WhatsApp*' })
$procs = @($waRunning | Select-Object ProcessName, Id -Unique)
$procOut = @($procs | ForEach-Object { @{ name = $_.ProcessName; id = [int]$_.Id } })
Add-Type @"
${WHATSAPP_WIN32_HELPER}
"@
$bag = New-Object 'System.Collections.Generic.List[System.Collections.Generic.Dictionary[string,object]]'
[FridayWaWin32]::CollectWindows($bag, $true)
$winOut = @()
foreach ($w in $bag) {
  $pname = ''
  try { $pname = (Get-Process -Id ([int]$w['pid']) -ErrorAction Stop).ProcessName } catch {}
  $title = [string]$w['title']
  $cls = [string]$w['className']
  $role = [FridayWaWin32]::RoleFor($title, $cls, $pname)
  $winOut += @{
    title = $title
    pid = [int]$w['pid']
    handle = [int64]$w['handle']
    className = $cls
    hostProcess = $pname
    iconic = [bool]$w['iconic']
    width = [int]$w['width']
    height = [int]$w['height']
    role = $role
  }
}
Get-Process -Name ApplicationFrameHost -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.MainWindowHandle -eq 0) { return }
  $h = [int64]$_.MainWindowHandle
  $t = $_.MainWindowTitle
  if ($t -notmatch 'WhatsApp' -and $waRunning.Count -eq 0) { return }
  if ($t -notmatch 'WhatsApp' -and $waRunning.Count -gt 0 -and [string]::IsNullOrWhiteSpace($t)) { $t = 'WhatsApp' }
  if ($t -notmatch 'WhatsApp') { return }
  if (-not ($winOut | Where-Object { $_.handle -eq $h })) {
    $winOut += @{
      title = $t
      pid = [int]$_.Id
      handle = $h
      className = 'ApplicationFrameWindow'
      hostProcess = 'ApplicationFrameHost'
      iconic = $false
      width = 800
      height = 600
      role = 'main_app'
    }
  }
}
@{ processes = $procOut; visibleWindows = $winOut } | ConvertTo-Json -Compress -Depth 6
`.trim()

export function buildFocusWhatsAppScript(): string {
  return `
$ErrorActionPreference = 'Stop'
try {
  Add-Type @"
${WHATSAPP_WIN32_HELPER}
"@
  $bag = New-Object 'System.Collections.Generic.List[System.Collections.Generic.Dictionary[string,object]]'
  [FridayWaWin32]::CollectWindows($bag, $true)
  foreach ($w in $bag) {
    $pname = ''
    try { $pname = (Get-Process -Id ([int]$w['pid']) -ErrorAction Stop).ProcessName } catch {}
    $w['hostProcess'] = $pname
  }
  Get-Process -Name ApplicationFrameHost -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.MainWindowHandle -eq 0) { return }
    $h = [int64]$_.MainWindowHandle
    if ($_.MainWindowTitle -notmatch 'WhatsApp') { return }
    if ($bag | Where-Object { [int64]$_['handle'] -eq $h }) { return }
    $row = New-Object 'System.Collections.Generic.Dictionary[string,object]'
    $row['title'] = $_.MainWindowTitle
    $row['pid'] = [int]$_.Id
    $row['handle'] = $h
    $row['className'] = 'ApplicationFrameWindow'
    $row['hostProcess'] = 'ApplicationFrameHost'
    $row['iconic'] = $false
    $row['width'] = 800
    $row['height'] = 600
    $bag.Add($row)
  }
  $act = [FridayWaWin32]::ActivateBest($bag, '')
  $act['ok'] = [bool]$act['foregroundVerified']
  $act | ConvertTo-Json -Compress
} catch {
  @{ ok = $false; foregroundVerified = $false; setForegroundReturned = $false; windowCount = 0; candidateCount = 0; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`.trim()
}

export function buildApplicationActivateScript(appId: string): string {
  if (!AUMID_PATTERN.test(appId)) {
    throw new Error('Invalid WhatsApp AppUserModelID')
  }
  const escaped = appId.replace(/'/g, "''")
  return `
$ErrorActionPreference = 'Stop'
try {
  $appId = '${escaped}'
  $clsid = [Guid]'45BA127D-10A8-46EA-8AB7-56C0600A43C9'
  $mgr = [Activator]::CreateInstance([Type]::GetTypeFromCLSID($clsid))
  $procId = [uint32]0
  $hr = $mgr.ActivateApplication($appId, $null, 0, [ref]$procId)
  @{ ok = ($hr -eq 0); hr = $hr; pid = $procId; error = $(if ($hr -ne 0) { "HRESULT $hr" } else { $null }) } | ConvertTo-Json -Compress
} catch {
  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`.trim()
}

export function buildLaunchStoreAppScript(appId: string): string {
  if (!AUMID_PATTERN.test(appId)) {
    throw new Error('Invalid WhatsApp AppUserModelID')
  }
  const escaped = appId.replace(/'/g, "''")
  return `
$ErrorActionPreference = 'Stop'
$appId = '${escaped}'
Start-Process -FilePath explorer.exe -ArgumentList "shell:AppsFolder\\$appId"
@{ ok = $true; method = 'explorer_apps_folder' } | ConvertTo-Json -Compress
`.trim()
}

export function buildLaunchProtocolScript(): string {
  return `
$ErrorActionPreference = 'Stop'
Start-Process "whatsapp:"
@{ ok = $true; method = 'protocol' } | ConvertTo-Json -Compress
`.trim()
}

export function buildDiagnosticsSummary(
  result: Pick<WhatsAppLaunchResult, 'aumid' | 'probe' | 'diagnostics' | 'stage' | 'runtimeState'>
): string {
  const parts: string[] = []
  if (result.runtimeState) parts.push(`state=${result.runtimeState}`)
  if (result.aumid) parts.push(`AUMID ${result.aumid}`)
  const procs = result.probe?.processes?.map((p) => `${p.name}(${p.id})`).join(', ')
  if (procs) parts.push(`processes: ${procs}`)
  const presentable = result.probe?.presentableWindows ?? []
  const all = result.probe?.visibleWindows ?? []
  if (presentable.length) {
    parts.push(
      `main window: ${presentable
        .map(
          (w) =>
            `"${w.title}" class=${w.className ?? '?'} hwnd=${w.handle} host=${w.hostProcess ?? '?'} ${w.width ?? 0}x${w.height ?? 0}`
        )
        .join('; ')}`
    )
  } else if (all.length) {
    parts.push(
      `helpers only (${all.length}): ${all
        .map((w) => {
          const role = w.role ?? classifyWhatsAppWindow(w)
          return `${role}:"${w.title}" ${w.className ?? ''} host=${w.hostProcess ?? '?'}`
        })
        .join('; ')}`
    )
  } else {
    parts.push('windows: none matching WhatsApp')
  }
  if (result.diagnostics?.foregroundVerified) parts.push('foreground=verified')
  else if (result.diagnostics?.focusAttempts) parts.push('foreground=not_verified')
  if (result.diagnostics?.launchMethodsTried.length) {
    parts.push(`activation: ${result.diagnostics.launchMethodsTried.join(' → ')}`)
  }
  const notes = result.diagnostics?.launchNotes?.join('; ')
  if (notes) parts.push(notes)
  return parts.join(' · ')
}

export function containsTechnicalWhatsAppDiagnostics(text: string): boolean {
  return (
    /\bAUMID\b/i.test(text) ||
    /\bhwnd=/i.test(text) ||
    /HRESULT/i.test(text) ||
    /\bprocesses:/i.test(text) ||
    /WhatsApp\.Root\(\d+\)/i.test(text) ||
    /helpers only/i.test(text) ||
    /state=launcher/i.test(text) ||
    /\bactivation:/i.test(text) ||
    /className=/i.test(text) ||
    /foreground=not_verified/i.test(text)
  )
}

export function sanitizeWhatsAppUserError(raw: string | undefined): string {
  if (!raw?.trim()) {
    return "Couldn't open WhatsApp. Try opening it manually from the Start menu."
  }
  const line = raw.split('\n')[0].trim()
  if (containsTechnicalWhatsAppDiagnostics(line) || line.length > 160) {
    return "Couldn't open WhatsApp. Try opening it manually from the Start menu."
  }
  return line
}

/** User-facing chat copy only — no AUMIDs, HWNDs, or probe dumps. */
export function formatWhatsAppLaunchMessage(result: WhatsAppLaunchResult): string {
  if (
    result.stage === 'window_confirmed' &&
    result.diagnostics?.foregroundVerified
  ) {
    return 'WhatsApp is open and in the foreground.'
  }
  if (result.stage === 'window_confirmed') {
    return "WhatsApp looks open, but FRIDAY couldn't bring it to the front. Check the taskbar or Alt+Tab."
  }
  if (result.stage === 'process_detected') {
    return "WhatsApp appears to be running, but FRIDAY couldn't confirm its window. Check your desktop or taskbar."
  }
  if (result.stage === 'launch_requested') {
    return "FRIDAY tried to open WhatsApp, but nothing showed up. Try opening WhatsApp manually once, then ask again."
  }
  if (result.stage === 'failed') {
    return sanitizeWhatsAppUserError(result.error)
  }
  return sanitizeWhatsAppUserError(result.error)
}

export function logWhatsAppLaunchDiagnostics(result: WhatsAppLaunchResult): void {
  console.info('[friday:whatsapp:launch]', buildDiagnosticsSummary(result))
}

/** Hard failure — show red error in UI. Soft outcomes use ok: true with honest status text. */
export function isWhatsAppLaunchHardFailure(result: WhatsAppLaunchResult): boolean {
  if (result.stage === 'failed') return true
  if (result.stage === 'launch_requested') {
    return (result.probe?.processes.length ?? 0) === 0
  }
  return false
}

export async function discoverWhatsAppStartApp(
  runPowerShell: PowerShellRunner
): Promise<WhatsAppStartAppEntry | null> {
  const output = await runPowerShell(DISCOVER_WHATSAPP_START_APP_SCRIPT)
  return parseDiscoverWhatsAppOutput(output)
}

export async function probeWhatsAppRuntime(
  runPowerShell: PowerShellRunner
): Promise<WhatsAppRuntimeProbe> {
  const output = await runPowerShell(WHATSAPP_PROBE_SCRIPT)
  return parseWhatsAppProbeOutput(output)
}

export interface WhatsAppLaunchOptions {
  runPowerShell: PowerShellRunner
  sleep?: (ms: number) => Promise<void>
  launcherPollAttempts?: number
  launcherPollIntervalMs?: number
  coldPollAttempts?: number
  coldPollIntervalMs?: number
}

function logWhatsAppTrace(diagnostics: WhatsAppLaunchDiagnostics, entry: WhatsAppTraceEntry): void {
  diagnostics.trace.push(entry)
  console.info(
    '[friday:whatsapp:trace]',
    entry.event,
    `windows=${entry.windows}`,
    `processes=${entry.processes}`,
    entry.detail ?? ''
  )
}

async function tryActivateWindow(
  runPowerShell: PowerShellRunner,
  diagnostics: WhatsAppLaunchDiagnostics,
  detail: string,
  probe: WhatsAppRuntimeProbe
): Promise<WhatsAppFocusResult> {
  diagnostics.focusAttempts += 1
  try {
    const out = await runPowerShell(buildFocusWhatsAppScript())
    const parsed = parseFocusOutput(out)
    if (parsed.foregroundVerified) {
      diagnostics.activationFocused = true
      diagnostics.foregroundVerified = true
    }
    logWhatsAppTrace(diagnostics, {
      event: 'focus',
      windows: probe.presentableWindows.length,
      processes: probe.processes.length,
      detail: `${detail} verified=${parsed.foregroundVerified} sfw=${parsed.setForegroundReturned} target=${parsed.targetHandle ?? 0} fg=${parsed.foregroundHandle ?? 0} err=${parsed.error ?? 'none'} sample=${parsed.sample ?? 'n/a'}`
    })
    return parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logWhatsAppTrace(diagnostics, {
      event: 'focus',
      windows: probe.presentableWindows.length,
      processes: probe.processes.length,
      detail: `${detail} ps_error=${message}`
    })
    return {
      ok: false,
      foregroundVerified: false,
      setForegroundReturned: false,
      windowCount: 0,
      candidateCount: 0,
      error: message
    }
  }
}

async function runProbe(
  runPowerShell: PowerShellRunner,
  diagnostics: WhatsAppLaunchDiagnostics,
  detail: string
): Promise<WhatsAppRuntimeProbe> {
  try {
    const probe = await probeWhatsAppRuntime(runPowerShell)
    const helpers = probe.visibleWindows.length - probe.presentableWindows.length
    logWhatsAppTrace(diagnostics, {
      event: 'probe',
      windows: probe.presentableWindows.length,
      processes: probe.processes.length,
      detail: `${detail} helpers=${helpers} candidates=${probe.visibleWindows.length}`
    })
    return probe
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logWhatsAppTrace(diagnostics, {
      event: 'probe',
      windows: 0,
      processes: 0,
      detail: `${detail} ps_error=${message}`
    })
    return enrichProbe({ processes: [], visibleWindows: [], presentableWindows: [] })
  }
}

async function activateViaAumid(
  runPowerShell: PowerShellRunner,
  diagnostics: WhatsAppLaunchDiagnostics,
  entry: WhatsAppStartAppEntry,
  label: string
): Promise<{ ok: boolean; method: 'application_activation' | 'apps_folder' }> {
  diagnostics.launchMethodsTried.push(`${label}_application_activation`)
  diagnostics.launchCount += 1
  logWhatsAppTrace(diagnostics, {
    event: 'launch',
    windows: 0,
    processes: 0,
    detail: `aumid_activate_${label}`
  })
  const actOut = await runPowerShell(buildApplicationActivateScript(entry.appId))
  const act = parseActivationOutput(actOut)
  diagnostics.launchNotes.push(`${label}_hr=${act.hr ?? 'n/a'} pid=${act.pid ?? 'n/a'} err=${act.error ?? 'none'}`)

  if (act.ok) return { ok: true, method: 'application_activation' }

  diagnostics.launchMethodsTried.push(`${label}_apps_folder_fallback`)
  diagnostics.launchCount += 1
  logWhatsAppTrace(diagnostics, {
    event: 'recovery',
    windows: 0,
    processes: 0,
    detail: `apps_folder_after_hr_${act.hr ?? 'fail'}`
  })
  await runPowerShell(buildLaunchStoreAppScript(entry.appId))
  return { ok: true, method: 'apps_folder' }
}

async function pollForPresentableWindow(
  runPowerShell: PowerShellRunner,
  diagnostics: WhatsAppLaunchDiagnostics,
  wait: (ms: number) => Promise<void>,
  attempts: number,
  intervalMs: number,
  label: string
): Promise<WhatsAppRuntimeProbe> {
  let probe: WhatsAppRuntimeProbe = enrichProbe({
    processes: [],
    visibleWindows: [],
    presentableWindows: []
  })
  for (let i = 0; i < attempts; i++) {
    diagnostics.pollRounds = i + 1
    await wait(intervalMs)
    probe = await runProbe(runPowerShell, diagnostics, `${label}_${i + 1}`)
    if (probe.presentableWindows.length > 0) return probe
  }
  return probe
}

function finalizeWhatsAppLaunchResult(
  partial: Omit<WhatsAppLaunchResult, 'ok' | 'message'> & { stage: WhatsAppLaunchStage }
): WhatsAppLaunchResult {
  const draft: WhatsAppLaunchResult = { ...partial, ok: false, message: '' }
  if (isWhatsAppLaunchHardFailure(draft)) {
    draft.ok = false
  } else if (partial.stage === 'process_detected' || partial.stage === 'window_confirmed') {
    draft.ok = true
  }
  const result = { ...draft, message: formatWhatsAppLaunchMessage(draft) }
  logWhatsAppLaunchDiagnostics(result)
  return result
}

function failureResult(
  partial: Omit<WhatsAppLaunchResult, 'ok' | 'message'> & { stage: WhatsAppLaunchStage }
): WhatsAppLaunchResult {
  return finalizeWhatsAppLaunchResult(partial)
}

function successResult(
  partial: Omit<WhatsAppLaunchResult, 'ok' | 'message'> & { stage: 'window_confirmed' }
): WhatsAppLaunchResult {
  const result: WhatsAppLaunchResult = {
    ...partial,
    ok: true,
    message: formatWhatsAppLaunchMessage({ ...partial, ok: true, message: '' })
  }
  logWhatsAppLaunchDiagnostics(result)
  return result
}

async function focusPresentableOrFail(
  runPowerShell: PowerShellRunner,
  diagnostics: WhatsAppLaunchDiagnostics,
  probe: WhatsAppRuntimeProbe,
  detail: string
): Promise<{ probe: WhatsAppRuntimeProbe; focus: WhatsAppFocusResult }> {
  if (probe.presentableWindows.length === 0) {
    return {
      probe,
      focus: {
        ok: false,
        foregroundVerified: false,
        setForegroundReturned: false,
        windowCount: 0,
        candidateCount: 0,
        error: 'no_presentable_window'
      }
    }
  }
  const focus = await tryActivateWindow(runPowerShell, diagnostics, detail, probe)
  const after = await runProbe(runPowerShell, diagnostics, `${detail}_after_probe`)
  return { probe: after, focus }
}

export async function launchWhatsAppDesktop(
  options: WhatsAppLaunchOptions
): Promise<WhatsAppLaunchResult> {
  const runPowerShell = options.runPowerShell
  const wait = options.sleep ?? sleep
  const pollAttempts =
    options.coldPollAttempts ?? options.launcherPollAttempts ?? COLD_START_POLL_ATTEMPTS
  const pollIntervalMs =
    options.coldPollIntervalMs ?? options.launcherPollIntervalMs ?? COLD_START_POLL_MS

  const diagnostics: WhatsAppLaunchDiagnostics = {
    launchMethodsTried: [],
    launchNotes: [],
    activationFocused: false,
    foregroundVerified: false,
    focusAttempts: 0,
    launchCount: 0,
    pollRounds: 0,
    trace: []
  }

  const entry = await discoverWhatsAppStartApp(runPowerShell)
  const aumid = entry?.appId
  diagnostics.aumid = aumid

  let probe = await runProbe(runPowerShell, diagnostics, 'initial')
  const initialState = classifyWhatsAppState(probe)
  logWhatsAppTrace(diagnostics, {
    event: 'state',
    windows: probe.presentableWindows.length,
    processes: probe.processes.length,
    detail: `${initialState} helpers=${probe.visibleWindows.length - probe.presentableWindows.length}`
  })

  let launchMethod: WhatsAppLaunchResult['launchMethod'] = 'application_activation'
  const hadExistingInstance = probe.processes.length > 0

  if (entry) {
    try {
      const activated = await activateViaAumid(runPowerShell, diagnostics, entry, 'open')
      launchMethod = activated.method
    } catch (err) {
      return failureResult({
        stage: 'failed',
        aumid,
        runtimeState: initialState,
        error: err instanceof Error ? err.message : String(err),
        probe,
        diagnostics
      })
    }
  } else {
    diagnostics.launchCount = 1
    diagnostics.launchMethodsTried.push('protocol_open')
    launchMethod = 'protocol'
    try {
      await runPowerShell(buildLaunchProtocolScript())
    } catch (err) {
      return failureResult({
        stage: 'failed',
        aumid,
        runtimeState: 'not_running',
        error: err instanceof Error ? err.message : String(err),
        probe,
        diagnostics
      })
    }
  }

  probe = await pollForPresentableWindow(
    runPowerShell,
    diagnostics,
    wait,
    pollAttempts,
    pollIntervalMs,
    'presentable_poll'
  )

  let { probe: afterFocus, focus } = await focusPresentableOrFail(
    runPowerShell,
    diagnostics,
    probe,
    'after_aumid'
  )
  probe = afterFocus

  if (!focus.foregroundVerified && entry && probe.presentableWindows.length > 0) {
    diagnostics.launchNotes.push('foreground_blocked_trying_aumid_once_more')
    try {
      await activateViaAumid(runPowerShell, diagnostics, entry, 'foreground_fallback')
      await wait(350)
      const retry = await focusPresentableOrFail(runPowerShell, diagnostics, probe, 'after_aumid_retry')
      probe = retry.probe
      focus = retry.focus
    } catch (err) {
      diagnostics.launchNotes.push(`foreground_fallback_error=${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (probe.presentableWindows.length > 0 && focus.foregroundVerified) {
    return successResult({
      stage: 'window_confirmed',
      hadExistingInstance,
      launchMethod: diagnostics.focusAttempts > 0 && diagnostics.launchCount === 0 ? 'focus_only' : launchMethod,
      aumid,
      runtimeState: 'window_visible',
      probe,
      diagnostics
    })
  }

  if (probe.presentableWindows.length > 0) {
    diagnostics.launchNotes.push(
      `focus_target=${focus.targetHandle ?? 'n/a'} fg=${focus.foregroundHandle ?? 'n/a'} sfw=${focus.setForegroundReturned}`
    )
    return failureResult({
      stage: 'window_confirmed',
      aumid,
      hadExistingInstance,
      launchMethod,
      runtimeState: 'window_visible',
      probe,
      diagnostics,
      error: focus.error ?? 'foreground_not_verified'
    })
  }

  const finalState = classifyWhatsAppState(probe)
  return failureResult({
    stage: classifyWhatsAppFailureStage(probe),
    aumid,
    hadExistingInstance,
    launchMethod,
    runtimeState: finalState,
    probe,
    diagnostics
  })
}
