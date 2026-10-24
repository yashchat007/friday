import type { FridayVisualSnapshot } from '../../../shared/agent-visual-state'

export function StatusIndicator({
  visual,
  listening,
  busy,
  progress
}: {
  visual: FridayVisualSnapshot
  listening: boolean
  busy: boolean
  progress: string | null
}) {
  if (!listening && !busy && !progress && visual.state === 'idle') {
    return null
  }

  let label = ''
  let tone = 'text-slate-500'

  if (visual.state === 'error') {
    label = 'Error'
    tone = 'text-rose-300/80'
  } else if (listening) {
    label = 'Listening'
    tone = 'text-cyan-400/90'
  } else if (visual.state === 'speaking') {
    label = 'Speaking'
    tone = 'text-violet-300/90'
  } else if (visual.state === 'task') {
    label = 'Working'
    tone = 'text-cyan-300/90'
  } else if (busy || visual.state === 'thinking') {
    label = 'Thinking'
    tone = 'text-slate-400'
  }

  const dot =
    visual.state === 'error'
      ? 'bg-rose-400/70'
      : listening || visual.state === 'task'
        ? 'bg-cyan-400/80'
        : visual.state === 'speaking'
          ? 'bg-violet-400/80'
          : busy
            ? 'bg-slate-400/60'
            : 'bg-slate-600/50'

  return (
    <div className="flex items-center gap-2 text-[11px] tracking-wide">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className={tone}>{label}</span>
      {progress && <span className="text-slate-600 truncate max-w-[min(280px,40vw)]">· {progress}</span>}
    </div>
  )
}
