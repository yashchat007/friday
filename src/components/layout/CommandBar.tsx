import { useEffect, useState } from 'react'
import type { FridayVisualSnapshot } from '../../../shared/agent-visual-state'
import { StatusIndicator } from './StatusIndicator'

export function CommandBar({
  disabled,
  busy,
  visual,
  listening,
  taskProgress,
  micSupported,
  speechOn,
  prefill,
  onPrefillConsumed,
  onToggleSpeech,
  onSend,
  onToggleMic,
  onCancel
}: {
  disabled: boolean
  busy: boolean
  visual: FridayVisualSnapshot
  listening: boolean
  taskProgress: string | null
  micSupported: boolean
  speechOn: boolean
  prefill?: string
  onPrefillConsumed?: () => void
  onToggleSpeech: () => void
  onSend: (text: string) => void
  onToggleMic: () => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (prefill) {
      setText(prefill)
      onPrefillConsumed?.()
    }
  }, [prefill, onPrefillConsumed])

  return (
    <div className="shrink-0 w-full max-w-2xl mx-auto px-4">
      <StatusIndicator visual={visual} listening={listening} busy={busy} progress={taskProgress} />
      <form
        className="mt-2 flex items-center gap-2 rounded-full border border-[#28CFFF]/15 bg-[#0a1219]/90 px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          onSend(text)
          setText('')
        }}
      >
        <button
          type="button"
          disabled={!micSupported || disabled}
          onClick={onToggleMic}
          aria-label="Voice input"
          className={`shrink-0 h-9 w-9 rounded-full text-[10px] border transition-colors ${
            listening
              ? 'text-[#28CFFF] border-[#28CFFF]/40 bg-[#28CFFF]/10'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Mic
        </button>
        <input
          className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
          placeholder="Ask FRIDAY anything…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggleSpeech}
          className="hidden sm:block text-[9px] tracking-wider text-slate-600 hover:text-slate-400 px-2"
        >
          TTS
        </button>
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-full px-4 py-2 text-xs text-slate-400 hover:text-rose-300"
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="shrink-0 h-9 w-9 rounded-full text-slate-950 bg-[#28CFFF] hover:bg-[#8BDFFF] disabled:opacity-30 text-xs font-medium"
            title="Send"
          >
            →
          </button>
        )}
      </form>
      {!speechOn && (
        <p className="text-[9px] text-slate-600 text-center mt-1">Speech output off — enable in sidebar or TTS</p>
      )}
    </div>
  )
}
