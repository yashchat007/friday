/** Picks the best available English voice (prefers Microsoft neural/natural female voices on Windows). */

const PREFERRED_PATTERNS = [
  /Microsoft (Aria|Jenny|Zira|Natasha)/i,
  /Microsoft .* Natural/i,
  /Google.*English.*Female/i,
  /Samantha/i
]

export function stripForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\{[\s\S]*\}/g, '')
    .replace(/\b(browser_|desktop_|file_|run_)\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  if (en.length === 0) return voices[0] ?? null
  for (const pattern of PREFERRED_PATTERNS) {
    const match = en.find((v) => pattern.test(v.name))
    if (match) return match
  }
  const femaleHint = en.find((v) => /female|zira|jenny|aria|samantha/i.test(v.name))
  return femaleHint ?? en[0]
}

export function speechSettingsForVoice(voice: SpeechSynthesisVoice | null): { rate: number; pitch: number } {
  const neural = voice?.name.match(/Natural|Neural|Online/i)
  return {
    rate: neural ? 0.94 : 0.9,
    pitch: neural ? 1.02 : 1
  }
}
