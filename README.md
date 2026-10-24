# FRIDAY

FRIDAY is a local Windows automation agent. You control it through a chat UI; it executes real tools on your computer (files, apps, PowerShell, browser automation via Playwright) using **Ollama** tool calling on your machine. Sensitive actions require your approval. No cloud API keys required.

## Prerequisites

- Node.js 20+
- Windows 10/11
- [Ollama](https://ollama.com/) running locally with **llama3.1** (or another tool-capable model)
- Playwright Chromium: `npx playwright install chromium`

## Setup

```bash
npm install
# Optional: copy .env.example for debug/test env vars — Ollama URL/model are set in Settings
```

## Development

```bash
npm run dev
```

FRIDAY runs from the system tray. Use the chat window to send tasks.

## Example tasks

**YouTube (requires approval for browser automation):**

> Open YouTube and play Desi Boys

FRIDAY opens Playwright Chromium, searches YouTube, picks a matching result, and **only reports success when playback is verified** (not merely when the watch page loads).

**Files + browser:**

> Create a folder FRIDAY-demo in my Documents, save hello.txt with today's date, open https://github.com/trending in the browser, and summarize the page.

**WhatsApp Desktop (Store / MSIX):**

> Open WhatsApp

FRIDAY activates the Store app by AUMID, waits for the **ApplicationFrameHost** main window (not internal `WhatsApp.Root` / WebView2 helpers), and verifies foreground when Windows allows. Main-process logs: lines starting with `[friday:whatsapp:trace]`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron in dev mode |
| `npm run build` | Production build |
| `npm run dist` | Windows installer (NSIS); see **Packaging** below |
| `npm test` | Unit + integration tests (live tests skipped by default) |
| `npm run test:milestone` | File write + browser snapshot milestone (no LLM) |
| `npm run test:browser` | Playwright smoke test |
| `$env:RUN_BROWSER_TESTS=1; npm test -- tests/integration/youtube-automation.test.ts` | Live YouTube search + **verified playback** |
| `$env:RUN_WINDOWS_DESKTOP_TESTS=1; npm test` | Live Notepad launch/type (Windows) |
| `$env:RUN_OLLAMA_LIVE=1; npm test -- tests/integration/ollama-greeting-live.test.ts` | Live Ollama latency check |

## Architecture

- **Main process**: `ToolRegistry`, `ToolExecutor`, `ApprovalGate`, `ToolCallingLoop`, `PlaywrightService`
- **Renderer**: nav · particle sphere · assistant panel, chat, approvals, execution timeline, voice I/O
- **Memory**: JSON store in Electron dev (`friday-memory.json`); optional SQLite after `npx @electron/rebuild -f -w better-sqlite3` and `FRIDAY_MEMORY=sqlite`
- **Overlay**: optional particle sphere window (tray → Particles)

## Memory

Chat history and facts are stored in SQLite under your user data folder. Use `/remember <fact>` to store a short user fact for future prompts.

## Packaging

`npm run dist` produces `dist/FRIDAY Setup *.exe` and `dist/win-unpacked/`.

On Windows you may need:

- **Developer Mode** enabled (Settings → System → For developers) so electron-builder can extract code-sign tooling, **or** run the terminal as Administrator.
- For rebuilding native modules (e.g. after upgrading Electron), install **Visual Studio Build Tools** with the “Desktop development with C++” workload. The repo sets `npmRebuild: false` to use prebuilt `better-sqlite3` binaries when possible.

Unsigned builds use `signAndEditExecutable: false` in `electron-builder.yml`.

## Security

- File tools are limited to allowed folders (profile, Desktop, Documents, Downloads by default).
- `run_powershell` blocks a small set of dangerous patterns; always requires approval.
- Settings (including optional Gemini keys) are stored locally via `electron-store`.
