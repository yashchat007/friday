import { describe, expect, it } from 'vitest'
import {
  isHideToTrayAction,
  resolveMainWindowCloseAction,
  SHUTDOWN_STEPS,
  shouldRunShutdown
} from '../../electron/main/app-lifecycle'

describe('FRIDAY shutdown policy', () => {
  it('main window close triggers shutdown, not hide-to-tray', () => {
    expect(resolveMainWindowCloseAction(false)).toBe('shutdown')
    expect(resolveMainWindowCloseAction(true)).toBe('allow-close')
  })

  it('hide-to-tray is distinct from full shutdown', () => {
    expect(isHideToTrayAction('hide-to-tray')).toBe(true)
    expect(isHideToTrayAction('shutdown')).toBe(false)
    expect(resolveMainWindowCloseAction(false)).not.toBe('hide-to-tray')
  })

  it('quit path destroys all windows before app exit', () => {
    expect(SHUTDOWN_STEPS.indexOf('destroyAllWindows')).toBeLessThan(SHUTDOWN_STEPS.indexOf('appExit'))
    expect(SHUTDOWN_STEPS).toContain('destroyTray')
  })

  it('repeated shutdown calls are ignored', () => {
    expect(shouldRunShutdown(true)).toBe(false)
  })
})
