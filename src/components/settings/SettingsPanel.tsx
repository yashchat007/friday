import { useEffect, useState } from 'react'
import type { FridaySettings, OllamaStatus } from '../../../shared/types/ipc'
import { PersonalMemoryPanel } from './PersonalMemoryPanel'

export function SettingsPanel({
  settings,
  onSave,
  onClose
}: {
  settings: FridaySettings
  onSave: (patch: Partial<FridaySettings>) => Promise<FridaySettings | void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(settings)
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [checking, setChecking] = useState(false)

  const refreshStatus = async () => {
    setChecking(true)
    const next = await window.friday.getOllamaStatus()
    setStatus(next)
    setChecking(false)
  }

  useEffect(() => {
    void refreshStatus()
  }, [draft.ollamaBaseUrl, draft.ollamaModel])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <h2 className="font-medium text-cyan-100">Settings</h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
      </div>

      <label className="block space-y-1">
        <span className="text-slate-400">AI provider</span>
        <select
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.aiProvider ?? 'ollama'}
          onChange={(e) => setDraft({ ...draft, aiProvider: e.target.value as FridaySettings['aiProvider'] })}
        >
          <option value="ollama">Ollama (local, default)</option>
          <option value="gemini">Gemini (cloud API key)</option>
        </select>
      </label>

      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs">
        <div className="text-slate-400">Provider status</div>
        <div className="text-cyan-100 font-medium">
          {draft.aiProvider === 'gemini' ? 'Gemini' : 'Ollama'}
        </div>
        {status && (
          <p className={`mt-1 ${status.reachable && status.modelAvailable ? 'text-emerald-400' : 'text-amber-300'}`}>
            {checking
              ? 'Checking Ollama…'
              : status.reachable && status.modelAvailable
                ? `Connected${status.version ? ` · Ollama ${status.version}` : ''} · model ready`
                : status.error ?? 'Ollama not ready'}
          </p>
        )}
        <button
          type="button"
          className="mt-2 text-cyan-300 hover:text-cyan-200 underline"
          onClick={() => void refreshStatus()}
        >
          Refresh status
        </button>
      </div>

      {draft.aiProvider === 'gemini' && (
        <>
          <label className="block space-y-1">
            <span className="text-slate-400">Gemini API key</span>
            <input
              type="password"
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
              value={draft.geminiApiKey ?? ''}
              onChange={(e) => setDraft({ ...draft, geminiApiKey: e.target.value })}
              placeholder="Google AI Studio key"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">Gemini model</span>
            <input
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
              value={draft.geminiModel ?? 'gemini-2.0-flash'}
              onChange={(e) => setDraft({ ...draft, geminiModel: e.target.value })}
            />
          </label>
        </>
      )}

      <label className="block space-y-1">
        <span className="text-slate-400">Ollama URL</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.ollamaBaseUrl}
          onChange={(e) => setDraft({ ...draft, ollamaBaseUrl: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Ollama model (automation)</span>
        {status?.models?.length ? (
          <select
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
            value={draft.ollamaModel}
            onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
          >
            {status.models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
            value={draft.ollamaModel}
            onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
            placeholder="llama3.1"
          />
        )}
        <p className="text-xs text-slate-500">FRIDAY does not download models automatically. Use `ollama pull` yourself.</p>
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Ollama chat model (optional, faster)</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.ollamaConversationModel ?? ''}
          onChange={(e) => setDraft({ ...draft, ollamaConversationModel: e.target.value })}
          placeholder="e.g. llama3.2:3b — leave empty to use automation model"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Allowed folders (one path per line)</span>
        <textarea
          className="w-full min-h-[88px] rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs"
          value={draft.allowedPaths.join('\n')}
          onChange={(e) =>
            setDraft({
              ...draft,
              allowedPaths: e.target.value
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
            })
          }
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Particle count (overlay)</span>
        <input
          type="number"
          min={2000}
          max={30000}
          step={1000}
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.particleCount}
          onChange={(e) => setDraft({ ...draft, particleCount: Number(e.target.value) || 12_000 })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Global shortcut (open floating chat)</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs"
          value={draft.globalShortcutChat ?? 'CommandOrControl+Shift+Space'}
          onChange={(e) => setDraft({ ...draft, globalShortcutChat: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.floatingOrbEnabled ?? true}
          onChange={(e) => setDraft({ ...draft, floatingOrbEnabled: e.target.checked })}
        />
        <span className="text-slate-300">Show floating FRIDAY orb on desktop</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.speechEnabled ?? true}
          onChange={(e) => setDraft({ ...draft, speechEnabled: e.target.checked })}
        />
        <span className="text-slate-300">Speak assistant replies (local voice)</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.playwrightHeadless}
          onChange={(e) => setDraft({ ...draft, playwrightHeadless: e.target.checked })}
        />
        <span className="text-slate-300">Use isolated test browser (CI / automation tests only)</span>
      </label>

      <label className="block space-y-1">
        <span className="text-slate-400">YouTube URL</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.youtubeUrl ?? 'https://www.youtube.com/'}
          onChange={(e) => setDraft({ ...draft, youtubeUrl: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">WhatsApp Web URL</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.whatsappWebUrl ?? 'https://web.whatsapp.com/'}
          onChange={(e) => setDraft({ ...draft, whatsappWebUrl: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.chromeAttachEnabled ?? true}
          onChange={(e) => setDraft({ ...draft, chromeAttachEnabled: e.target.checked })}
        />
        <span className="text-slate-300">Use existing Chrome via localhost CDP (recommended)</span>
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Chrome CDP URL (localhost only)</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs"
          value={draft.chromeCdpUrl ?? 'http://127.0.0.1:9222'}
          onChange={(e) => setDraft({ ...draft, chromeCdpUrl: e.target.value })}
        />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          If your everyday Chrome is not on port 9222, enable auto-launch below. FRIDAY opens a separate debug-enabled
          Chrome window (log in to YouTube/WhatsApp once there).
        </p>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.chromeAutoLaunchDebug ?? true}
          onChange={(e) => setDraft({ ...draft, chromeAutoLaunchDebug: e.target.checked })}
        />
        <span className="text-slate-300">Launch Chrome for FRIDAY when CDP is not available</span>
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Chrome executable (optional)</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs font-mono"
          value={draft.chromeExecutablePath ?? ''}
          onChange={(e) => setDraft({ ...draft, chromeExecutablePath: e.target.value })}
          placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Preferred speech voice (optional)</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs"
          value={draft.speechVoiceName ?? ''}
          onChange={(e) => setDraft({ ...draft, speechVoiceName: e.target.value })}
          placeholder="e.g. Microsoft Zira Desktop"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">Location label (HUD, optional)</span>
        <input
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2"
          value={draft.locationLabel ?? ''}
          onChange={(e) => setDraft({ ...draft, locationLabel: e.target.value })}
        />
      </label>

      <PersonalMemoryPanel />

      <button
        type="button"
        className="w-full rounded-lg bg-cyan-500/80 hover:bg-cyan-400 py-2 text-slate-950 font-medium"
        onClick={() => void onSave(draft)}
      >
        Save
      </button>
    </div>
  )
}
