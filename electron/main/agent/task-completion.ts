import type { ChatMessage } from '../../../shared/types/ipc'
import type { ToolStep } from '../../../shared/types/tools'
import { parseYouTubePlayQuery } from './youtube-playbook'

const LAUNCH_TOOLS = new Set(['desktop_launch', 'app_launch'])
const TYPE_TOOLS = new Set(['desktop_type_text'])
const BROWSER_TOOLS = /^browser_/

export interface TaskExpectation {
  needsNotepadLaunch: boolean
  needsTyping: boolean
  needsYoutubePlay: boolean
  youtubeQuery?: string
}

export function inferTaskExpectation(userMessage: string, context?: ChatMessage[]): TaskExpectation {
  const lower = userMessage.toLowerCase()
  const youtubeQuery = parseYouTubePlayQuery(userMessage, context)
  const needsNotepadLaunch = /\bnotepad\b/.test(lower) && /\b(open|launch|start)\b/.test(lower)
  const needsTyping =
    needsNotepadLaunch &&
    (/\b(write|type|enter|put)\b/.test(lower) || /['"`]/.test(userMessage) || /\bon it\b/.test(lower))
  return {
    needsNotepadLaunch,
    needsTyping,
    needsYoutubePlay: youtubeQuery !== null,
    youtubeQuery: youtubeQuery ?? undefined
  }
}

function youtubeStepSucceeded(steps: ToolStep[]): boolean {
  const step = steps.find((s) => s.toolName === 'browser_youtube_search_play' && s.ok)
  if (!step) return false
  const data = step.result as { url?: string; playing?: boolean } | undefined
  return Boolean(data?.url?.includes('watch') && data.playing === true)
}

export function isTaskObjectiveMet(expectation: TaskExpectation, steps: ToolStep[]): boolean {
  if (expectation.needsYoutubePlay) {
    return youtubeStepSucceeded(steps)
  }
  if (expectation.needsNotepadLaunch) {
    const launched = steps.some((s) => s.ok && LAUNCH_TOOLS.has(s.toolName))
    if (!launched) return false
    if (!expectation.needsTyping) return true
    return steps.some((s) => s.ok && TYPE_TOOLS.has(s.toolName))
  }
  return false
}

export function hasKnownAutomationObjective(expectation: TaskExpectation): boolean {
  return expectation.needsYoutubePlay || expectation.needsNotepadLaunch
}

export function isAutomationComplete(expectation: TaskExpectation, steps: ToolStep[]): boolean {
  if (hasKnownAutomationObjective(expectation)) {
    return isTaskObjectiveMet(expectation, steps)
  }
  return hasSuccessfulAutomationStep(steps)
}

export function hasSuccessfulAutomationStep(steps: ToolStep[]): boolean {
  return steps.some((s) => s.ok && (BROWSER_TOOLS.test(s.toolName) || LAUNCH_TOOLS.has(s.toolName) || TYPE_TOOLS.has(s.toolName) || s.toolName.startsWith('file_')))
}

export function incompleteTaskHint(expectation: TaskExpectation, steps: ToolStep[]): string | null {
  if (isTaskObjectiveMet(expectation, steps)) return null

  if (expectation.needsYoutubePlay) {
    return `YouTube playback is not verified yet. Call browser_youtube_search_play with query "${expectation.youtubeQuery ?? 'the requested song'}" or use browser_navigate to youtube.com, search, click the correct video, and verify the watch URL.`
  }
  if (expectation.needsNotepadLaunch && !steps.some((s) => s.ok && LAUNCH_TOOLS.has(s.toolName))) {
    return 'Notepad is not launched yet. Call desktop_launch with app "notepad", then desktop_type_text with the requested text, then desktop_verify_process if needed.'
  }
  if (expectation.needsTyping && !steps.some((s) => s.ok && TYPE_TOOLS.has(s.toolName))) {
    return 'Text was not typed into Notepad yet. Call desktop_type_text with the exact text after Notepad is open.'
  }
  return null
}
