import { useState } from 'react'

const ACTIONS: { id: string; label: string; icon: string }[] = [
  { id: 'youtube', label: 'Open YouTube', icon: '▶' },
  { id: 'whatsapp', label: 'Open WhatsApp', icon: '✉' },
  { id: 'search_web', label: 'Search the web', icon: '⌕' },
  { id: 'explain_code', label: 'Explain code', icon: '</>' },
  { id: 'write_note', label: 'Write a note', icon: '✎' },
  { id: 'more', label: 'More', icon: '⋯' }
]

export type QuickActionResult = {
  ok: boolean
  message: string
  composerPrefill?: string
  openMore?: boolean
}

export function QuickActions({
  disabled,
  onRun
}: {
  disabled: boolean
  onRun: (id: string) => Promise<QuickActionResult>
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  return (
    <div className="flex flex-nowrap justify-center gap-2 px-3 w-full max-w-5xl mx-auto pb-2 overflow-x-auto">
      {ACTIONS.map((a) => {
        const loading = loadingId === a.id
        return (
          <button
            key={a.id}
            type="button"
            disabled={disabled || loadingId !== null}
            onClick={() => {
              setLoadingId(a.id)
              void onRun(a.id)
                .catch((err) => ({
                  ok: false,
                  message: err instanceof Error ? err.message : String(err)
                }))
                .finally(() => setLoadingId(null))
            }}
            className="flex items-center justify-center gap-2 shrink-0 min-w-[132px] px-3 py-2.5 rounded-md border border-[#28CFFF]/22 bg-[#050c14]/90 text-[10px] text-slate-400 hover:text-[#8BDFFF] hover:border-[#28CFFF]/40 hover:shadow-[0_0_14px_rgba(40,207,255,0.14)] disabled:opacity-40 transition-all"
          >
            <span className="text-[#28CFFF] text-xs w-4 text-center">{loading ? '…' : a.icon}</span>
            {a.label}
          </button>
        )
      })}
    </div>
  )
}
