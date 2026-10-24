import { spawn } from 'node:child_process'

/**
 * PowerShell: terminate only processes whose ExecutablePath matches FRIDAY's electron.exe
 * and that are the root PID or descendants of it in the process tree.
 */
export function buildFridayElectronTreeKillScript(rootPid: number, executablePath: string): string {
  const exe = executablePath.replace(/'/g, "''")
  return `
$root = ${rootPid}
$exe = '${exe}'
$toKill = New-Object System.Collections.Generic.HashSet[int]
function Add-Tree([int]$pid) {
  if ($toKill.Contains($pid)) { return }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pid" -ErrorAction SilentlyContinue
  if (-not $proc) { return }
  if ($proc.ExecutablePath -ne $exe) { return }
  [void]$toKill.Add($pid)
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$pid" -ErrorAction SilentlyContinue |
    ForEach-Object { Add-Tree $_.ProcessId }
}
Get-CimInstance Win32_Process -Filter "ParentProcessId=$root" -ErrorAction SilentlyContinue |
  ForEach-Object { Add-Tree $_.ProcessId }
$killed = 0
foreach ($id in $toKill) {
  try {
    Stop-Process -Id $id -Force -ErrorAction Stop
    $killed++
  } catch { }
}
Write-Output $killed
`.trim()
}

export function runPowerShellScript(script: string): Promise<string> {
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

export async function terminateFridayOwnedElectronTree(
  rootPid: number,
  executablePath: string,
  timeoutMs = 5000
): Promise<number> {
  if (process.platform !== 'win32') return 0
  const script = buildFridayElectronTreeKillScript(rootPid, executablePath)
  const run = runPowerShellScript(script)
  const result = await Promise.race([
    run,
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('FRIDAY process cleanup timed out')), timeoutMs)
    )
  ]).catch(() => '0')
  const n = Number.parseInt(result, 10)
  return Number.isFinite(n) ? n : 0
}
