import { useCallback, useEffect, useState } from 'react'
import type { AgentEvent, ApprovalRequest, ChatMessage, FridaySettings, OllamaStatus } from '../../shared/types/ipc'
import type { TaskRun, ToolStep } from '../../shared/types/tools'
import { applyAgentEvent, IDLE_VISUAL, type FridayVisualSnapshot } from '../../shared/agent-visual-state'
import { shouldAppendAssistantOnTaskFinished } from '../chat/message-sync'
import { useFridaySpeech } from './useFridaySpeech'

export function useAgentSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<FridaySettings | null>(null)
  const [streaming, setStreaming] = useState('')
  const [activeTask, setActiveTask] = useState<TaskRun | null>(null)
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [taskProgress, setTaskProgress] = useState<string | null>(null)
  const [visual, setVisual] = useState<FridayVisualSnapshot>(IDLE_VISUAL)
  const [systemLines, setSystemLines] = useState<string[]>([])
  const speechEnabled = settings?.speechEnabled ?? true
  const { speak, cancel: cancelSpeech } = useFridaySpeech(
    speechEnabled,
    settings?.speechVoiceName
  )

  useEffect(() => {
    void window.friday.getSettings().then(setSettings)
    void window.friday.getMessages().then(setMessages)
    void window.friday.getOllamaStatus().then(setOllamaStatus)
  }, [])

  useEffect(() => {
    return window.friday.onAgentEvent((event: AgentEvent) => {
      setVisual((v) => applyAgentEvent(v, event))
      if (event.type === 'text_delta') setStreaming((s) => s + event.delta)
      if (event.type === 'task_started') {
        setBusy(true)
        setStreaming('')
        setTaskProgress(null)
        setActiveTask(event.taskRun)
        void window.friday.getMessages().then(setMessages)
      }
      if (event.type === 'task_progress' && event.detail) setTaskProgress(event.detail)
      if (event.type === 'step_started') {
        setActiveTask((task) => {
          if (!task || task.id !== event.taskRunId) return task
          const step: ToolStep = {
            id: event.stepId,
            toolName: event.toolName,
            args: event.args,
            risk: 'safe',
            startedAt: Date.now()
          }
          return { ...task, steps: [...task.steps, step] }
        })
      }
      if (event.type === 'step_finished') {
        setActiveTask((task) => {
          if (!task || task.id !== event.taskRunId) return task
          return {
            ...task,
            steps: task.steps.map((s) =>
              s.id === event.stepId
                ? { ...s, ok: event.ok, finishedAt: Date.now(), error: event.error, result: event.result }
                : s
            )
          }
        })
      }
      if (event.type === 'approval_required') setApproval(event.request)
      if (event.type === 'task_finished') {
        setBusy(false)
        setTaskProgress(null)
        setActiveTask(event.taskRun)
        if (event.taskRun.status === 'cancelled') {
          cancelSpeech()
        }
        const summary = event.taskRun.assistantSummary?.trim()
        setStreaming('')
        void window.friday.getMessages().then((msgs) => {
          setMessages(msgs)
          if (summary && shouldAppendAssistantOnTaskFinished()) {
            setMessages((prev) => [
              ...prev,
              { id: `${Date.now()}`, role: 'assistant', content: summary, createdAt: Date.now() }
            ])
          }
          if (summary && event.taskRun.status === 'completed') speak(summary)
        })
      }
      if (event.type === 'error') {
        cancelSpeech()
        setBusy(false)
        setTaskProgress(null)
        const clean = event.message.replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]
        setSystemLines((prev) => [...prev.slice(-6), `Error: ${clean}`])
        window.setTimeout(() => setVisual(IDLE_VISUAL), 2800)
      }
    })
  }, [speak, cancelSpeech])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setBusy(true)
      setTaskProgress('Checking AI provider…')
      await window.friday.sendTask({ message: trimmed })
    },
    [busy]
  )

  const saveSettings = useCallback(async (patch: Partial<FridaySettings>) => {
    const next = await window.friday.setSettings(patch)
    setSettings(next)
    if (patch.particleCount !== undefined) {
      localStorage.setItem('friday-particle-count', String(next.particleCount))
    }
    void window.friday.getOllamaStatus().then(setOllamaStatus)
    return next
  }, [])

  const respondApproval = useCallback((approvalId: string, approved: boolean) => {
    void window.friday.respondApproval(approvalId, approved)
    setApproval(null)
  }, [])

  const cancelTask = useCallback(() => {
    cancelSpeech()
    void window.friday.cancelTask()
  }, [cancelSpeech])

  const pushSystemLine = useCallback((line: string) => {
    if (!line.trim()) return
    setSystemLines((prev) => [...prev.slice(-6), line])
  }, [])

  const runQuickAction = useCallback(
    async (id: string) => {
      const result = await window.friday.runQuickAction(id)
      if (result.openMore) {
        return { ...result, message: '' }
      }
      if (result.message) {
        pushSystemLine(result.ok ? result.message : `Error: ${result.message}`)
      }
      return result
    },
    [pushSystemLine]
  )

  return {
    messages,
    settings,
    streaming,
    activeTask,
    approval,
    busy,
    ollamaStatus,
    taskProgress,
    visual,
    speechEnabled,
    cancelSpeech,
    sendMessage,
    saveSettings,
    respondApproval,
    cancelTask,
    systemLines,
    runQuickAction,
    pushSystemLine
  }
}
