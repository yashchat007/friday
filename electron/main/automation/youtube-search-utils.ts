/** Pure helpers for ranking YouTube search results (unit-tested without Playwright). */

export function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['"]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
}

export function scoreYouTubeTitle(query: string, title: string): number {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return 0
  const titleLower = title.toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (titleLower.includes(token)) score += 12
  }
  const compactQuery = tokens.join(' ')
  if (titleLower.includes(compactQuery)) score += 30
  if (titleLower.includes(query.toLowerCase().trim())) score += 40
  return score
}

export function pickBestYouTubeResultIndex(query: string, titles: string[]): number {
  if (titles.length === 0) return -1
  let bestIdx = 0
  let bestScore = -1
  for (let i = 0; i < titles.length; i++) {
    const s = scoreYouTubeTitle(query, titles[i])
    if (s > bestScore) {
      bestScore = s
      bestIdx = i
    }
  }
  return bestIdx
}

export function isYouTubeMatchAcceptable(query: string, title: string, minScore = 12): boolean {
  return scoreYouTubeTitle(query, title) >= minScore
}

export function extractYouTubeVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)
  return m?.[1] ?? null
}
