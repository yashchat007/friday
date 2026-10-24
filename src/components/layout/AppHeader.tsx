import { FridayEmblem } from './FridayEmblem'
import { WindowControls } from './WindowControls'

export function AppHeader() {
  const now = new Date()
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const date = now
    .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase()

  return (
    <header className="shrink-0 flex items-center justify-between px-4 md:px-6 py-3 border-b border-[#28CFFF]/20 bg-[#020508]/80 backdrop-blur-sm">
      <div className="flex items-center gap-4 min-w-0">
        <FridayEmblem size={36} />
        <div className="min-w-0">
          <h1 className="text-[13px] md:text-sm tracking-[0.55em] text-[#8BDFFF] font-medium truncate">
            F R I D A Y
          </h1>
          <p className="text-[9px] tracking-[0.22em] text-slate-600 mt-0.5 hidden sm:block">
            YOUR PERSONAL AI ASSISTANT
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right text-[10px] tracking-wider text-slate-500 hidden sm:block">
          <div className="text-[#28CFFF] text-base font-light tabular-nums">{time}</div>
          <div className="mt-0.5 text-[9px]">{date}</div>
        </div>
        <WindowControls />
      </div>
    </header>
  )
}
