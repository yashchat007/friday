import type { FridayVisualSnapshot } from '../shared/agent-visual-state'

declare global {
  interface Window {
    fridayOverlay?: {
      onVisualState: (handler: (snapshot: FridayVisualSnapshot) => void) => () => void
    }
  }
}

export {}
