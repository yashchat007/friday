# FRIDAY Capability Audit

**Audit date:** 2026-03-19  
**Scope:** `C:\Users\Yash\Desktop\friday` (read-only code inspection + automated test run)  
**Auditor:** Cursor agent (no Windows GUI session, no live Ollama/Chrome/WhatsApp interaction during this audit)

---

## 1. Executive summary

FRIDAY is a **Windows-focused Electron desktop agent** (v0.1.0) that combines:

- A **main chat UI** (React) and an optional **floating orb overlay** with a compact panel.
- **Deterministic routing** for simple open/search/launch commands (`electron/main/agent/direct-actions/`).
- An **LLM tool-calling loop** (default **Ollama**, optional **Gemini**) with up to **15 steps** per task (`electron/main/agent/tool-loop.ts`).
- **19 registered tools** (files, shell, desktop, browser, WhatsApp Web).
- **Playwright** for headless test browser or **Chrome CDP attach** for user-profile automation.
- **WhatsApp Desktop** launch via MSIX/AUMID logic (`electron/main/automation/whatsapp-desktop.ts`).
- **Approvals** for non-`safe` tools, **task cancellation**, and **duplicate-action guards**.

Maturity is **strong for local dev automation plumbing** (tests, typed tools, structured logging) but **end-to-end Windows UX and external integrations are largely unverified in this audit**. Several README claims (SQLite default, tray “Particles”, weather HUD) are **partially outdated or UI-only**.

---

## 2. Overall maturity assessment

| Area | Maturity | Notes |
|------|----------|--------|
| Core agent + tools | **Medium–high** | Real implementations; heavy unit/integration test coverage |
| Desktop UX (orb, tray, shutdown) | **Medium** | Recently fixed; policy tests only, not GUI-verified here |
| Browser automation | **Medium** | CDP + Playwright; live tests gated by env vars |
| WhatsApp Desktop launch | **Medium** | Rich unit tests with mocks; live MSIX behavior environment-dependent |
| WhatsApp messaging | **Low–medium** | Web/CDP path only; requires Chrome + approvals |
| Voice | **Low–medium** | Web Speech API in renderer; no server STT |
| Vision / screen / computer use | **Not implemented** | Capability flags only; no capture/OCR tools |
| External APIs (Gmail, Calendar, GitHub) | **Not implemented** | URL opens only via known-site map |
| Gmail MCP / plugins | **Not present** in repo | No connector code found |

---

## 3. Master capability matrix

Statuses: **VW** Verified working (tests/logs) · **RU** Runtime unverified · **PI** Partially implemented · **ST** Stub/mock only · **NI** Not implemented · **BC** Blocked/configuration required

