import { describe, expect, it } from 'vitest'
import {
  buildGoogleSearchUrl,
  isOpenSiteRequest,
  parseWebSearchQuery,
  resolveOpenSiteUrl
} from '../../electron/main/agent/open-site-playbook'
import type { FridaySettings } from '../../shared/types/ipc'

const settings = {
  youtubeUrl: 'https://www.youtube.com/',
  whatsappWebUrl: 'https://web.whatsapp.com/'
} as FridaySettings

describe('open site playbook', () => {
  it('resolves YouTube and LeetCode', () => {
    expect(resolveOpenSiteUrl('Open YouTube.', settings)).toBe('https://www.youtube.com/')
    expect(resolveOpenSiteUrl('open leetcode', settings)).toBe('https://leetcode.com')
  })

  it('does not treat YouTube play as simple open-site', () => {
    const msg = "Open YouTube and play the song 'Desi Boys' on my laptop."
    expect(resolveOpenSiteUrl(msg, settings)).toBeTruthy()
    expect(isOpenSiteRequest(msg, settings)).toBe(false)
  })

  it('parses web search', () => {
    expect(parseWebSearchQuery('Search the web for Spring Boot tutorials')).toBe('Spring Boot tutorials')
    expect(buildGoogleSearchUrl('test')).toContain('google.com/search')
  })
})
