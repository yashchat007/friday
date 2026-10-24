import { describe, expect, it } from 'vitest'
import { contactNamesMatch, refineWhatsAppMessage } from '../../electron/main/automation/whatsapp-refine'

describe('whatsapp refine', () => {
  it('refines without inventing content', () => {
    expect(refineWhatsAppMessage("that I'll be 20 minutes late")).toBe("I'll be 20 minutes late.")
  })

  it('matches contact headers', () => {
    expect(contactNamesMatch('Rahul', 'Rahul Sharma')).toBe(true)
  })
})
