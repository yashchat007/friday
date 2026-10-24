import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { ChatMessage } from '../../../shared/types/ipc'
import type { TaskRun } from '../../../shared/types/tools'
import { randomUUID } from 'node:crypto'
import { factKey, mergeFactList, type UserMemoryFact } from './memory-facts'
import type { MemoryStore } from './types'

interface LegacyStoreFile {
  messages: ChatMessage[]
  taskRuns: TaskRun[]
  userFacts: { fact: string; createdAt: number }[]
}

export class SqliteMemoryStore implements MemoryStore {
  private dbPath: string
  private jsonPath: string
  private db: Database.Database

  constructor(userDataPath: string) {
    this.dbPath = path.join(userDataPath, 'friday-memory.sqlite')
    this.jsonPath = path.join(userDataPath, 'friday-memory.json')
    fs.mkdirSync(userDataPath, { recursive: true })
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
    this.migrateFromJsonIfNeeded()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fact TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE TABLE IF NOT EXISTS message_archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        archived_at INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
    `)
    const cols = this.db.prepare('PRAGMA table_info(user_facts)').all() as { name: string }[]
    if (!cols.some((c) => c.name === 'fact_id')) {
      this.db.exec('ALTER TABLE user_facts ADD COLUMN fact_id TEXT')
    }
    if (!cols.some((c) => c.name === 'updated_at')) {
      this.db.exec('ALTER TABLE user_facts ADD COLUMN updated_at INTEGER')
    }
    const rows = this.db.prepare('SELECT id FROM user_facts WHERE fact_id IS NULL').all() as { id: number }[]
    for (const row of rows) {
      this.db.prepare('UPDATE user_facts SET fact_id = ? WHERE id = ?').run(randomUUID(), row.id)
    }
  }

  beginSession(): void {
    const rows = this.db
      .prepare('SELECT id, role, content, created_at FROM messages ORDER BY created_at ASC')
      .all() as { id: string; role: string; content: string; created_at: number }[]
    if (rows.length === 0) return
    const payload = JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        createdAt: r.created_at
      }))
    )
    this.db
      .prepare('INSERT INTO message_archive (archived_at, payload) VALUES (?, ?)')
      .run(Date.now(), payload)
    this.db.prepare('DELETE FROM messages').run()
  }

  clearSessionMessages(): void {
    this.db.prepare('DELETE FROM messages').run()
  }

  private migrateFromJsonIfNeeded(): void {
    const count = this.db.prepare('SELECT COUNT(*) AS c FROM messages').get() as { c: number }
    if (count.c > 0) return
    if (!fs.existsSync(this.jsonPath)) return

    try {
      const raw = fs.readFileSync(this.jsonPath, 'utf8')
      const legacy = JSON.parse(raw) as LegacyStoreFile
      const insertMsg = this.db.prepare(
        'INSERT OR IGNORE INTO messages (id, role, content, created_at) VALUES (?, ?, ?, ?)'
      )
      const insertTask = this.db.prepare(
        'INSERT OR IGNORE INTO task_runs (id, payload, updated_at) VALUES (?, ?, ?)'
      )
      const insertFact = this.db.prepare('INSERT INTO user_facts (fact, created_at) VALUES (?, ?)')

      const tx = this.db.transaction(() => {
        for (const m of legacy.messages ?? []) {
          insertMsg.run(m.id, m.role, m.content, m.createdAt)
        }
        for (const t of legacy.taskRuns ?? []) {
          insertTask.run(t.id, JSON.stringify(t), t.finishedAt ?? t.startedAt ?? Date.now())
        }
        for (const f of legacy.userFacts ?? []) {
          insertFact.run(f.fact, f.createdAt)
        }
      })
      tx()

      const backup = `${this.jsonPath}.bak`
      if (!fs.existsSync(backup)) {
        fs.copyFileSync(this.jsonPath, backup)
      }
    } catch (err) {
      console.warn('[friday:memory] JSON migration skipped:', err)
    }
  }

  saveMessage(message: ChatMessage): void {
    this.db
      .prepare('INSERT OR REPLACE INTO messages (id, role, content, created_at) VALUES (?, ?, ?, ?)')
      .run(message.id, message.role, message.content, message.createdAt)
    this.trimMessages()
  }

  private trimMessages(): void {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM messages').get() as { c: number }
    if (row.c <= 500) return
    this.db
      .prepare(
        `DELETE FROM messages WHERE id IN (
          SELECT id FROM messages ORDER BY created_at ASC LIMIT ?
        )`
      )
      .run(row.c - 500)
  }

  recentMessages(limit = 30): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT id, role, content, created_at FROM messages ORDER BY created_at DESC LIMIT ?')
      .all(limit) as { id: string; role: string; content: string; created_at: number }[]
    return rows
      .reverse()
      .map((r) => ({
        id: r.id,
        role: r.role as ChatMessage['role'],
        content: r.content,
        createdAt: r.created_at
      }))
  }

  saveTaskRun(task: TaskRun): void {
    this.db
      .prepare('INSERT OR REPLACE INTO task_runs (id, payload, updated_at) VALUES (?, ?, ?)')
      .run(task.id, JSON.stringify(task), task.finishedAt ?? Date.now())
  }

  addFact(fact: string): void {
    const current = this.listFacts()
    const { facts } = mergeFactList(current, fact)
    this.db.prepare('DELETE FROM user_facts').run()
    const insert = this.db.prepare(
      'INSERT INTO user_facts (fact_id, fact, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    for (const f of facts) {
      insert.run(f.id, f.fact, f.createdAt, f.updatedAt ?? null)
    }
  }

  listFacts(): UserMemoryFact[] {
    const rows = this.db
      .prepare('SELECT fact_id, fact, created_at, updated_at FROM user_facts ORDER BY created_at ASC')
      .all() as { fact_id: string; fact: string; created_at: number; updated_at: number | null }[]
    return rows.map((r) => ({
      id: r.fact_id,
      fact: r.fact,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined
    }))
  }

  updateFact(id: string, fact: string): boolean {
    const text = fact.trim()
    if (!text) return false
    const key = factKey(text)
    const dup = this.listFacts().find((f) => f.id !== id && factKey(f.fact) === key)
    if (dup) return false
    const res = this.db
      .prepare('UPDATE user_facts SET fact = ?, updated_at = ? WHERE fact_id = ?')
      .run(text, Date.now(), id)
    return res.changes > 0
  }

  deleteFact(id: string): boolean {
    const res = this.db.prepare('DELETE FROM user_facts WHERE fact_id = ?').run(id)
    return res.changes > 0
  }

  clearAllFacts(): void {
    this.db.prepare('DELETE FROM user_facts').run()
  }

  forgetMatching(message: string): void {
    const lower = message.toLowerCase()
    for (const f of this.listFacts()) {
      if (lower.includes(factKey(f.fact).slice(0, 12))) {
        this.deleteFact(f.id)
      }
    }
  }

  recentFacts(limit = 10): string[] {
    return this.listFacts()
      .slice(-limit)
      .map((f) => f.fact)
  }

  close(): void {
    this.db.close()
  }
}
