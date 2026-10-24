export function toolCallSignature(name: string, args: Record<string, unknown>): string {
  return `${name}:${stableStringify(args)}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** Blocks identical tool+args repeats within a sliding window (loop prevention). */
export class DuplicateActionGuard {
  private readonly recent: string[] = []

  constructor(
    private readonly maxIdenticalInWindow = 2,
    private readonly windowSize = 10
  ) {}

  reset(): void {
    this.recent.length = 0
  }

  /**
   * @returns true if this call should be skipped as a duplicate loop.
   */
  shouldBlock(name: string, args: Record<string, unknown>): boolean {
    const sig = toolCallSignature(name, args)
    const identical = this.recent.filter((s) => s === sig).length
    this.recent.push(sig)
    if (this.recent.length > this.windowSize) {
      this.recent.shift()
    }
    return identical >= this.maxIdenticalInWindow
  }
}
