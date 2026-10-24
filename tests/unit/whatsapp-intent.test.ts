import { describe, expect, it } from 'vitest'
import {
  isWhatsAppWebSendRequest,
  parseWhatsAppSendIntent
} from '../../electron/main/automation/whatsapp-intent'

describe('whatsapp intent', () => {
  it('parses message to contact', () => {
    const intent = parseWhatsAppSendIntent("Message Rahul that I'll reach 20 minutes late")
    expect(intent?.contactName).toBe('Rahul')
    expect(intent?.rawMessage).toMatch(/20 minutes late/i)
  })

  it('does not treat open+send compound as web send intent', () => {
    expect(
      isWhatsAppWebSendRequest('open whatsapp and send Me a message "hi"')
    ).toBe(false)
  })
})
