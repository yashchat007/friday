export type OllamaLoadedModel = {
  name: string
  sizeVram: number
  expiresAt?: string
}

export type OllamaRuntimeSnapshot = {
  loaded: OllamaLoadedModel[]
}

export async function fetchOllamaRuntime(baseUrl: string): Promise<OllamaRuntimeSnapshot> {
  try {
    const res = await fetch(`${baseUrl}/api/ps`, { method: 'GET' })
    if (!res.ok) return { loaded: [] }
    const json = (await res.json()) as {
      models?: { name?: string; size_vram?: number; expires_at?: string }[]
    }
    return {
      loaded: (json.models ?? []).map((m) => ({
        name: m.name ?? 'unknown',
        sizeVram: m.size_vram ?? 0,
        expiresAt: m.expires_at
      }))
    }
  } catch {
    return { loaded: [] }
  }
}

export function modelLoaded(snapshot: OllamaRuntimeSnapshot, model: string): boolean {
  const base = model.split(':')[0]
  return snapshot.loaded.some(
    (m) => m.name === model || m.name.startsWith(`${base}:`) || m.name.split(':')[0] === base
  )
}

export function usingGpu(snapshot: OllamaRuntimeSnapshot, model: string): boolean {
  const base = model.split(':')[0]
  const row = snapshot.loaded.find(
    (m) => m.name === model || m.name.startsWith(`${base}:`) || m.name.split(':')[0] === base
  )
  return (row?.sizeVram ?? 0) > 0
}
