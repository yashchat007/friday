import type { Page } from 'playwright'
import { contactNamesMatch, refineWhatsAppMessage } from './whatsapp-refine'
import type { WhatsAppSendIntent } from './whatsapp-intent'

export type WhatsAppPrepareResult =
  | {
      ok: true
      contactName: string
      displayName: string
      message: string
      needsLogin: boolean
    }
  | {
      ok: false
      error: string
      ambiguous?: boolean
      candidates?: string[]
      needsLogin?: boolean
    }

const SEARCH_SELECTORS = [
  '[data-testid="chat-list-search"]',
  'div[title="Search input textbox"]',
  '[aria-label="Search input textbox"]'
]

const HEADER_SELECTORS = [
  '[data-testid="conversation-info-header"]',
  'header span[title]'
]

async function waitForWhatsAppReady(page: Page): Promise<{ needsLogin: boolean }> {
  await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {})
  const qr = await page.locator('[data-testid="qrcode"]').count()
  if (qr > 0) return { needsLogin: true }
  const landing = await page.locator('text=Log in with phone number').count()
  if (landing > 0) return { needsLogin: true }
  return { needsLogin: false }
}

async function openSearch(page: Page): Promise<void> {
  for (const sel of SEARCH_SELECTORS) {
    const loc = page.locator(sel).first()
    if (await loc.count()) {
      await loc.click({ timeout: 8000 })
      return
    }
  }
  throw new Error('WhatsApp search box not found. Complete login in Chrome first.')
}

export async function prepareWhatsAppMessage(
  page: Page,
  intent: WhatsAppSendIntent,
  whatsappUrl: string
): Promise<WhatsAppPrepareResult> {
  const host = 'web.whatsapp.com'
  if (!page.url().includes(host)) {
    await page.goto(whatsappUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  }
  const ready = await waitForWhatsAppReady(page)
  if (ready.needsLogin) {
    return {
      ok: false,
      needsLogin: true,
      error: 'WhatsApp Web is not logged in. Complete login in Chrome, then ask again.'
    }
  }

  await openSearch(page)
  const searchBox = page.locator('[contenteditable="true"][data-tab="3"]').first()
  await searchBox.fill('')
  await searchBox.type(intent.contactName, { delay: 40 })
  await page.waitForTimeout(1200)

  const results = page.locator('[data-testid="cell-frame-container"]')
  const count = await results.count()
  if (count === 0) {
    return { ok: false, error: `No WhatsApp contact found for "${intent.contactName}".` }
  }

  const titles: string[] = []
  for (let i = 0; i < Math.min(count, 5); i++) {
    const title = await results.nth(i).locator('span[title]').first().getAttribute('title')
    if (title) titles.push(title)
  }

  const matches = titles.filter((t) => contactNamesMatch(intent.contactName, t))
  if (matches.length === 0) {
    return { ok: false, error: `Could not match "${intent.contactName}" in search results.`, candidates: titles }
  }
  if (matches.length > 1 && !matches.every((m) => m === matches[0])) {
    return {
      ok: false,
      ambiguous: true,
      candidates: matches,
      error: `Multiple contacts match "${intent.contactName}". Please specify the full name.`
    }
  }

  const pick = matches[0]
  await results.filter({ has: page.locator(`span[title="${pick}"]`) }).first().click({ timeout: 10_000 })

  let headerTitle = ''
  for (const sel of HEADER_SELECTORS) {
    const h = page.locator(sel).first()
    if (await h.count()) {
      headerTitle = (await h.innerText().catch(() => '')) || (await h.getAttribute('title')) || ''
      if (headerTitle) break
    }
  }

  if (!contactNamesMatch(intent.contactName, headerTitle)) {
    return {
      ok: false,
      error: `Opened chat header "${headerTitle}" does not match "${intent.contactName}". Please resolve manually.`
    }
  }

  const message = refineWhatsAppMessage(intent.rawMessage)
  return {
    ok: true,
    contactName: intent.contactName,
    displayName: headerTitle || pick,
    message,
    needsLogin: false
  }
}

export async function sendWhatsAppMessage(page: Page, message: string): Promise<{ ok: boolean; error?: string }> {
  const box = page.locator('[data-testid="conversation-compose-box-input"]').first()
  if (!(await box.count())) {
    return { ok: false, error: 'Message compose box not found.' }
  }
  await box.click()
  await box.fill('')
  await box.type(message, { delay: 25 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)

  const sent = page.locator(`span.selectable-text span:has-text("${message.slice(0, 40)}")`)
  if (await sent.count()) return { ok: true }
  return { ok: false, error: 'Could not verify the message was sent.' }
}
