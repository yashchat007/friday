import type { ChatMessage } from '../../../shared/types/ipc'
import type { TaskRun } from '../../../shared/types/tools'
import type { UserMemoryFact } from './memory-facts'

export type { UserMemoryFact } from './memory-facts'

export interface MemoryStore {
  /** Archive prior session messages and start a blank conversation (app launch). */
  beginSession(): void
  clearSessionMessages(): void
  saveMessage(message: ChatMessage): void
  recentMessages(limit?: number): ChatMessage[]
  saveTaskRun(task: TaskRun): void
  addFact(fact: string): void
  listFacts(): UserMemoryFact[]
  updateFact(id: string, fact: string): boolean
  deleteFact(id: string): boolean
  clearAllFacts(): void
  forgetMatching(message: string): void
  recentFacts(limit?: number): string[]
  close(): void
}