### A. Core AI agent

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Chat messages | User sends text; assistant replies in main UI and orb panel | Composer, orb panel, voice final transcript | `useAgentSession` → `friday:send-task` → `AgentService.handleUserMessage` | Ollama or Gemini configured | **RU** | `agent-service.ts`, IPC; live Ollama test optional | Single active task; blocks concurrent sends |
| Ollama provider | Tool-calling + streaming via local Ollama | Settings `aiProvider: ollama` | `electron/main/agent/providers/ollama-*` | Ollama running, tool-capable model | **VW** (unit) / **RU** (E2E) | `ollama-client.test.ts`, `RUN_OLLAMA_LIVE=1` integration | Model must support tools |
| Gemini provider | Cloud LLM when API key set | Settings `aiProvider: gemini` | `gemini-client.ts`, `create-llm-provider.ts` | `geminiApiKey` | **RU** | `gemini-client.test.ts` (mocked fetch) | Not live-verified |
| Direct actions (no LLM) | Open known sites, Google search URL, launch configured desktop apps | Phrases matched in `parseDirectAction` | `direct-actions/parse.ts`, `execute.ts` | Chrome CDP for URLs; Windows for apps | **VW** | `direct-actions.test.ts`, `whatsapp-intent.test.ts` | YouTube play defers to LLM; complex phrases skipped |
| Tool-calling loop | Multi-step tool execution (max 15) | Automation-classified messages | `tool-loop.ts` | Provider ready | **VW** (partial) | `tool-loop-ollama.test.ts`, `agent-intent-routing.test.ts` | Completion heuristics may stop early/late |
| Streaming UI | `text_delta` events during generation | LLM path | `AgentEvent` stream in `useAgentSession` | — | **RU** | Event types in `shared/types/ipc.ts` | Reloads messages on task end (dedup fix) |
| Task cancellation | Abort controller + approval clear | Cancel button, tray | `AgentService.cancelActiveTask` | — | **VW** | `ollama-abort.test.ts` | — |
| Duplicate action guard | Blocks repeated tool signatures in one task | Internal | `duplicate-action-guard.ts` | — | **VW** | `duplicate-action-guard.test.ts` | — |
| Factual shortcuts | Time/greeting without LLM | Conversation intent | `factual-queries.ts` | — | **VW** | `factual-queries.test.ts` | Narrow patterns |
| `/remember` facts | Stores user fact string | `/remember …` in chat | `memory.addFact` in `agent-service.ts` | Memory store | **VW** | `memory-facts.test.ts` | — |
| Auto fact extraction | Heuristic extraction from user text | On each message | `memory-extract.ts` | — | **VW** | `memory-extract.test.ts` | Not LLM-based |
| Intent routing | conversation vs automation | `classifyUserIntentWithContext` | `automation-context.ts` | — | **VW** | `automation-context.test.ts` | — |
| Output sanitization | Strips tool JSON from assistant text | On save | `output-sanitize.ts` | — | **VW** | `output-sanitize.test.ts` | — |

### B. Floating orb and desktop UX

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Floating orb window | 96×96 transparent frameless window, Three.js particles | `floatingOrbEnabled`, tray toggle | `orb-window.ts`, `overlay/OrbShell.tsx` | Electron transparent window | **RU** | `orb-transparency.test.ts`, `orb-window.test.ts` | Windows transparency not GUI-verified in audit |
| Orb drag / click | Drag moves window; click toggles panel | Pointer on orb button | `shared/orb-pointer.ts`, `moveOrbBy` IPC | — | **VW** (logic) / **RU** (GUI) | `orb-pointer.test.ts` | — |
| Multi-monitor position | Clamp, startup recovery, display-removed | Startup, drag, `display-removed` | `shared/orb-geometry.ts`, `applyStartupOrbDisplayPolicy` | `screen.getAllDisplays()` | **VW** | `orb-geometry.test.ts` | — |
| Orb compact chat | Same agent session as main chat | Orb panel | `useAgentSession` in overlay | — | **RU** | Shared hook | — |
| Global shortcut | Show orb with focus | Default `Ctrl+Shift+Space` | `global-shortcut.ts`, settings | OS shortcut slot free | **RU** | Registration logged on failure | — |
| Tray menu | Show FRIDAY, Hide to tray, orb toggle, cancel, quit | Tray icon | `tray.ts` | — | **RU** | Code inspection | — |
| Main window close | Full shutdown (orb + tray) | Title X / `windowClose` | `requestMainWindowClose` → `shutdown()` | — | **RU** | `friday-shutdown.test.ts`, `app-lifecycle.ts` | Not GUI-verified |
| Hide to tray | Hides chat only | `hideToTray`, tray item, — button | `hideChatToTray` | — | **RU** | IPC + `WindowControls.tsx` | Orb may remain |
| Shutdown cleanup | Destroy windows, tray, shortcuts, scoped electron tree | Tray Quit, close, dev signals | `shutdown()`, `friday-process-cleanup.ts` | — | **VW** (policy) / **RU** (process) | `friday-shutdown.test.ts`, `friday-process-cleanup.test.ts` | — |
| Main chat particle sphere | Three.js visual in center column | Always on chat nav | `FridaySphere`, `particle-sphere.ts` | GPU | **RU** | Visual code | Separate from orb window |
| Legacy fullscreen overlay | Full-screen particle overlay API exists | Setting `particleOverlayEnabled` | `createOverlayWindow` in `windows.ts` | — | **NI** (wired) | Not called from `index.ts` | Setting toggled but window not created |
| MediaPipe hand control | — | — | `overlay/workers/hand-landmarker.worker.ts` | CDN model | **NI** | Worker file unused (no imports) | Dead code |

