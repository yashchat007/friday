import { describe, expect, it } from 'vitest'
import { cdpRefusedMessage, sanitizeAutomationError, stripAnsi } from '../../electron/main/automation/cdp-probe'

describe('cdp probe helpers', () => {
  it('strips ansi codes', () => {
    expect(stripAnsi('\u001b[31mfail\u001b[0m')).toBe('fail')
  })

  it('sanitizes playwright errors', () => {
    const out = sanitizeAutomationError('browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9222')
    expect(out).not.toContain('browserType')
    expect(out).toContain('ECONNREFUSED')
  })

  it('refused message mentions port', () => {
    expect(cdpRefusedMessage(9222)).toContain('9222')
  })
})
