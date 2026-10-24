import os from 'node:os'

export interface SystemMetricsSnapshot {
  cpuPercent: number | null
  ramPercent: number | null
  ramUsedGb: number | null
  ramTotalGb: number | null
  netMbps: number | null
  unavailable?: string[]
}

let lastCpu = process.cpuUsage()
let lastCpuAt = Date.now()

function sampleCpuPercent(): number {
  const now = Date.now()
  const elapsed = Math.max(1, now - lastCpuAt)
  const usage = process.cpuUsage(lastCpu)
  lastCpu = process.cpuUsage()
  lastCpuAt = now
  const micros = usage.user + usage.system
  const cores = os.cpus().length || 1
  const percent = (micros / 1000 / elapsed / cores) * 100
  return Math.min(100, Math.round(percent * 10) / 10)
}

export function readSystemMetrics(): SystemMetricsSnapshot {
  const unavailable: string[] = []
  let cpuPercent: number | null = null
  let ramPercent: number | null = null
  let ramUsedGb: number | null = null
  let ramTotalGb: number | null = null

  try {
    cpuPercent = sampleCpuPercent()
  } catch {
    unavailable.push('cpu')
  }

  try {
    const total = os.totalmem()
    const free = os.freemem()
    const used = total - free
    ramTotalGb = Math.round((total / 1e9) * 10) / 10
    ramUsedGb = Math.round((used / 1e9) * 10) / 10
    ramPercent = Math.round((used / total) * 100)
  } catch {
    unavailable.push('ram')
  }

  return {
    cpuPercent,
    ramPercent,
    ramUsedGb,
    ramTotalGb,
    netMbps: null,
    unavailable: unavailable.length ? unavailable : undefined
  }
}
