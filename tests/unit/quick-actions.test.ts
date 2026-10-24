import { describe, expect, it, vi } from 'vitest'
import { runQuickAction } from '../../electron/main/quick-actions'
import type { PlaywrightService } from '../../electron/main/automation/playwright-service'

describe('quick actions', () => {
  const mockPw = {
    navigateInExistingChrome: vi.fn()
  } as unknown as PlaywrightService

  it('reports YouTube failure when navigation not verified', async () => {
    vi.mocked(mockPw.navigateInExistingChrome).mockResolvedValue({
      ok: false,
      verified: false,
      error: 'CDP failed'
    })
    const r = await runQuickAction('youtube', mockPw)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('CDP')
  })

  it('reports YouTube success when verified', async () => {
    vi.mocked(mockPw.navigateInExistingChrome).mockResolvedValue({
      ok: true,
      verified: true,
      url: 'https://www.youtube.com/'
    })
    const r = await runQuickAction('youtube', mockPw)
    expect(r.ok).toBe(true)
    expect(mockPw.navigateInExistingChrome).toHaveBeenCalled()
  })
})
