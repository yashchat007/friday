import { describe, expect, it } from 'vitest'
import { pickEnglishVoice, stripForSpeech } from '../../src/lib/speech-voice'

describe('speech voice', () => {
  it('strips tool names from speech', () => {
    expect(stripForSpeech('Called browser_navigate ok')).not.toMatch(/browser_navigate/)
  })

  it('prefers Microsoft voices when listed', () => {
    const voices = [
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
      { name: 'Other', lang: 'en-US' }
    ] as SpeechSynthesisVoice[]
    expect(pickEnglishVoice(voices)?.name).toContain('Zira')
  })
})
