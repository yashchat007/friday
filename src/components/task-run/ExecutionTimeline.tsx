import type { TaskRun, ToolStep } from '../../../shared/types/tools'

function stepStatus(step: ToolStep): 'running' | 'ok' | 'fail' | 'pending' | 'approval' {
  if (step.approvalStatus === 'pending') return 'approval'
  if (step.approvalStatus === 'denied') return 'fail'
  if (step.ok === true) return 'ok'
  if (step.ok === false) return 'fail'
  return 'running'
}

function Dot({ status }: { status: ReturnType<typeof stepStatus> }) {
  if (status === 'ok') {
    return <span className="h-2 w-2 rounded-full bg-[#28CFFF] shadow-[0_0_6px_#28CFFF]" />
  }
  if (status === 'running' || status === 'approval') {
    return <span className="h-2 w-2 rounded-full border border-[#28CFFF] animate-pulse" />
  }
  if (status === 'fail') {
    return <span className="h-2 w-2 rounded-full bg-rose-400/80" />
  }
  return <span className="h-2 w-2 rounded-full border border-slate-600" />
}

export function ExecutionTimeline({
  task,
  progress
}: {
  task: TaskRun | null
  progress?: string | null
}) {
  if (!task) return null

  const title = task.userMessage.length > 48 ? `${task.userMessage.slice(0, 48)}…` : task.userMessage

  return (
    <div className="mx-4 mb-3 rounded-lg border border-[#28CFFF]/12 bg-black/30 px-3 py-3">
      <p className="text-[11px] text-[#8BDFFF] mb-2">{title}</p>
      <ul className="space-y-2">
        {task.steps.length === 0 && task.status === 'running' && (
          <li className="flex items-center gap-2 text-[11px] text-slate-400">
            <Dot status="running" />
            {progress ?? 'Working…'}
          </li>
        )}
        {task.steps.map((step) => {
          const status = stepStatus(step)
          const label = step.toolName.replace(/_/g, ' ')
          return (
            <li key={step.id} className="flex items-start gap-2 text-[11px] text-slate-400">
              <Dot status={status} />
              <div className="flex-1 min-w-0">
                <span className="text-slate-300 capitalize">{label}</span>
                {step.error && status === 'fail' && (
                  <p className="text-rose-300/80 text-[10px] mt-0.5 line-clamp-2">{step.error}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
