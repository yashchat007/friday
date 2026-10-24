/**
 * Mirrors FRIDAY conversation request shape (system + messages + options) and times Ollama.
 * Usage: node scripts/compare-friday-ollama.mjs
 */
const BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1'

const SYSTEM = `You are FRIDAY, a friendly personal desktop assistant on the user's Windows PC.

Reply naturally and briefly. Use chat history and any listed facts about the user.
Do not mention tools, APIs, or internal systems unless asked. Do not output JSON or function calls in chat.

Known facts:
- User's name is Yash`

async function ps() {
  const res = await fetch(`${BASE}/api/ps`)
  const json = await res.json()
  const m = (json.models ?? []).find((x) => x.name?.startsWith(MODEL.split(':')[0]))
  return {
    loaded: Boolean(m),
    sizeVram: m?.size_vram ?? 0,
    expiresAt: m?.expires_at
  }
}

async function chat(label, messages) {
  const before = await ps()
  const started = performance.now()
  let ttft = null
  let stats = {}
  const body = {
    model: MODEL,
    stream: true,
    keep_alive: '30m',
    messages: [{ role: 'system', content: SYSTEM }, ...messages],
    options: { num_predict: 256 }
  }
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const payload = JSON.parse(line)
      if (payload.message?.content && ttft === null) {
        ttft = Math.round(performance.now() - started)
      }
      if (payload.done) {
        stats = {
          promptTokens: payload.prompt_eval_count,
          generatedTokens: payload.eval_count,
          promptEvalMs: payload.prompt_eval_duration
            ? Math.round(payload.prompt_eval_duration / 1e6)
            : undefined,
          evalMs: payload.eval_duration ? Math.round(payload.eval_duration / 1e6) : undefined
        }
      }
    }
  }
  const after = await ps()
  return {
    case: label,
    ttftMs: ttft,
    totalMs: Math.round(performance.now() - started),
    modelLoadedBefore: before.loaded,
    modelLoadedAfter: after.loaded,
    usingGpu: before.sizeVram > 0,
    keepAlive: '30m',
    numPredict: 256,
    messageCount: messages.length,
    ...stats
  }
}

console.log(`compare-friday-ollama model=${MODEL}`)
console.log(
  JSON.stringify(
    await chat('friday_with_full_history_budget', [
      { role: 'user', content: 'List files' },
      { role: 'assistant', content: 'A'.repeat(480) },
      { role: 'user', content: 'Another' },
      { role: 'assistant', content: 'B'.repeat(480) },
      { role: 'user', content: 'Hey FRIDAY, how are you?' }
    ])
  )
)
console.log(
  JSON.stringify(
    await chat('friday_greeting_no_history', [{ role: 'user', content: 'Hey FRIDAY, how are you?' }])
  )
)
