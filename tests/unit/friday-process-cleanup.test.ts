import { describe, expect, it } from 'vitest'
import { buildFridayElectronTreeKillScript } from '../../electron/main/friday-process-cleanup'

describe('FRIDAY process cleanup script', () => {
  it('scopes kills to matching executable and child tree only', () => {
    const script = buildFridayElectronTreeKillScript(4242, 'C:\\friday\\node_modules\\electron\\dist\\electron.exe')
    expect(script).toContain('$root = 4242')
    expect(script).toContain('ParentProcessId=$root')
    expect(script).toContain('ExecutablePath -ne $exe')
    expect(script).not.toContain('Add-Tree $root')
  })
})
