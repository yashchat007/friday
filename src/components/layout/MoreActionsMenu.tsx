export function MoreActionsMenu({
  open,
  onClose,
  onSettings,
  onToggleSpeech,
  speechOn
}: {
  open: boolean
  onClose: () => void
  onSettings: () => void
  onToggleSpeech: () => void
  speechOn: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center pb-28 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[#28CFFF]/20 bg-[#0a1219]/95 p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] tracking-widest text-slate-500 mb-2">MORE ACTIONS</p>
        <ul className="space-y-1 text-sm">
          <li>
            <button type="button" className="w-full text-left px-3 py-2 rounded hover:bg-white/5" onClick={onSettings}>
              Settings
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/5"
              onClick={() => {
                onToggleSpeech()
                onClose()
              }}
            >
              Voice output: {speechOn ? 'On' : 'Off'}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/5"
              onClick={() => void window.friday.toggleOverlay().then(onClose)}
            >
              Particle overlay
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
