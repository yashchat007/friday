import { useCallback, useEffect, useState } from 'react'
import type { UserMemoryFact } from '../../../shared/types/ipc'

export function PersonalMemoryPanel() {
  const [facts, setFacts] = useState<UserMemoryFact[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const reload = useCallback(() => {
    void window.friday.getMemories().then(setFacts)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <div className="space-y-3 pt-2 border-t border-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-slate-300 text-sm font-medium">Personal memory</h3>
        <button
          type="button"
          className="text-[11px] text-slate-500 hover:text-rose-300"
          onClick={() => {
            if (facts.length === 0) return
            if (!confirm('Clear all saved personal facts? Chat history for this session is kept.')) return
            void window.friday.clearMemories().then(reload)
          }}
        >
          Clear all facts
        </button>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Long-term facts FRIDAY may use across sessions. Not shown in chat. Say &quot;don&apos;t remember that&quot; to
        drop matching facts.
      </p>
      {facts.length === 0 ? (
        <p className="text-xs text-slate-600">No saved facts yet. Use /remember … or share preferences in chat.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {facts.map((f) => (
            <li key={f.id} className="flex gap-2 items-start text-xs">
              {editingId === f.id ? (
                <>
                  <input
                    className="flex-1 rounded-md bg-black/40 border border-white/10 px-2 py-1 text-slate-200"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="text-cyan-400 shrink-0"
                    onClick={() => {
                      void window.friday.updateMemory(f.id, draft).then((ok) => {
                        if (ok) {
                          setEditingId(null)
                          reload()
                        }
                      })
                    }}
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-slate-400 leading-relaxed">{f.fact}</span>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-300 shrink-0"
                    onClick={() => {
                      setEditingId(f.id)
                      setDraft(f.fact)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-rose-300 shrink-0"
                    onClick={() => void window.friday.deleteMemory(f.id).then(reload)}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="text-[11px] text-slate-500 hover:text-slate-300 underline"
        onClick={() => {
          if (!confirm('Clear visible chat for this session only?')) return
          void window.friday.clearSession().then(() => window.location.reload())
        }}
      >
        Clear this session&apos;s chat
      </button>
    </div>
  )
}
