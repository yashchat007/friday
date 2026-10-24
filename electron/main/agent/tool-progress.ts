const LABELS: Record<string, string> = {
  browser_navigate: 'Opening browser',
  browser_youtube_search_play: 'Searching YouTube',
  browser_click: 'Selecting on page',
  browser_fill: 'Entering text in browser',
  browser_press_key: 'Sending keyboard input',
  browser_snapshot: 'Reading page state',
  desktop_launch: 'Launching application',
  desktop_type_text: 'Typing text',
  desktop_verify_process: 'Verifying process',
  file_read: 'Reading file',
  file_write: 'Writing file',
  file_list: 'Listing files',
  run_powershell: 'Running PowerShell'
}

export function toolProgressLabel(toolName: string): string {
  return LABELS[toolName] ?? `Running ${toolName.replace(/_/g, ' ')}`
}
