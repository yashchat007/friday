export type FridayVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'task' | 'error'

export interface FridayVisualSnapshot {
  state: FridayVisualState
  /** 0–1 animation intensity (e.g. speech amplitude). */
  energy: number
  /** Increments when a new automation task starts (drives sphere shockwave). */
  shockwaveTick: number
}

export const IDLE_VISUAL: FridayVisualSnapshot = { state: 'idle', energy: 0, shockwaveTick: 0 }

type VisualEvent =
  | { type: 'task_started' }
  | { type: 'task_progress'; phase: string }
  | { type: 'inference_started' }
  | { type: 'text_delta' }
  | { type: 'step_started' }
  | { type: 'step_finished' }
  | { type: 'task_finished' }
  | { type: 'error' }
  | { type: 'speech_energy'; energy: number }
  | { type: 'speech_end' }

export function agentEventToVisualInput(event: { type: string; phase?: string }): VisualEvent | null {
  switch (event.type) {
    case 'task_started':
      return { type: 'task_started' }
    case 'task_progress':
      return { type: 'task_progress', phase: event.phase ?? '' }
    case 'inference_started':
      return { type: 'inference_started' }
    case 'text_delta':
      return { type: 'text_delta' }
    case 'step_started':
      return { type: 'step_started' }
    case 'step_finished':
      return { type: 'step_finished' }
    case 'task_finished':
      return { type: 'task_finished' }
    case 'error':
      return { type: 'error' }
    default:
      return null
  }
}

export function reduceVisualState(
  current: FridayVisualSnapshot,
  input: VisualEvent
): FridayVisualSnapshot {
  switch (input.type) {
    case 'task_started':
      return {
        state: 'thinking',
        energy: 0.4,
        shockwaveTick: current.shockwaveTick + 1
      }
    case 'inference_started':
      return { state: 'thinking', energy: 0.35, shockwaveTick: current.shockwaveTick }
    case 'task_progress':
      if (input.phase === 'tool') return { state: 'task', energy: 0.7, shockwaveTick: current.shockwaveTick }
      if (input.phase === 'streaming')
        return { state: 'speaking', energy: Math.max(current.energy, 0.5), shockwaveTick: current.shockwaveTick }
      return { state: 'thinking', energy: 0.45, shockwaveTick: current.shockwaveTick }
    case 'step_started':
      return { state: 'task', energy: 0.85, shockwaveTick: current.shockwaveTick }
    case 'step_finished':
      return current.state === 'task'
        ? { state: 'thinking', energy: 0.4, shockwaveTick: current.shockwaveTick }
        : current
    case 'text_delta':
      return {
        state: 'speaking',
        energy: Math.min(1, current.energy + 0.08),
        shockwaveTick: current.shockwaveTick
      }
    case 'speech_energy':
      return {
        state: 'speaking',
        energy: Math.min(1, Math.max(0.2, input.energy)),
        shockwaveTick: current.shockwaveTick
      }
    case 'error':
      return { state: 'error', energy: 0.5, shockwaveTick: current.shockwaveTick }
    case 'speech_end':
    case 'task_finished':
      return IDLE_VISUAL
    default:
      return current
  }
}

export function applyAgentEvent(
  current: FridayVisualSnapshot,
  event: { type: string; phase?: string }
): FridayVisualSnapshot {
  const input = agentEventToVisualInput(event)
  if (!input) return current
  return reduceVisualState(current, input)
}