### C. Desktop automation

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Launch desktop apps (aliases) | notepad, calc, mspaint, whatsapp via tools/direct | Tool `desktop_launch` or direct action | `desktop-tools.ts`, `windows-app-launch.ts` | Windows | **VW** / **RU** | `notepad-tool-chain` (env gated live) | `whatsapp` uses special MSIX path |
| Type into foreground app | SendKeys via PowerShell | `desktop_type_text` | `desktop-tools.ts` | Foreground window | **RU** | Tool implementation | Fragile; not UIA |
| Verify process running | Check process name | `desktop_verify_process` | `desktop-tools.ts` | — | **RU** | Tool code | — |
| WhatsApp Desktop launch | AUMID activation, window classification | “Open WhatsApp”, quick action | `whatsapp-desktop.ts` | Store WhatsApp installed | **VW** (mocked) / **RU** (live) | `whatsapp-desktop.test.ts` | Foreground often blocked; user-facing sanitizer |
| Arbitrary app UI control | — | — | — | — | **NI** | No UIA/WinAppDriver | Launch + type only |
| `app_launch` / shell.openPath | Open path with default handler | Tool | `system-tools.ts` | — | **RU** | Registered tool | Approval: sensitive |

### D. Browser automation and web access

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Playwright test browser | Headless/headed Chromium for tools | `playwrightHeadless` / test mode | `playwright-service.ts` | `npx playwright install chromium` | **VW** | `milestone-tool-chain.test.ts` | Isolated profile |
| Chrome CDP attach | Automate existing Chrome tabs | Settings `chromeAttachEnabled` | `chrome-cdp.ts`, `chrome-session.ts` | Chrome `--remote-debugging-port` | **VW** (unit) / **RU** (live) | `cdp-probe.test.ts`, `chrome-cdp.test.ts` | User must enable |
| Chrome auto-launch debug | FRIDAY can spawn debug Chrome | `chromeAutoLaunchDebug` | `windows-chrome-launch.ts` | Chrome path | **RU** | Used in navigate flows | — |
| Navigate + verify | `browser_navigate` | LLM tool | `browser-tools.ts` | Browser mode | **VW** | milestone integration | — |
| Click / fill / key | DOM interaction | Tools | `browser-tools.ts` | Page open | **RU** | Tool code | Selectors fragile |
| Page snapshot | Text snapshot of page | `browser_snapshot` | `browser-tools.ts` | — | **RU** | Tool code | Not vision model |
| YouTube search & play | Search and verify playback | Playbook + tool / loop | `youtube-automation.ts`, `tool-loop.ts` | Browser | **VW** (logic) / **RU** (live) | `youtube-playbook.test.ts`; `RUN_BROWSER_TESTS` skipped by default | — |
| Open site in Chrome (direct) | Known sites + Google search | Direct actions | `open-site-playbook.ts`, `executeDirectAction` | CDP | **VW** | `open-site-playbook.test.ts` | — |
| Web search without browser | Opens Google search URL only | Direct `google_search` | `parse.ts` | CDP navigate | **VW** | `direct-actions.test.ts` | Does not scrape results |

