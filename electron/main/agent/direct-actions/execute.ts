import type { TaskRun } from '../../../../shared/types/tools'
import type { ToolExecutor } from '../../tools/executor'
import { launchWindowsApp } from '../../automation/windows-app-launch'
import type { DirectAction } from './parse'
import { buildGoogleSearchUrl } from './parse'

export type DirectActionResult = { ok: boolean; message: string }

export async function executeDirectAction(
  executor: ToolExecutor,
  taskRun: TaskRun,
  action: DirectAction,
  signal?: AbortSignal
): Promise<DirectActionResult> {
  if (signal?.aborted) {
    return { ok: false, message: 'Task cancelled.' }
  }

  if (action.kind === 'launch_app') {
    const launch = await launchWindowsApp(action.app)
    if (!launch.ok) {
      return { ok: false, message: launch.error ?? `Could not launch ${action.label}.` }
    }
    if (launch.userMessage) {
      return { ok: launch.ok, message: launch.userMessage }
    }
    const verify = await executor.runStep(taskRun, 'desktop_verify_process', {
      processName: launch.processName ?? action.app
    })
    taskRun.steps.push(verify)
    const data = verify.result as { running?: boolean } | undefined
    if (verify.ok && data?.running) {
      return { ok: true, message: `${action.label} is open on your PC (process confirmed).` }
    }
    return {
      ok: true,
      message: `Launch requested for ${action.label}. Process not confirmed yet — check if the app window appeared.`
    }
  }

  const url = action.kind === 'google_search' ? buildGoogleSearchUrl(action.query) : action.url
  const label =
    action.kind === 'google_search' ? `Google search: “${action.query}”` : action.label

  const step = await executor.runStep(taskRun, 'browser_navigate', { url })
  taskRun.steps.push(step)

  if (signal?.aborted) {
    return { ok: false, message: 'Task cancelled.' }
  }

  if (step.ok) {
    const data = step.result as { url?: string; title?: string; verified?: boolean } | undefined
    if (data?.verified) {
      return {
        ok: true,
        message: `Opened ${data.title ?? label} in Chrome (${data.url ?? url}).`
      }
    }
  }

  return {
    ok: false,
    message: step.error ?? `Could not verify navigation to ${label}. Check Chrome CDP settings.`
  }
}
