import { useCallback, useEffect, useRef, useState } from 'react'
import { IDLE_VISUAL, type FridayVisualSnapshot } from '../shared/agent-visual-state'
import { ParticleSphere } from '../src/visuals/particle-sphere'
import { useAgentSession } from '../src/hooks/useAgentSession'
import { FloatingChatPanel } from './FloatingChatPanel'
import {
  accumulateOrbDragDistance,
  shouldTreatOrbGestureAsClick
} from '../shared/orb-pointer'

function readParticleCount(): number {
  const raw = localStorage.getItem('friday-particle-count')
  const n = raw ? Number(raw) : 6000
  return Number.isFinite(n) ? Math.min(12_000, Math.max(1500, n)) : 6000
}

export function OrbShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualRef = useRef<FridayVisualSnapshot>(IDLE_VISUAL)
  const [panelOpen, setPanelOpen] = useState(false)
  const session = useAgentSession()
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    total: 0
  })

  const syncPanelState = useCallback(
    (open: boolean) => {
      setPanelOpen(open)
      void window.friday.setOrbPanelExpanded(open)
    },
    []
  )

  useEffect(() => {
    void window.friday.getOrbState().then((state) => {
      if (state.panelExpanded) setPanelOpen(true)
    })
    return window.friday.onOrbPanelCommand((cmd) => {
      if (cmd === 'open') setPanelOpen(true)
      if (cmd === 'close') setPanelOpen(false)
      if (cmd === 'toggle') setPanelOpen((v) => !v)
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sphere = new ParticleSphere(canvas, readParticleCount())
    let raf = 0

    const draw = () => {
      const v = visualRef.current
      const mapped = v.state === 'task' ? 'task' : v.state
      sphere.setVisualState(mapped, v.energy)
      sphere.tick()
      raf = requestAnimationFrame(draw)
    }

    const onResize = () => sphere.resize(canvas.clientWidth, canvas.clientHeight)
    const ro = new ResizeObserver(onResize)
    ro.observe(canvas)
    onResize()
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      sphere.dispose()
    }
  }, [])

  useEffect(() => {
    visualRef.current = session.visual
  }, [session.visual])

  const togglePanel = () => syncPanelState(!panelOpen)

  const onOrbPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      lastX: e.screenX,
      lastY: e.screenY,
      total: 0
    }
  }

  const onOrbPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active) return
    const dx = e.screenX - dragRef.current.lastX
    const dy = e.screenY - dragRef.current.lastY
    dragRef.current.lastX = e.screenX
    dragRef.current.lastY = e.screenY
    dragRef.current.total = accumulateOrbDragDistance(dragRef.current.total, dx, dy)
    if (!shouldTreatOrbGestureAsClick(dragRef.current.total)) {
      void window.friday.moveOrbBy(dx, dy, e.screenX, e.screenY)
    }
  }

  const onOrbPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.active && shouldTreatOrbGestureAsClick(dragRef.current.total)) {
      togglePanel()
    }
    dragRef.current.active = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
  }

  return (
    <div className="h-full w-full flex flex-col-reverse items-end justify-end gap-2 overflow-hidden p-0 box-border bg-transparent">
      <button
        type="button"
        className="orb-hit-target orb-sphere-glow no-drag relative shrink-0 rounded-full overflow-hidden border-2 border-cyan-400/45 touch-none"
        style={{ width: 96, height: 96 }}
        onPointerDown={onOrbPointerDown}
        onPointerMove={onOrbPointerMove}
        onPointerUp={onOrbPointerUp}
        onPointerCancel={onOrbPointerUp}
        aria-label="FRIDAY orb"
      >
        <canvas ref={canvasRef} className="w-full h-full pointer-events-none" width={96} height={96} />
        {session.busy ? (
          <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
        ) : null}
      </button>

      <FloatingChatPanel
        open={panelOpen}
        busy={session.busy}
        streaming={session.streaming}
        taskProgress={session.taskProgress}
        messages={session.messages}
        approval={session.approval}
        onSend={session.sendMessage}
        onCancel={session.cancelTask}
        onApprove={session.respondApproval}
        onClose={() => syncPanelState(false)}
      />

      <style>{`
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>
    </div>
  )
}
