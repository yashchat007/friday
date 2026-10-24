import type { ChatMessage } from '../../../shared/types/ipc'
import type { TaskRun } from '../../../shared/types/tools'
import { ChatTranscript } from '../chat/ChatTranscript'
import { ExecutionTimeline } from '../task-run/ExecutionTimeline'

export function AssistantPanel({
  messages,
  streaming,
  progress,
  task,
}: {
  messages: ChatMessage[]
  streaming: string
  progress: string | null
  task: TaskRun | null
}) {
  const showTimeline = task && (task.status === 'running' || task.steps.length > 0)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatTranscript messages={messages} streaming={streaming} progress={progress} />
      </div>
      {showTimeline && (
        <div className="shrink-0 max-h-[38%] min-h-[120px] border-t border-white/[0.04]">
          <ExecutionTimeline task={task} progress={progress} />
        </div>
      )}
    </div>
  )
}