### E. WhatsApp

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Desktop launch | Activate Store app, detect presentable window | “Open WhatsApp” | `whatsapp-desktop.ts`, `windows-app-launch.ts` | MSIX WhatsApp | **VW** (mock) / **RU** (live) | 19 tests in `whatsapp-desktop.test.ts` | Does not send messages |
| User-facing launch messages | Short status only | Chat / direct path | `formatWhatsAppLaunchMessage` | — | **VW** | `whatsapp-desktop.test.ts` | Diagnostics in console only |
| WhatsApp Web prepare | Open web, find contact, draft | Tool `whatsapp_prepare` / playbook | `whatsapp-automation.ts` | Logged-in WhatsApp Web in browser | **RU** | Tool + `tool-loop` WhatsApp path | — |
| Send message | Send in open chat | Tool `whatsapp_send_message` | `whatsapp-automation.ts` | Approval (destructive) | **RU** | Tool definition | Compound “open and send” uses desktop + disclaimer |
| Read messages / OCR | — | — | — | — | **NI** | — | — |

### F. Integrations and external services

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Gmail / Calendar / GitHub APIs | — | — | — | — | **NI** | Only `knownSiteUrl` opens HTTPS | No OAuth |
| Open known websites | leetcode, github, gmail, etc. | “Open github” | `direct-actions/registry.ts` | Chrome CDP | **VW** | `direct-actions.test.ts` | Navigation only |
| OpenWeather | UI label only | Settings keys | `SystemHud.tsx` | `weatherApiKey`, `weatherCity` | **ST** | HUD shows “WEATHER” if keys set | **No fetch implementation found** |
| Ollama status | Model list / reachability | Settings / HUD | `get-ollama-status` IPC | Ollama | **RU** | `ollama-client.ts` | — |

### G. Screen understanding and computer use

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Screen capture | — | — | — | — | **NI** | Intent regex mentions screenshot; no tool | — |
| OCR / vision analysis | — | — | — | — | **NI** | — | — |
| Provider vision flags | Reports if model name looks like llava / Gemini key set | Settings panel capabilities | `provider-capabilities.ts` | Model/key | **BC** | `provider-capabilities.test.ts` | **No image pipeline to model** |
| UI Automation tree | — | — | — | — | **NI** | — | — |

### H. Voice

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Speech-to-text | Browser Web Speech API, push-to-talk mic | Command bar mic | `useVoiceInput.ts` | Chromium/Electron speech | **RU** | Code only | `speech-voice.test.ts` is helper utils |
| Text-to-speech | `speechSynthesis` for assistant replies | `speechEnabled` | `useFridaySpeech.ts` | OS voices | **RU** | Hooks + settings | — |
| Speech visual energy | Orb/main visual pulse during TTS | TTS onstart | `setSpeechVisualEnergy` IPC | — | **RU** | `agent-visual-state` | — |
| Wake word / always-on mic | — | — | — | — | **NI** | — | — |

### I. Memory and personalization

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Session chat history | Recent messages in prompts | Automatic | `MemoryStore.recentMessages` | JSON or SQLite | **VW** | `session-memory.test.ts`, `message-sync.test.ts` | — |
| Persistent facts | User facts across restarts | `/remember`, extraction | `memory-facts`, JSON/SQLite | `userData` path | **VW** | `memory-facts.test.ts` | Electron defaults to **JSON** (`memory/db.ts`) |
| Task run persistence | Task steps saved | On completion | `memory.saveTaskRun` | — | **RU** | `agent-service.ts` | — |
| Clear session / memories | UI actions | Settings / IPC | `clear-session`, `clear-memories` | — | **RU** | IPC handlers | — |
| Secrets storage | Settings in electron-store | Settings UI | `settings.ts` | Local disk | **RU** | `FridaySettings` | Gemini key local |

### J. Safety, reliability, security

