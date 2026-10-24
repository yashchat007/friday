export function PlaceholderView({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="glass-panel max-w-md rounded-2xl border border-cyan-500/10 p-8 text-center">
        <h2 className="text-lg font-medium text-cyan-100 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{hint}</p>
      </div>
    </div>
  )
}
