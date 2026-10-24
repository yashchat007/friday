import { z } from 'zod'
import type { RegisteredTool } from '../../../../shared/types/tools'
import { getSettings } from '../../settings'
import { resolveBrowserMode } from '../../automation/browser-mode'
import { prepareWhatsAppMessage, sendWhatsAppMessage } from '../../automation/whatsapp-automation'
import type { PlaywrightService } from '../../automation/playwright-service'
import { defineTool } from '../define-tool'

export function createWhatsAppTools(
  playwright: PlaywrightService,
  useTestBrowser: () => boolean
): RegisteredTool[] {
  const pageForSession = async () => {
    const mode = resolveBrowserMode(useTestBrowser())
    return playwright.ensurePage(mode, mode === 'test')
  }

  const sendSchema = z.object({
    contactName: z.string().min(1),
    message: z.string().min(1)
  })

  const prepareSchema = z.object({
    contactName: z.string().min(1),
    rawMessage: z.string().min(1)
  })

  return [
    defineTool(
      {
        name: 'whatsapp_send_message',
        description:
          'Send a WhatsApp message in the currently verified chat. Only call after whatsapp_prepare and user confirmation.',
        risk: 'destructive',
        parameters: {
          type: 'object',
          properties: {
            contactName: { type: 'string' },
            message: { type: 'string' }
          },
          required: ['contactName', 'message']
        }
      },
      sendSchema,
      async (args) => {
        const page = await pageForSession()
        const result = await sendWhatsAppMessage(page, args.message)
        if (!result.ok) return { ok: false, error: result.error }
        return { ok: true, data: { contactName: args.contactName, sent: true } }
      }
    ),
    defineTool(
      {
        name: 'whatsapp_prepare',
        description: 'Open WhatsApp Web, find contact, verify chat, and prepare message text (does not send).',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: {
            contactName: { type: 'string' },
            rawMessage: { type: 'string' }
          },
          required: ['contactName', 'rawMessage']
        }
      },
      prepareSchema,
      async (args) => {
        const settings = getSettings()
        const page = await pageForSession()
        const prep = await prepareWhatsAppMessage(
          page,
          { contactName: args.contactName, rawMessage: args.rawMessage },
          settings.whatsappWebUrl
        )
        if (!prep.ok) {
          return { ok: false, error: prep.error, data: prep }
        }
        return {
          ok: true,
          data: {
            contactName: prep.contactName,
            displayName: prep.displayName,
            message: prep.message,
            needsLogin: prep.needsLogin
          }
        }
      }
    )
  ]
}