| Capability | What FRIDAY can do | Trigger | Implementation | Dependencies | Status | Evidence | Limitations |
|------------|-------------------|---------|----------------|--------------|--------|----------|-------------|
| Tool risk approvals | sensitive/destructive need UI approval | Before tool run | `executor.ts`, `ApprovalGate` | — | **VW** | `approval-gate.test.ts` | safe tools auto-run |
| Path sandbox | File tools restricted | `allowedPaths` | `path-policy.ts`, executor context | — | **VW** | `path-policy.test.ts` | User can widen paths |
| PowerShell deny patterns | Blocks some destructive patterns | `run_powershell` | `system-tools.ts` | Approval still required | **RU** | Code | Not comprehensive |
| Single-instance lock | One FRIDAY instance | App start | `requestSingleInstanceLock` in `index.ts` | — | **RU** | Code | — |
| Process cleanup on quit | Child electron tree under FRIDAY execPath | `shutdown()` | `friday-process-cleanup.ts` | — | **VW** (unit scope) | `friday-process-cleanup.test.ts` | Must not kill unrelated apps |
| WhatsApp log hygiene | Diagnostics not in chat | Launch | `sanitizeWhatsAppUserError` | — | **VW** | `whatsapp-desktop.test.ts` | — |

### K. UI and quick actions

| UI element | Real operation? | Path | Status |
|------------|-----------------|------|--------|
| Chat composer send | `sendTask` | **RU** |
| Mic toggle | Web Speech → `sendMessage` | **RU** |
| Speech on/off | Settings + TTS | **RU** |
| Cancel task | `cancelTask` | **VW** (logic) |
| Quick: Open YouTube | CDP navigate | **BC** if CDP off · **RU** if on |
| Quick: Open WhatsApp | `launchWindowsApp` | **RU** |
| Quick: Search web | Google in Chrome + prefill | **BC** / **RU** |
| Quick: Explain code | Composer prefill only | **ST** (no auto analysis) |
| Quick: Write note | Sends automation message “Open Notepad…” | **RU** |
| Quick: More | Opens `MoreActionsMenu` | **VW** |
| Settings save | `setSettings` + side effects | **RU** |
| Approval modal | `respondApproval` | **VW** |
| Nav: Chat / Settings only | No other pages | **VW** |
| System HUD CPU/RAM | `readSystemMetrics` | **VW** |
| System HUD NET | Always `null` | **ST** |
| System HUD WEATHER | Keys only, no API | **ST** |
| `PlaceholderView` | Component exists | **NI** in main `App.tsx` nav |

---

## 4. Registered tools catalog

All tools registered via `electron/main/tools/register-all.ts`.

| Tool name | Risk | Approval? | Implementation | Real-world effect | Tests / notes |
|-----------|------|-----------|----------------|-------------------|---------------|
| `file_list` | safe | No | `file-tools.ts` | Lists dirs under policy | path-policy tests |
| `file_read` | safe | No | `file-tools.ts` | Reads text files | milestone chain |
| `file_write` | sensitive | Yes | `file-tools.ts` | Writes files | milestone chain |
| `file_move` | sensitive | Yes | `file-tools.ts` | Moves within policy | — |
| `file_delete` | destructive | Yes | `file-tools.ts` | Deletes files | — |
| `path_resolve` | safe | No | `file-tools.ts` | Resolves paths under policy | — |
| `app_launch` | sensitive | Yes | `system-tools.ts` | `shell.openPath` | — |
| `open_external` | safe | No | `system-tools.ts` | Default browser URL | — |
| `run_powershell` | sensitive | Yes | `system-tools.ts` | Runs PS with deny list | — |
| `desktop_launch` | sensitive | Yes | `desktop-tools.ts` | `cmd start` executable | notepad integration (gated) |
| `desktop_type_text` | sensitive | Yes | `desktop-tools.ts` | PowerShell SendKeys | — |
| `desktop_verify_process` | safe | No | `desktop-tools.ts` | Process probe | — |
| `browser_navigate` | safe | No | `browser-tools.ts` | Playwright or CDP | milestone |
| `browser_click` | sensitive | Yes | `browser-tools.ts` | DOM click | — |
| `browser_fill` | sensitive | Yes | `browser-tools.ts` | DOM fill | — |
| `browser_press_key` | sensitive | Yes | `browser-tools.ts` | Key press | — |
| `browser_youtube_search_play` | sensitive | Yes | `browser-tools.ts` | YouTube automation | unit playbook |
| `browser_snapshot` | safe | No | `browser-tools.ts` | Page text snapshot | — |
| `whatsapp_prepare` | safe | No | `whatsapp-tools.ts` | WA Web prep | — |
| `whatsapp_send_message` | destructive | Yes | `whatsapp-tools.ts` | Sends in WA Web | — |

