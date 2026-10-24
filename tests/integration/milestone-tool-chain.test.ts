import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlaywrightService } from '../../electron/main/automation/playwright-service'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { registerAllTools } from '../../electron/main/tools/register-all'

/**
 * Milestone v0.1 (deterministic): file write + browser navigate + snapshot without LLM.
 */
describe('Milestone tool chain', () => {
  let tmpRoot: string
  let registry: ToolRegistry
  let exec: ToolExecutor
  let playwright: PlaywrightService

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `friday-milestone-${Date.now()}`)
    await fs.mkdir(tmpRoot, { recursive: true })
    registry = new ToolRegistry()
    playwright = new PlaywrightService(tmpRoot)
    registerAllTools(registry, playwright, () => [tmpRoot], () => true)
    const gate = new ApprovalGate((req) => {
      gate.respond(req.id, true)
    })
    exec = new ToolExecutor(registry, gate, () => {}, [tmpRoot], tmpRoot)
  })

  afterEach(async () => {
    await playwright.close()
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
    } catch {
      // Windows may keep Chrome profile files locked briefly after CDP close
    }
  })

  it(
    'writes a demo file and snapshots example.com',
    async () => {
    const task = {
      id: 'milestone-1',
      userMessage: 'milestone',
      status: 'running' as const,
      steps: [],
      startedAt: Date.now()
    }

    const demoDir = path.join(tmpRoot, 'FRIDAY-demo')
    await fs.mkdir(demoDir, { recursive: true })
    const helloPath = path.join(demoDir, 'hello.txt')
    const dateLine = new Date().toISOString().slice(0, 10)

    const writeStep = await exec.runStep(task, 'file_write', {
      filePath: helloPath,
      content: `FRIDAY milestone ${dateLine}\n`
    })
    expect(writeStep.ok).toBe(true)

    const navStep = await exec.runStep(task, 'browser_navigate', {
      url: 'https://example.com'
    })
    expect(navStep.ok).toBe(true)

    const snapStep = await exec.runStep(task, 'browser_snapshot', {})
    expect(snapStep.ok).toBe(true)
    const data = snapStep.result as { title?: string; text?: string }
    expect(data.title).toMatch(/example/i)
    expect(data.text).toMatch(/documentation examples/i)
    },
    120_000
  )
})
