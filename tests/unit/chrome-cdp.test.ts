import { describe, expect, it } from 'vitest'
import { isAllowedCdpEndpoint } from '../../electron/main/automation/chrome-cdp'

describe('chrome CDP endpoint policy', () => {
  it('allows localhost only', () => {
    expect(isAllowedCdpEndpoint('http://127.0.0.1:9222')).toBe(true)
    expect(isAllowedCdpEndpoint('http://localhost:9222')).toBe(true)
    expect(isAllowedCdpEndpoint('http://192.168.1.1:9222')).toBe(false)
    expect(isAllowedCdpEndpoint('https://127.0.0.1:9222')).toBe(false)
  })
})
