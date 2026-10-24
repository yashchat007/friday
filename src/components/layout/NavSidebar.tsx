import type { ReactNode } from 'react'

export type FridayNavId = 'chat' | 'settings'

export function NavSidebar({
  active,
  onNavigate,
  speechOn,
  online
}: {
  active: FridayNavId
  onNavigate: (id: FridayNavId) => void
  speechOn: boolean
  online: boolean
}) {
  return (
    <aside className="w-[4.75rem] shrink-0 flex flex-col items-center py-4 gap-4 border-r border-[#28CFFF]/10 bg-[#020508]/95">
      <div
        className="h-7 w-7 rounded-full border border-[#28CFFF]/20 bg-gradient-to-br from-[#28CFFF]/20 to-violet-600/20"
        title="FRIDAY"
      />
      <nav className="flex flex-col gap-3 items-center">
        <NavItem active={active === 'chat'} label="CHAT" onClick={() => onNavigate('chat')}>
          ◎
        </NavItem>
        <NavItem active={active === 'settings'} label="SET" onClick={() => onNavigate('settings')}>
          ⚙
        </NavItem>
      </nav>
      <div className="mt-auto flex flex-col items-center gap-4 pb-2">
        <div className="text-[8px] tracking-widest text-slate-600 text-center">
          VOICE
          <div className={speechOn ? 'text-[#28CFFF]/80' : 'text-slate-700'}>{speechOn ? 'ON' : 'OFF'}</div>
        </div>
        <div className="flex items-center gap-1.5 text-[8px] tracking-widest text-slate-600">
          <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500/80' : 'bg-slate-600'}`} />
          ONLINE
        </div>
      </div>
    </aside>
  )
}

function NavItem({
  active,
  label,
  onClick,
  children
}: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${
        active ? 'text-[#28CFFF]' : 'text-slate-600 hover:text-slate-400'
      }`}
    >
      <span
        className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs ${
          active ? 'bg-[#28CFFF]/10 shadow-[0_0_12px_rgba(40,207,255,0.15)]' : ''
        }`}
      >
        {children}
      </span>
      <span className="text-[8px] tracking-widest">{label}</span>
    </button>
  )
}
