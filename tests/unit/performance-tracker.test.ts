import { describe, expect, it } from 'vitest'
import { TaskPerformanceTracker } from '../../electron/main/agent/performance-tracker'

describe('TaskPerformanceTracker', () => {
  it('records preflight, model calls, and tool durations', () => {
    const tracker = new TaskPerformanceTracker()
    tracker.markPreflightDone()
    tracker.markFirstToken()
    tracker.recordModelCall(120, false)
    tracker.recordModelCall(80, true)

    const metrics = tracker.finish([
      {
        id: '1',
        toolName: 'desktop_launch',
        args: {},
        risk: 'sensitive',
        startedAt: 1000,
        finishedAt: 1500,
        ok: true
      }
    ])

    expect(metrics.modelCallCount).toBe(2)
    expect(metrics.modelCallMs).toBe(200)
    expect(metrics.toolExecutionMs).toBe(500)
    expect(metrics.timeToFirstTokenMs).toBeDefined()
    expect(metrics.preflightMs).toBeDefined()
    expect(metrics.tools[0].toolName).toBe('desktop_launch')
  })
})
