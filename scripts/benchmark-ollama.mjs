/**
 * Compare Ollama latency: minimal prompt vs FRIDAY-style bloated single user blob.
 * Usage: node scripts/benchmark-ollama.mjs
 */
const BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1'

async function chat(body) {
  const started = performance.now()
  let ttft = null
  let stats = {}
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  if (!body.stream) {
    const json = await res.json()
    return {
      totalMs: Math.round(performance.now() - started),
      ttftMs: Math.round(performance.now() - started),
      stats: {
        promptTokens: json.prompt_eval_count,
        generatedTokens: json.eval_count
      }
    }
  }
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
          promptEvalMs: payload.prompt_eval_duration ? Math.round(payload.prompt_eval_duration / 1e6) : undefined,
          evalMs: payload.eval_duration ? Math.round(payload.eval_duration / 1e6) : undefined
        }
      }
    }
  }
  return { totalMs: Math.round(performance.now() - started), ttftMs: ttft, stats }
}

const bloatedUser = `Recent conversation:\n${'assistant: ' + '[GoogleGenerativeAI Error]: x'.repeat(40)}\nuser: Hey FRIDAY, how are you?\n\nKnown facts:\n- User's name is Alex\n\nHey FRIDAY, how are you?`

const cases = [
  {
    name: 'minimal_stream',
    body: {
      model: MODEL,
      stream: true,
      keep_alive: '30m',
      messages: [{ role: 'user', content: 'Hey FRIDAY, how are you?' }],
      options: { num_predict: 256 }
    }
  },
  {
    name: 'friday_old_blob_stream',
    body: {
      model: MODEL,
      stream: true,
      keep_alive: '30m',
      messages: [{ role: 'user', content: bloatedUser }],
      options: { num_predict: 256 }
    }
  },
  {
    name: 'friday_new_multiturn_stream',
    body: {
      model: MODEL,
      stream: true,
      keep_alive: '30m',
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'Hey FRIDAY, how are you?' }
      ],
      options: { num_predict: 256 }
    }
  }
]

console.log(`Ollama benchmark @ ${BASE} model=${MODEL}`)
for (const c of cases) {
  const r = await chat(c.body)
  console.log(
    JSON.stringify({
      case: c.name,
      ttftMs: r.ttftMs,
      totalMs: r.totalMs,
      ...r.stats
    })
  )
}
