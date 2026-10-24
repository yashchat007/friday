import { useEffect, useRef } from 'react'
import type { FridayVisualSnapshot } from '../../../shared/agent-visual-state'
import { ParticleSphere, type SphereVisualState } from '../../visuals/particle-sphere'

function mapVisual(v: FridayVisualSnapshot, listening: boolean): SphereVisualState {
  if (listening) return 'listening'
  if (v.state === 'task') return 'task'
  if (v.state === 'error') return 'error'
  return v.state
}

export function FridaySphere({
  visual,
  listening,
  speechEnergy,
  particleCount
}: {
  visual: FridayVisualSnapshot
  listening: boolean
  busy: boolean
  speechEnergy: number
  particleCount: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sphereRef = useRef<ParticleSphere | null>(null)
  const shockwaveSeen = useRef(0)
  const visualRef = useRef({ visual, listening, speechEnergy })

  useEffect(() => {
    visualRef.current = { visual, listening, speechEnergy }
  }, [visual, listening, speechEnergy])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const count = Math.min(24_000, Math.max(5000, particleCount))
    const sphere = new ParticleSphere(canvas, count)
    sphereRef.current = sphere
    let raf = 0
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const loop = () => {
      const { visual: v, listening: mic, speechEnergy: energy } = visualRef.current
      const mapped = mapVisual(v, mic)
      const e = mapped === 'speaking' ? Math.max(v.energy, energy) : v.energy
      sphere.setVisualState(mapped, e)
      sphere.tick()
      if (sphere.shouldRunFast()) {
        raf = requestAnimationFrame(loop)
      } else {
        idleTimer = setTimeout(loop, 120)
      }
    }

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      sphere.resize(parent.clientWidth, parent.clientHeight)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      if (idleTimer) clearTimeout(idleTimer)
      ro.disconnect()
      sphereRef.current = null
      sphere.dispose()
    }
  }, [particleCount])

  useEffect(() => {
    if (visual.shockwaveTick > shockwaveSeen.current) {
      shockwaveSeen.current = visual.shockwaveTick
      sphereRef.current?.triggerShockwave()
    }
  }, [visual.shockwaveTick])

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full max-h-full min-h-0 p-2 box-border">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(40,207,255,0.08),transparent_68%)] pointer-events-none" />
      <div className="absolute bottom-[8%] left-[10%] right-[10%] h-24 bg-gradient-to-t from-[#28CFFF]/8 to-transparent blur-2xl pointer-events-none" />
      <div
        className="relative w-full h-full max-w-[min(100%,52vh)] max-h-[min(100%,52vh)] aspect-square mx-auto reactor-bloom"
      >
        <div className="absolute inset-0 pointer-events-none opacity-30 scanlines" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20" aria-hidden>
          <div className="h-[70%] w-[70%] rounded-full border border-[#28CFFF]/20" />
          <div className="absolute h-px w-full bg-[#28CFFF]/15" />
          <div className="absolute w-px h-full bg-[#28CFFF]/15" />
        </div>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  )
}
