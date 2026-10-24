import { useCallback, useEffect, useRef } from 'react'
import { pickEnglishVoice, speechSettingsForVoice, stripForSpeech } from '../lib/speech-voice'

export function useFridaySpeech(enabled: boolean, preferredVoiceName?: string) {
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      const voices = window.speechSynthesis.getVoices()
      const pref = preferredVoiceName?.trim()
      voiceRef.current =
        (pref ? voices.find((v) => v.name === pref) : null) ?? pickEnglishVoice(voices)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [preferredVoiceName])

  const stopPulse = useCallback(() => {
    if (pulseRef.current) {
      clearInterval(pulseRef.current)
      pulseRef.current = null
    }
    window.friday?.setSpeechVisualEnergy(0)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return
      if (!('speechSynthesis' in window)) return

      const clean = stripForSpeech(text)
      if (!clean || clean.length < 2) return

      const utterance = new SpeechSynthesisUtterance(clean)
      const voice = voiceRef.current ?? pickEnglishVoice(window.speechSynthesis.getVoices())
      if (voice) utterance.voice = voice
      const { rate, pitch } = speechSettingsForVoice(voice)
      utterance.rate = rate
      utterance.pitch = pitch

      window.speechSynthesis.cancel()
      stopPulse()

      utterance.onstart = () => {
        let t = 0
        pulseRef.current = setInterval(() => {
          t += 0.15
          window.friday.setSpeechVisualEnergy(0.35 + Math.sin(t) * 0.25)
        }, 80)
      }
      utterance.onend = () => stopPulse()
      utterance.onerror = () => stopPulse()

      window.speechSynthesis.speak(utterance)
    },
    [enabled, stopPulse]
  )

  useEffect(() => () => stopPulse(), [stopPulse])

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel()
    stopPulse()
  }, [stopPulse])

  return { speak, cancel, voiceName: voiceRef.current?.name ?? null }
}
