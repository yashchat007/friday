import type { ChatMessage } from '../../../shared/types/ipc'
import type { TaskRun } from '../../../shared/types/tools'
import { ChatTranscript } from '../chat/ChatTranscript'
import { FridayEmblem } from '../layout/FridayEmblem'
import { ExecutionTimeline } from '../task-run/ExecutionTimeline'

export function ConversationPanel({
  messages,
  streaming,
  progress,
  task,
  systemLines
}: {
  messages: ChatMessage[]
  streaming: string
  progress: string | null
  task: TaskRun | null
  systemLines: string[]
}) {
  const showTimeline = task && (task.status === 'running' || task.steps.length > 0)

  return (
    <div className="flex flex-col h-full min-h-0 glass-panel border border-[#28CFFF]/15 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#28CFFF]/12 bg-[#060d14]/80">
        <FridayEmblem size={24} />
        <span className="text-[10px] tracking-[0.35em] text-[#8BDFFF]">FRIDAY</span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatTranscript
          messages={messages}
          streaming={streaming}
          progress={progress}
          systemLines={systemLines}
        />
        {showTimeline && <ExecutionTimeline task={task} progress={progress} />}
      </div>
    </div>
  )
}
