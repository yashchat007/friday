import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ApprovalGate } from '../../electron/main/tools/approval-gate'
import { ToolExecutor } from '../../electron/main/tools/executor'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { createFileTools } from '../../electron/main/tools/windows/file-tools'

describe('ToolExecutor file_write', () => {
  let tmpRoot: string
  let registry: ToolRegistry
  let exec: ToolExecutor

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `friday-test-${Date.now()}`)
    await fs.mkdir(tmpRoot, { recursive: true })
    registry = new ToolRegistry()
    for (const tool of createFileTools(() => [tmpRoot])) {
      registry.register(tool)
    }
    const gate = new ApprovalGate((req) => {
      gate.respond(req.id, true)
    })
    exec = new ToolExecutor(registry, gate, () => {}, [tmpRoot], tmpRoot)
  })

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('writes a file after approval', async () => {
    const task = {
      id: 'task-1',
      userMessage: 'test',
      status: 'running' as const,
      steps: [],
      startedAt: Date.now()
    }

    const step = await exec.runStep(task, 'file_write', {
      filePath: path.join(tmpRoot, 'hello.txt'),
      content: 'FRIDAY'
    })

    expect(step.ok).toBe(true)
    const content = await fs.readFile(path.join(tmpRoot, 'hello.txt'), 'utf8')
    expect(content).toBe('FRIDAY')
  })
})