**Max tool loop steps:** 15 (`tool-loop.ts` default `maxSteps`).

---

## 5. IPC / action catalog

### `ipcMain.handle` (invoke)

| Channel | Purpose |
|---------|---------|
| `friday:get-settings` | Read `electron-store` settings |
| `friday:set-settings` | Patch settings; orb/shortcut side effects |
| `friday:get-messages` | Recent chat messages |
| `friday:get-memories` | User facts |
| `friday:update-memory` / `delete-memory` / `clear-memories` | Fact CRUD |
| `friday:clear-session` | Clear session messages |
| `friday:get-system-metrics` | CPU/RAM snapshot |
| `friday:get-provider-capabilities` | Text/tools/vision flags |
| `friday:get-orb-state` | Panel expanded flag |
| `friday:set-orb-panel-expanded` | Resize orb + persist |
| `friday:save-orb-position` | Persist bounds |
| `friday:move-orb-by` | Drag delta + cursor for clamp |
| `friday:quick-action` | Quick action bar |
| `friday:get-ollama-status` | Ollama health |
| `friday:send-task` | Main agent entry |
| `friday:cancel-task` | Abort task |
| `friday:is-task-running` | Busy flag |
| `friday:respond-approval` | Approve/deny tool |
| `friday:toggle-overlay` | Show/hide orb |

### `ipcMain.on` (send)

| Channel | Purpose |
|---------|---------|
| `friday:window-minimize` | Minimize chat |
| `friday:hide-to-tray` | Hide chat to tray |
| `friday:window-maximize` | Maximize toggle |
| `friday:window-close` | Full shutdown |
| `friday:speech-visual` | TTS energy to orb visual |

Preload: `electron/preload/index.ts` → `shared/friday-api.ts` (`FridayApi`).

---

## 6. UI and quick-action audit

See section 3K. **Misleading / placeholder:** “Explain code” (prefill only), weather HUD (no API), NET metric (always dash), README “Particles” tray vs actual orb-only overlay, README SQLite default vs Electron JSON default.

---

## 7. External integration status

| Integration | Code | Auth | Verified |
|-------------|------|------|----------|
| Ollama | Yes | Local URL | Unit + optional live test |
| Google Gemini | Yes | API key in settings | Mocked unit tests only |
| Chrome CDP | Yes | User Chrome debug port | Unit + optional live |
| Playwright Chromium | Yes | Bundled | Integration milestone |
| WhatsApp Desktop | Yes | OS install | Mocked unit tests |
| WhatsApp Web | Yes | Browser session | Not live-audited |
| Gmail/Calendar/GitHub API | No | — | URL open only |
| OpenWeather | No | Keys in settings only | **Not implemented** |
| Gmail MCP | Not in repo | — | — |

---

## 8. Verification evidence and test limitations

**Run during audit (2026-03-19):**

```
npm test → 59 files passed, 2 skipped (61); 165 passed, 3 skipped (168)
```

**Skipped / gated tests:**

| Test file | Gate |
|-----------|------|
| `tests/integration/playwright-browser.test.ts` | `RUN_BROWSER_TESTS=1` |
| `tests/integration/youtube-automation.test.ts` | `RUN_BROWSER_TESTS=1` |
| `tests/integration/notepad-tool-chain.test.ts` (1 test) | `RUN_WINDOWS_DESKTOP_TESTS=1` |
| `tests/integration/ollama-greeting-live.test.ts` | `RUN_OLLAMA_LIVE=1` |

