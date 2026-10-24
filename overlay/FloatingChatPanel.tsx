import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApprovalRequest } from '../shared/types/ipc'

type PanelProps = {
  open: boolean
  busy: boolean
  streaming: string
  taskProgress: string | null
  messages: Array<{ role: string; content: string }>
  approval: ApprovalRequest | null
  onSend: (text: string) => void
  onCancel: () => void
  onApprove: (id: string, ok: boolean) => void
  onClose: () => void
}

export function FloatingChatPanel({
  open,
  busy,
  streaming,
  taskProgress,
  messages,
  approval,
  onSend,
  onCancel,
  onApprove,
  onClose
}: PanelProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text || busy) return
    onSend(text)
    setDraft('')
  }, [busy, draft, onSend])

  if (!open) return null

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const tail = streaming || lastAssistant?.content || ''

  return (
    <div
      className="orb-panel no-drag w-full rounded-2xl border border-cyan-500/25 bg-slate-950/92 backdrop-blur-xl shadow-[0_12px_48px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden"
      style={{ height: 400, width: '100%', maxWidth: 380 }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-xs text-slate-400">
        <span>{busy ? taskProgress ?? 'Working…' : 'FRIDAY'}</span>
        <div className="flex gap-2">
          {busy ? (
            <button type="button" className="text-amber-300 hover:text-amber-200" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose} aria-label="Collapse">
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 text-sm text-slate-200 whitespace-pre-wrap">
        {tail ? tail.slice(0, 4000) : <span className="text-slate-500">Ask FRIDAY anything…</span>}
      </div>

      {approval ? (
        <div className="mx-2 mb-2 rounded-lg border border-amber-500/40 bg-amber-950/40 p-2 text-xs">
          <p className="text-amber-100 font-medium mb-1">{approval.summary}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded bg-cyan-600 text-white"
              onClick={() => onApprove(approval.id, true)}
            >
              Allow
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-700 text-slate-200"
              onClick={() => onApprove(approval.id, false)}
            >
              Deny
            </button>
          </div>
        </div>
      ) : null}

      <div className="p-2 border-t border-white/10">
        <textarea
          ref={inputRef}
          className="w-full resize-none rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/50"
          rows={2}
          placeholder="Message FRIDAY…"
          value={draft}
          disabled={busy && !streaming}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          className="mt-1 w-full rounded-lg bg-cyan-600/90 hover:bg-cyan-500 disabled:opacity-40 text-sm py-1.5 text-white font-medium"
          onClick={submit}
        >
          Send
        </button>
      </div>
    </div>
  )
}
