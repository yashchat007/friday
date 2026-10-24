import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCachedReadiness,
  invalidateReadinessCache,
  setCachedReadiness
} from '../../electron/main/agent/provider-readiness-cache'

describe('provider readiness cache', () => {
  afterEach(() => {
    invalidateReadinessCache()
    vi.restoreAllMocks()
  })

  it('returns cached readiness within TTL', () => {
    setCachedReadiness('key', { ready: true })
    expect(getCachedReadiness('key')).toEqual({ ready: true })
  })

  it('invalidates on settings change hook', () => {
    setCachedReadiness('key', { ready: true })
    invalidateReadinessCache()
    expect(getCachedReadiness('key')).toBeNull()
  })
})
