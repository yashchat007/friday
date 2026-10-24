import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const memoryPath = path.join(
  process.env.FRIDAY_MEMORY ?? path.join(os.homedir(), 'AppData/Roaming/friday/friday-memory.json')
)

const MAX = 4000
const MAXM = 480

function isJunk(c) {
  const t = c.trim()
  if (!t) return true
  if (c.includes('[GoogleGenerativeAI Error]')) return true
  if (c.includes('functionCalls is not a function')) return true
  if (t.startsWith('Error:')) return true
  if (c.includes('thought_signature')) return true
  return false
}

function hasLeak(c) {
  return /"name"\s*:\s*"(desktop_|file_|browser_|run_)/.test(c)
}

function isSocialOpener(text) {
  const t = text.trim()
  if (t.length > 80) return false
  return /^(hi|hello|hey|yo|good\s+(morning|afternoon|evening)|sup)\b/i.test(t)
}

function select(messages, excludeId) {
  const selected = []
  let used = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.id === excludeId) continue
    if (m.role !== 'user' && m.role !== 'assistant') continue
    if (isJunk(m.content)) continue
    if (m.role === 'assistant' && hasLeak(m.content)) continue
    let content = m.content.trim()
    if (!content) continue
    if (content.length > MAXM) content = content.slice(0, MAXM - 1) + '…'
    const cost = content.length + 8
    if (used + cost > MAX) break
    selected.unshift({ role: m.role, chars: content.length })
    used += cost
  }
  return { turns: selected.length, historyChars: used, selected }
}

const mem = JSON.parse(fs.readFileSync(memoryPath, 'utf8'))
const greeting = 'Hey FRIDAY, how are you?'
const last = mem.messages.filter((m) => m.role === 'user').at(-1)
const exclude = last?.content === greeting ? last.id : 'none'
const profile = select(mem.messages, exclude)
const systemChars = 280
const factsChars = (mem.userFacts ?? []).length * 24
console.log(
  JSON.stringify({
    memoryPath,
    totalStoredMessages: mem.messages.length,
    greetingSocialOpener: isSocialOpener(greeting),
    historyTurnsIncluded: profile.turns,
    historyChars: profile.historyChars,
    estimatedPromptChars: systemChars + factsChars + profile.historyChars + greeting.length,
    note: '846 Ollama tokens ≈ large history budget (up to 4000 chars), not benchmark-minimal'
  })
)
