import type { ProviderReadiness } from './providers/model-types'

const TTL_MS = 30_000

type CacheEntry = {
  key: string
  checkedAt: number
  readiness: ProviderReadiness
}

let cache: CacheEntry | null = null

export function getCachedReadiness(key: string): ProviderReadiness | null {
  if (!cache || cache.key !== key) return null
  if (Date.now() - cache.checkedAt > TTL_MS) return null
  return cache.readiness
}

export function setCachedReadiness(key: string, readiness: ProviderReadiness): void {
  cache = { key, checkedAt: Date.now(), readiness }
}

export function invalidateReadinessCache(): void {
  cache = null
}
