import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

function expandHome(input: string): string {
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1).replace(/^[/\\]/, ''))
  }
  const userProfile = process.env.USERPROFILE
  if (userProfile && input.toLowerCase().startsWith('%userprofile%')) {
    return path.join(userProfile, input.slice('%userprofile%'.length).replace(/^[/\\]/, ''))
  }
  return input
}

export function resolveUserPath(raw: string, allowedRoots: string[]): string {
  const expanded = expandHome(raw.trim())
  const resolved = path.resolve(expanded)
  const normalized = path.normalize(resolved)

  const roots = allowedRoots.map((r) => path.resolve(expandHome(r)))
  const allowed = roots.some((root) => {
    const rel = path.relative(root, normalized)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
  })

  if (!allowed) {
    throw new Error(`Path not allowed: ${normalized}`)
  }
  return normalized
}

export function defaultAllowedRoots(): string[] {
  const home = os.homedir()
  return [
    home,
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Downloads')
  ]
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}
