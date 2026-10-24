import { describe, expect, it } from 'vitest'
import { applyAgentEvent, IDLE_VISUAL, reduceVisualState } from '../../shared/agent-visual-state'

describe('agent visual state', () => {
  it('enters thinking on task start', () => {
    expect(applyAgentEvent(IDLE_VISUAL, { type: 'task_started' }).state).toBe('thinking')
  })

  it('enters task on tool step', () => {
    expect(reduceVisualState(IDLE_VISUAL, { type: 'step_started' }).state).toBe('task')
  })

  it('enters speaking on text delta', () => {
    expect(applyAgentEvent(IDLE_VISUAL, { type: 'text_delta' }).state).toBe('speaking')
  })

  it('returns to idle on task finished', () => {
    expect(
      applyAgentEvent({ state: 'speaking', energy: 0.8, shockwaveTick: 2 }, { type: 'task_finished' })
    ).toEqual(IDLE_VISUAL)
  })

  it('bumps shockwave tick on task start', () => {
    expect(applyAgentEvent(IDLE_VISUAL, { type: 'task_started' }).shockwaveTick).toBe(1)
  })

  it('enters error state on agent error', () => {
    expect(applyAgentEvent(IDLE_VISUAL, { type: 'error' }).state).toBe('error')
  })
})
