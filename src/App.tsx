import { useState } from 'react'
import { ApprovalModal } from './components/approval/ApprovalModal'
import { AppHeader } from './components/layout/AppHeader'
import { CommandBar } from './components/layout/CommandBar'
import { MoreActionsMenu } from './components/layout/MoreActionsMenu'
import { NavSidebar, type FridayNavId } from './components/layout/NavSidebar'
import { QuickActions } from './components/layout/QuickActions'
import { SphereStateColumn } from './components/layout/SphereStateColumn'
import { SystemHud } from './components/layout/SystemHud'
import { ConversationPanel } from './components/panel/ConversationPanel'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { FridaySphere } from './components/sphere/FridaySphere'
import { useAgentSession } from './hooks/useAgentSession'
import { useVoiceInput } from './hooks/useVoiceInput'

export default function App() {
  const [nav, setNav] = useState<FridayNavId>('chat')
  const [moreOpen, setMoreOpen] = useState(false)
  const [composerPrefill, setComposerPrefill] = useState('')
  const session = useAgentSession()
  const voice = useVoiceInput((text) => {
    void session.sendMessage(text)
  })

  const particleCount = session.settings?.particleCount ?? 10_000

  if (nav === 'settings' && session.settings) {
    return (
      <div className="h-full flex flex-col bg-[#03070C] text-slate-200 hud-grid">
        <AppHeader />
        <div className="flex flex-1 min-h-0">
          <NavSidebar active={nav} onNavigate={setNav} speechOn={session.speechEnabled} online />
          <div className="flex-1 p-8 overflow-y-auto max-w-2xl">
            <SettingsPanel
              settings={session.settings}
              onSave={session.saveSettings}
              onClose={() => setNav('chat')}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto] bg-[#03070C] text-slate-100 overflow-hidden hud-grid floor-glow">
      <AppHeader />

      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_minmax(280px,400px)_4.5rem] min-h-0 min-w-0">
        <NavSidebar
          active={nav}
          onNavigate={setNav}
          speechOn={session.speechEnabled}
          online={session.ollamaStatus?.reachable ?? true}
        />

        <section className="relative min-w-0 min-h-0 overflow-hidden flex items-center justify-center">
          <SphereStateColumn visual={session.visual} listening={voice.listening} busy={session.busy} />
          <FridaySphere
            visual={session.visual}
            listening={voice.listening}
            busy={session.busy}
            speechEnergy={session.visual.energy}
            particleCount={particleCount}
          />
        </section>

        <section className="min-w-0 min-h-0 py-2 pr-2 pl-1 flex flex-col">
          <ConversationPanel
            messages={session.messages}
            streaming={session.streaming}
            progress={session.busy && !session.streaming ? session.taskProgress : null}
            task={session.activeTask}
            systemLines={session.systemLines}
          />
        </section>

        <SystemHud settings={session.settings} />
      </div>

      <div className="shrink-0 border-t border-[#28CFFF]/10 bg-[#020508]/95 backdrop-blur-sm pt-2 pb-2 space-y-2 col-span-full">
        <CommandBar
          disabled={session.busy}
          busy={session.busy}
          visual={session.visual}
          listening={voice.listening}
          taskProgress={session.taskProgress}
          micSupported={voice.supported}
          speechOn={session.speechEnabled}
          prefill={composerPrefill}
          onPrefillConsumed={() => setComposerPrefill('')}
          onToggleSpeech={() => {
            const next = !session.speechEnabled
            void session.saveSettings({ speechEnabled: next })
            if (!next) session.cancelSpeech()
          }}
          onSend={(t) => void session.sendMessage(t)}
          onToggleMic={voice.toggle}
          onCancel={session.cancelTask}
        />
        <QuickActions
          disabled={session.busy}
          onRun={async (id) => {
            const result = await session.runQuickAction(id)
            if (result.composerPrefill) setComposerPrefill(result.composerPrefill)
            if (result.openMore) setMoreOpen(true)
            return result
          }}
        />
      </div>

      <MoreActionsMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSettings={() => {
          setMoreOpen(false)
          setNav('settings')
        }}
        onToggleSpeech={() => {
          const next = !session.speechEnabled
          void session.saveSettings({ speechEnabled: next })
        }}
        speechOn={session.speechEnabled}
      />

      {session.approval && (
        <ApprovalModal
          request={session.approval}
          onRespond={(approved) => session.respondApproval(session.approval!.id, approved)}
        />
      )}
    </div>
  )
}
