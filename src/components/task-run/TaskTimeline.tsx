import type { TaskRun } from '../../../shared/types/tools'

export function TaskTimeline({ task }: { task: TaskRun | null }) {
  if (!task) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        Task timeline will appear when FRIDAY runs tools.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col">
      <div className="flex justify-between items-start gap-2 mb-3">
        <h2 className="font-medium text-cyan-100">Task</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">{task.status}</span>
      </div>
      <p className="text-xs text-slate-400 mb-3 line-clamp-3">{task.userMessage}</p>
      {task.metrics && (
        <p className="text-[11px] text-slate-500 mb-3 font-mono">
          {task.metrics.inferenceTimeToFirstTokenMs !== undefined
            ? `infer TTFT ${task.metrics.inferenceTimeToFirstTokenMs}ms · `
            : task.metrics.timeToFirstTokenMs !== undefined
              ? `TTFT ${task.metrics.timeToFirstTokenMs}ms · `
              : ''}
          total {task.metrics.totalMs}ms · model {task.metrics.modelCallMs}ms
          {task.metrics.promptTokens !== undefined ? ` · prompt ${task.metrics.promptTokens} tok` : ''}
          {task.metrics.tokensPerSecond !== undefined ? ` · ${task.metrics.tokensPerSecond} tok/s` : ''}
          {task.metrics.toolExecutionMs > 0 ? ` · tools ${task.metrics.toolExecutionMs}ms` : ''}
        </p>
      )}
      <ul className="flex-1 overflow-y-auto space-y-2 text-xs">
        {task.steps.map((step) => (
          <li
            key={step.id}
            className="rounded-lg border border-white/10 bg-black/30 p-2"
          >
            <div className="flex justify-between gap-2">
              <span className="font-mono text-cyan-200">{step.toolName}</span>
              <span className={step.ok ? 'text-emerald-400' : step.ok === false ? 'text-rose-400' : 'text-slate-400'}>
                {step.ok === undefined ? '…' : step.ok ? 'ok' : 'fail'}
              </span>
            </div>
            {step.error && <p className="text-rose-300 mt-1">{step.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
