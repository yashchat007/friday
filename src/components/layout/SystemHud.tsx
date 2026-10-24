import { useEffect, useState } from 'react'
import type { FridaySettings, SystemMetricsSnapshot } from '../../../shared/types/ipc'

function Ring({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0
  const r = 18
  const c = 2 * Math.PI * r
  const dash = value == null ? 0 : (pct / 100) * c
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="44" height="44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#28CFFF"
          strokeWidth="3"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          opacity={value == null ? 0.2 : 0.85}
        />
      </svg>
      <span className="text-[9px] tracking-widest text-slate-500">{label}</span>
      <span className="text-[10px] text-[#8BDFFF] tabular-nums">
        {value == null ? '—' : `${Math.round(value)}%`}
      </span>
    </div>
  )
}

export function SystemHud({ settings }: { settings: FridaySettings | null }) {
  const [metrics, setMetrics] = useState<SystemMetricsSnapshot | null>(null)

  useEffect(() => {
    const tick = () => void window.friday.getSystemMetrics().then(setMetrics)
    tick()
    const id = window.setInterval(tick, 4000)
    return () => window.clearInterval(id)
  }, [])

  const location = settings?.locationLabel?.trim()

  return (
    <aside className="hidden xl:flex flex-col items-center gap-5 py-8 pr-4 pl-2 text-center pointer-events-none">
      <Ring label="CPU" value={metrics?.cpuPercent ?? null} />
      <Ring label="RAM" value={metrics?.ramPercent ?? null} />
      <div className="text-[9px] tracking-widest text-slate-600">
        NET
        <div className="text-[10px] text-slate-500 mt-1">—</div>
      </div>
      {location ? (
        <div className="text-[9px] tracking-widest text-slate-600 max-w-[72px]">
          LOCATION
          <div className="text-[10px] text-slate-400 mt-1 leading-tight">{location}</div>
        </div>
      ) : null}
      {settings?.weatherApiKey && settings.weatherCity ? (
        <div className="text-[9px] text-slate-600">WEATHER</div>
      ) : (
        <div className="text-[9px] text-slate-700">WEATHER —</div>
      )}
    </aside>
  )
}
