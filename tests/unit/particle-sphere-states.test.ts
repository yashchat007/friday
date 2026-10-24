import { describe, expect, it } from 'vitest'
import { SPHERE_VISUAL_PARAMS } from '../../src/visuals/particle-sphere'

describe('particle sphere visual states', () => {
  it('defines distinct params for idle, listening, thinking, speaking, task, and error', () => {
    const keys = Object.keys(SPHERE_VISUAL_PARAMS).sort()
    expect(keys).toEqual(['error', 'idle', 'listening', 'speaking', 'task', 'thinking'])
    expect(SPHERE_VISUAL_PARAMS.error.turbulence).toBeGreaterThan(SPHERE_VISUAL_PARAMS.idle.turbulence)
    expect(SPHERE_VISUAL_PARAMS.speaking.pulse).toBeGreaterThan(SPHERE_VISUAL_PARAMS.idle.pulse)
  })
})
