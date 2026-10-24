import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../../shared/types/ipc'
import { FridayEmblem } from '../layout/FridayEmblem'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function ChatTranscript({
  messages,
  streaming,
  progress,
  systemLines
}: {
  messages: ChatMessage[]
  streaming: string
  progress?: string | null
  systemLines?: string[]
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const [expandedError, setExpandedError] = useState<string | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, streaming, progress, systemLines?.length])

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 min-h-0">
      {systemLines?.map((line, i) => (
        <p
          key={`sys-${i}`}
          className={`text-[11px] leading-relaxed rounded-md px-3 py-2 border ${
            line.startsWith('Error:')
              ? 'text-rose-200/90 border-rose-500/20 bg-rose-950/20'
              : 'text-[#8BDFFF]/80 border-[#28CFFF]/15 bg-[#28CFFF]/5'
          }`}
        >
          {line}
        </p>
      ))}
      {messages.length === 0 && !streaming && !progress && !systemLines?.length && (
        <p className="text-sm text-slate-600 text-center py-10">Ask FRIDAY anything…</p>
      )}
      {messages.map((m) => {
        const isUser = m.role === 'user'
        const isError = m.role === 'assistant' && m.content.startsWith('Error:')
        const short = isError && m.content.length > 180 && expandedError !== m.id
        return (
          <div key={m.id} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <FridayEmblem size={22} />}
            <div className={`max-w-[88%] ${isUser ? 'text-right' : ''}`}>
              <div
                className={`inline-block text-left rounded-lg px-3 py-2 text-[13px] leading-relaxed border ${
                  isUser
                    ? 'bg-[rgba(12,28,48,0.92)] border-[#28CFFF]/15 text-slate-100'
                    : 'bg-[rgba(8,12,20,0.88)] border-white/[0.06] text-slate-300'
                }`}
              >
                {short ? `${m.content.slice(0, 180)}…` : m.content}
                {isError && m.content.length > 180 && (
                  <button
                    type="button"
                    className="block mt-1 text-[10px] text-[#8BDFFF] underline"
                    onClick={() => setExpandedError(expandedError === m.id ? null : m.id)}
                  >
                    {expandedError === m.id ? 'Hide details' : 'Show details'}
                  </button>
                )}
              </div>
              <div className="text-[9px] text-slate-600 mt-1 tabular-nums">{formatTime(m.createdAt)}</div>
            </div>
          </div>
        )
      })}
      {(streaming || progress) && (
        <div className="flex gap-2 items-start">
          <FridayEmblem size={22} />
          <p className="text-[13px] text-slate-500 max-w-[88%]">{streaming || progress}</p>
        </div>
      )}
      <div ref={endRef} className="h-px shrink-0" aria-hidden />
    </div>
  )
}
