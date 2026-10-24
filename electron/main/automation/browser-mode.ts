export type BrowserAutomationMode = 'user' | 'test'

/** Test/CI uses isolated Chromium; normal app uses installed Chrome (visible). */
export function resolveBrowserMode(playwrightHeadlessSetting: boolean): BrowserAutomationMode {
  if (process.env.FRIDAY_TEST_BROWSER === '1' || playwrightHeadlessSetting) {
    return 'test'
  }
  return 'user'
}
