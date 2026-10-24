import type { ReactNode } from 'react'

export function WindowControls() {
  return (
    <div className="flex items-center gap-1 pointer-events-auto">
      <WinBtn label="Hide to tray" onClick={() => window.friday.hideToTray()}>—</WinBtn>
      <WinBtn label="Maximize" onClick={() => window.friday.windowMaximize()}>□</WinBtn>
      <WinBtn label="Close" onClick={() => window.friday.windowClose()} className="hover:text-rose-300">
        ×
      </WinBtn>
    </div>
  )
}

function WinBtn({
  label,
  onClick,
  children,
  className = ''
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`h-7 w-8 text-xs text-slate-500 hover:text-[#8BDFFF] transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
