import { useState } from 'react'

export function ChatComposer({
  disabled,
  onSend,
  modelLabel
}: {
  disabled: boolean
  onSend: (text: string) => void
  modelLabel: string
}) {
  const [text, setText] = useState('')

  return (
    <form
      className="p-4 border-t border-white/10 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSend(text)
        setText('')
      }}
    >
      <input
        className="flex-1 rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
        placeholder={`Ask FRIDAY to automate your PC (Ollama · ${modelLabel})…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-xl px-5 py-3 text-sm font-medium bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950"
      >
        Run
      </button>
    </form>
  )
}
