import type { MemoryStore } from './types'
import { JsonMemoryStore } from './json-memory'

export type { MemoryStore } from './types'

/** Legacy export name used across the app. */
export type MemoryDb = MemoryStore

function memoryBackend(): 'json' | 'sqlite' {
  const forced = process.env.FRIDAY_MEMORY?.toLowerCase()
  if (forced === 'json' || forced === 'sqlite') return forced
  // Native better-sqlite3 must be rebuilt for Electron; loading a Node binary crashes the process.
  if (process.versions.electron) return 'json'
  return 'sqlite'
}

/**
 * Opens memory after `app.whenReady()`.
 * Uses JSON in Electron dev/runtime unless FRIDAY_MEMORY=sqlite and the module is rebuilt for Electron.
 */
export async function createMemoryDb(userDataPath: string): Promise<MemoryStore> {
  if (memoryBackend() === 'json') {
    console.info('[friday:memory] Using JSON store', userDataPath)
    return new JsonMemoryStore(userDataPath)
  }
  try {
    const { SqliteMemoryStore } = await import('./sqlite-memory.js')
    const store = new SqliteMemoryStore(userDataPath)
    console.info('[friday:memory] Using SQLite store')
    return store
  } catch (err) {
    console.warn('[friday:memory] SQLite unavailable, using JSON fallback.', err)
    return new JsonMemoryStore(userDataPath)
  }
}
