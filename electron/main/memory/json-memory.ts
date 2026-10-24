import fs from 'node:fs'
import path from 'node:path'
import type { ChatMessage } from '../../../shared/types/ipc'
import type { TaskRun } from '../../../shared/types/tools'
import {
  factKey,
  mergeFactList,
  migrateLegacyFacts,
  type UserMemoryFact
} from './memory-facts'
import { archiveSessionMessages, type ArchivedSession } from './session-messages'
import type { MemoryStore } from './types'

interface StoreFile {
  messages: ChatMessage[]
  messageArchive?: ArchivedSession[]
  taskRuns: TaskRun[]
  userFacts: UserMemoryFact[]
}

export class JsonMemoryStore implements MemoryStore {
  private filePath: string
  private data: StoreFile

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'friday-memory.json')
    this.data = this.load()
  }

  private load(): StoreFile {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as StoreFile & { userFacts?: { fact: string; createdAt: number; id?: string }[] }
      return {
        messages: parsed.messages ?? [],
        messageArchive: parsed.messageArchive ?? [],
        taskRuns: parsed.taskRuns ?? [],
        userFacts: migrateLegacyFacts(parsed.userFacts ?? [])
      }
    } catch {
      return { messages: [], messageArchive: [], taskRuns: [], userFacts: [] }
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }

  beginSession(): void {
    const { session, archive } = archiveSessionMessages(this.data.messages, this.data.messageArchive ?? [])
    this.data.messages = session
    this.data.messageArchive = archive
    this.persist()
  }

  clearSessionMessages(): void {
    this.data.messages = []
    this.persist()
  }

  archivedSessionCount(): number {
    return this.data.messageArchive?.length ?? 0
  }

  saveMessage(message: ChatMessage): void {
    this.data.messages.push(message)
    if (this.data.messages.length > 500) {
      this.data.messages = this.data.messages.slice(-500)
    }
    this.persist()
  }

  recentMessages(limit = 30): ChatMessage[] {
    return this.data.messages.slice(-limit)
  }

  saveTaskRun(task: TaskRun): void {
    const idx = this.data.taskRuns.findIndex((t) => t.id === task.id)
    if (idx >= 0) this.data.taskRuns[idx] = task
    else this.data.taskRuns.push(task)
    this.persist()
  }

  addFact(fact: string): void {
    const { facts } = mergeFactList(this.data.userFacts, fact)
    this.data.userFacts = facts
    this.persist()
  }

  listFacts(): UserMemoryFact[] {
    return [...this.data.userFacts].sort((a, b) => a.createdAt - b.createdAt)
  }

  updateFact(id: string, fact: string): boolean {
    const idx = this.data.userFacts.findIndex((f) => f.id === id)
    if (idx < 0) return false
    const text = fact.trim()
    if (!text) return false
    const key = factKey(text)
    const dup = this.data.userFacts.findIndex((f) => f.id !== id && factKey(f.fact) === key)
    if (dup >= 0) return false
    this.data.userFacts[idx] = { ...this.data.userFacts[idx], fact: text, updatedAt: Date.now() }
    this.persist()
    return true
  }

  deleteFact(id: string): boolean {
    const next = this.data.userFacts.filter((f) => f.id !== id)
    if (next.length === this.data.userFacts.length) return false
    this.data.userFacts = next
    this.persist()
    return true
  }

  clearAllFacts(): void {
    this.data.userFacts = []
    this.persist()
  }

  forgetMatching(message: string): void {
    const lower = message.toLowerCase()
    this.data.userFacts = this.data.userFacts.filter((f) => !lower.includes(factKey(f.fact).slice(0, 12)))
    this.persist()
  }

  recentFacts(limit = 10): string[] {
    return this.listFacts()
      .slice(-limit)
      .map((f) => f.fact)
  }

  close(): void {
    this.persist()
  }
}
