import type { FridayApi } from '../shared/friday-api'

declare global {
  interface Window {
    friday: FridayApi
  }
}

export {}
