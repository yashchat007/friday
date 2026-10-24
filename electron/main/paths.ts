import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Directory of the compiled main bundle (`out/main`). */
export const mainDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * electron-vite emits preload as `index.mjs` when package.json `"type": "module"`.
 * @see node_modules/electron-vite — entryFileNames `[name].mjs` for preload
 */
export function preloadScriptPath(): string {
  return path.join(mainDir, '../preload/index.mjs')
}

export function overlayPreloadScriptPath(): string {
  return path.join(mainDir, '../preload/overlay.mjs')
}
