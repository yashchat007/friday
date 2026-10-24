import type { FridayVisualSnapshot } from '../../../shared/agent-visual-state'

const STATES = [
  { id: 'listening', label: 'LISTENING' },
  { id: 'thinking', label: 'THINKING' },
  { id: 'task', label: 'EXECUTING' },
  { id: 'speaking', label: 'SPEAKING' },
  { id: 'idle', label: 'READY' }
] as const

export function SphereStateColumn({
  visual,
  listening,
  busy
}: {
  visual: FridayVisualSnapshot
  listening: boolean
  busy: boolean
}) {
  const active =
    visual.state === 'error'
      ? 'error'
      : listening
        ? 'listening'
        : visual.state === 'task'
          ? 'task'
          : visual.state === 'speaking'
            ? 'speaking'
            : busy || visual.state === 'thinking'
              ? 'thinking'
              : 'idle'

  return (
    <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 text-[10px] tracking-[0.25em] pointer-events-none select-none">
      {STATES.map((s) => {
        const on = active === s.id || (s.id === 'thinking' && active === 'error')
        return (
          <span
            key={s.id}
            className={
              on ? 'text-[#28CFFF] drop-shadow-[0_0_8px_rgba(40,207,255,0.35)]' : 'text-slate-700'
            }
          >
            {s.label}
          </span>
        )
      })}
      {visual.state === 'error' && (
        <span className="text-rose-400/80 tracking-[0.2em]">ERROR</span>
      )}
    </div>
  )
}
