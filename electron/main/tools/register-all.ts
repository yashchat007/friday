import type { ToolRegistry } from './registry'
import type { PlaywrightService } from '../automation/playwright-service'
import { createFileTools } from './windows/file-tools'
import { createSystemTools } from './windows/system-tools'
import { createDesktopTools } from './windows/desktop-tools'
import { createBrowserTools } from './browser/browser-tools'
import { createWhatsAppTools } from './browser/whatsapp-tools'

export function registerAllTools(
  registry: ToolRegistry,
  playwright: PlaywrightService,
  getAllowedPaths: () => string[],
  useTestBrowser: () => boolean
): void {
  for (const tool of createFileTools(getAllowedPaths)) {
    registry.register(tool)
  }
  for (const tool of createSystemTools()) {
    registry.register(tool)
  }
  for (const tool of createDesktopTools()) {
    registry.register(tool)
  }
  for (const tool of createBrowserTools(playwright, useTestBrowser)) {
    registry.register(tool)
  }
  for (const tool of createWhatsAppTools(playwright, useTestBrowser)) {
    registry.register(tool)
  }
}