**Mock-heavy areas:** WhatsApp desktop (PowerShell/COM), Ollama/Gemini HTTP, Chrome CDP in unit tests.

**Not performed in this audit:** Windows GUI manual tests (orb transparency, drag, quit), live WhatsApp MSIX, live YouTube playback, live Notepad typing.

---

## 9. Security and reliability findings

1. **File path policy** is configurable — widening `allowedPaths` increases risk (`path-policy.ts`).
2. **`run_powershell`** is powerful even with deny patterns; requires approval but not sandboxed execution.
3. **Browser tools** can act on logged-in user sessions when CDP attached (cookies, accounts).
4. **`whatsapp_send_message`** is destructive risk — approval UI shows contact + message.
5. **Secrets** (`geminiApiKey`, `weatherApiKey`) stored locally via `electron-store` — not OS keychain.
6. **Dev stdin shutdown** and **single-instance** behavior documented in lifecycle tests; early stdin close ignored until bootstrap completes.
7. **No content security model** for untrusted web page text fed to LLM beyond sanitization of assistant output.

---

## 10. Gaps, contradictions, and recommendations

### Implemented and evidenced (tests)

- Tool registry schema/approval wiring, duplicate guard, direct-action parsing, WhatsApp message sanitization, orb geometry, message sync, many playbook/unit tests.

### Implemented but runtime unverified

- Full Electron UX (orb transparency, tray, shutdown), Chrome CDP live flows, Gemini live, desktop typing, WhatsApp Web send E2E.

### Partially implemented

- Weather HUD, network metric, particle overlay setting vs `createOverlayWindow`, README memory backend story, “Explain code” quick action.

### Mocked / misleading UI

- Weather display; NET bandwidth; explain-code button (prefill only).

### Planned / missing (dependencies or dead code)

- Screen capture, OCR, vision pipeline, UIA, Gmail/Calendar APIs, MediaPipe hand worker (file present, **not imported**), screenshot tool despite intent regex.

### README / doc contradictions

| Claim | Reality |
|-------|---------|
| “Memory: SQLite” default | `createMemoryDb` uses **JSON in Electron** unless `FRIDAY_MEMORY=sqlite` + native rebuild |
| “tray → Particles” | `createOverlayWindow` unused; use floating orb |
| “voice I/O” in architecture | STT/TTS via Web APIs only; no server pipeline |

### Prioritized recommendations

| Priority | Item |
|----------|------|
| **P0** | Align README with memory backend and overlay behavior; remove or wire weather HUD |
| **P0** | Document Chrome CDP requirement prominently (automation blocked without it in user mode) |
| **P1** | Live smoke checklist for orb + shutdown on Windows (document in README) |
| **P1** | Either implement OpenWeather fetch or remove weather settings/HUD |
| **P2** | Remove or integrate dead `hand-landmarker.worker.ts` and `createOverlayWindow` |
| **P2** | Add screenshot tool or remove from intent-router vocabulary |
| **P3** | SQLite-by-default path for Electron with documented rebuild steps |

---

## Appendix: Key file index

| Path | Role |
|------|------|
| `electron/main/index.ts` | App bootstrap, IPC, tray, shutdown |
| `electron/main/agent/agent-service.ts` | Message routing |
| `electron/main/agent/tool-loop.ts` | LLM tool loop |
| `electron/main/tools/executor.ts` | Approvals + execution |
| `electron/main/automation/whatsapp-desktop.ts` | Desktop WhatsApp |
| `electron/main/automation/playwright-service.ts` | Browser sessions |
| `overlay/OrbShell.tsx` | Floating orb UI |
| `src/hooks/useAgentSession.ts` | Chat/orb agent binding |
| `shared/types/ipc.ts` | Settings and events |

---

*End of audit report.*
