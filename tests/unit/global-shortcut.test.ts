import { beforeEach, describe, expect, it, vi } from 'vitest'

const { unregisterAll, isReady } = vi.hoisted(() => ({
  unregisterAll: vi.fn(),
  isReady: vi.fn(() => true)
}))

vi.mock('electron', () => ({
  app: { isReady },
  globalShortcut: { unregisterAll, isRegistered: () => false, register: () => true, unregister: vi.fn() }
}))

import { unregisterFridayGlobalShortcuts } from '../../electron/main/global-shortcut'

describe('global shortcuts', () => {
  beforeEach(() => {
    unregisterAll.mockClear()
    isReady.mockReturnValue(true)
  })

  it('does not touch globalShortcut before app is ready', () => {
    isReady.mockReturnValue(false)
    unregisterFridayGlobalShortcuts()
    expect(unregisterAll).not.toHaveBeenCalled()
  })

  it('unregisters when app is ready', () => {
    unregisterFridayGlobalShortcuts()
    expect(unregisterAll).toHaveBeenCalledOnce()
  })
})
