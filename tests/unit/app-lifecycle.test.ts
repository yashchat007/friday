import { describe, expect, it, vi } from 'vitest'
import {
  destroyBrowserWindows,
  orbWindowShouldBeExpanded,
  SHUTDOWN_STEPS,
  resolveMainWindowCloseAction,
  shouldCreateOrShowOrb,
  shouldHandleDevProcessExitSignal,
  shouldRunShutdown
} from '../../electron/main/app-lifecycle'

describe('app lifecycle', () => {
  it('runs shutdown only once', () => {
    expect(shouldRunShutdown(false)).toBe(true)
    expect(shouldRunShutdown(true)).toBe(false)
  })

  it('orders quit steps before app exit', () => {
    expect(SHUTDOWN_STEPS.indexOf('destroyAllWindows')).toBeLessThan(SHUTDOWN_STEPS.indexOf('appExit'))
    expect(SHUTDOWN_STEPS).toContain('destroyTray')
  })

  it('keeps orb window collapsed when panel is closed', () => {
    expect(orbWindowShouldBeExpanded(false, true)).toBe(false)
    expect(orbWindowShouldBeExpanded(true, true)).toBe(true)
    expect(orbWindowShouldBeExpanded(true, false)).toBe(false)
  })

  it('blocks orb creation during shutdown', () => {
    expect(shouldCreateOrShowOrb(false)).toBe(true)
    expect(shouldCreateOrShowOrb(true)).toBe(false)
  })

  it('routes main window close to shutdown when not quitting', () => {
    expect(resolveMainWindowCloseAction(false)).toBe('shutdown')
    expect(resolveMainWindowCloseAction(true)).toBe('allow-close')
  })

  it('ignores dev process exit until bootstrap completes', () => {
    expect(shouldHandleDevProcessExitSignal(false)).toBe(false)
    expect(shouldHandleDevProcessExitSignal(true)).toBe(true)
  })

  it('destroys every non-destroyed browser window', () => {
    const a = { isDestroyed: () => false, removeAllListeners: vi.fn(), destroy: vi.fn() }
    const b = { isDestroyed: () => true, removeAllListeners: vi.fn(), destroy: vi.fn() }
    const count = destroyBrowserWindows([a as never, b as never])
    expect(count).toBe(1)
    expect(a.destroy).toHaveBeenCalledOnce()
    expect(b.destroy).not.toHaveBeenCalled()
  })
})
