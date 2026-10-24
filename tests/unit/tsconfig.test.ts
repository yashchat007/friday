import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tsconfig.json', () => {
  it('does not use deprecated baseUrl (TypeScript 6+ / TS 7 removal)', () => {
    const configPath = resolve(import.meta.dirname, '../../tsconfig.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
    }
    expect(config.compilerOptions?.baseUrl).toBeUndefined()
    expect(config.compilerOptions?.paths?.['@shared/*']).toEqual(['./shared/*'])
  })
})
