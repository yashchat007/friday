import os from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlaywrightService } from '../../electron/main/automation/playwright-service'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { registerAllTools } from '../../electron/main/tools/register-all'

const runWindowsDesktop = process.env.RUN_WINDOWS_DESKTOP_TESTS === '1'

describe.runIf(runWindowsDesktop)('Notepad desktop tool chain (Windows)', () => {
  let registry: ToolRegistry
  let exec: ToolExecutor
  let playwright: PlaywrightService

  beforeEach(() => {
    registry = new ToolRegistry()
    playwright = new PlaywrightService(os.tmpdir())
    registerAllTools(registry, playwright, () => [], () => true)
    const gate = new ApprovalGate((req) => {
      gate.respond(req.id, true)
    })
    exec = new ToolExecutor(registry, gate, () => {}, [], '')
  })

  afterEach(async () => {
    await playwright.close()
  })

  it('launches Notepad, types text, and verifies process', async () => {
    const task = {
      id: 'notepad-1',
      userMessage: 'notepad test',
      status: 'running' as const,
      steps: [],
      startedAt: Date.now()
    }

    const launch = await exec.runStep(task, 'desktop_launch', { app: 'notepad', waitMs: 800 })
    expect(launch.ok).toBe(true)

    const verify = await exec.runStep(task, 'desktop_verify_process', { processName: 'notepad' })
    expect(verify.ok).toBe(true)
    expect((verify.result as { running: boolean }).running).toBe(true)

    const type = await exec.runStep(task, 'desktop_type_text', {
      text: 'Hi i am yash',
      processName: 'notepad',
      delayMs: 400
    })
    expect(type.ok).toBe(true)
  }, 60_000)
})

describe('Notepad orchestration (mocked tools)', () => {
  it('selects desktop tools for notepad intent', () => {
    const registry = new ToolRegistry()
    const playwright = new PlaywrightService(os.tmpdir())
    registerAllTools(registry, playwright, () => [], () => true)
    const names = registry.listDefinitions().map((d) => d.name)
    expect(names).toContain('desktop_launch')
    expect(names).toContain('desktop_type_text')
    expect(names).toContain('desktop_verify_process')
  })
})
