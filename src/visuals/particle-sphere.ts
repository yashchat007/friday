import * as THREE from 'three'

export type SphereVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'task' | 'error'

export const SPHERE_VISUAL_PARAMS: Record<
  SphereVisualState,
  { spin: number; turbulence: number; pulse: number; wave: number; size: number; cyan: number; blue: number }
> = {
  idle: { spin: 0.00055, turbulence: 0.0035, pulse: 0.05, wave: 0.22, size: 0.011, cyan: 0.82, blue: 0.38 },
  listening: { spin: 0.0011, turbulence: 0.008, pulse: 0.08, wave: 0.45, size: 0.014, cyan: 0.88, blue: 0.75 },
  thinking: { spin: 0.002, turbulence: 0.012, pulse: 0.08, wave: 0.38, size: 0.015, cyan: 0.9, blue: 0.65 },
  speaking: { spin: 0.0014, turbulence: 0.01, pulse: 0.12, wave: 0.55, size: 0.017, cyan: 0.95, blue: 0.5 },
  task: { spin: 0.003, turbulence: 0.018, pulse: 0.1, wave: 0.48, size: 0.016, cyan: 0.55, blue: 0.9 },
  error: { spin: 0.0018, turbulence: 0.014, pulse: 0.14, wave: 0.28, size: 0.014, cyan: 0.35, blue: 0.85 }
}

type Shockwave = { age: number; maxAge: number }

type OrbitalBead = {
  mesh: THREE.Mesh
  radius: number
  speed: number
  phase: number
  tiltX: number
  tiltY: number
}

const CORE_VERTEX = `
varying vec3 vN;
void main() {
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const CORE_FRAGMENT = `
uniform float uTime;
uniform float uPulse;
uniform float uError;
varying vec3 vN;
void main() {
  float facing = max(0.0, vN.z);
  float rim = pow(1.0 - facing, 2.5);
  float core = pow(facing, 6.0);
  vec3 cyan = vec3(0.15, 0.75, 1.0);
  vec3 hot = vec3(0.92, 0.98, 1.0);
  vec3 err = vec3(1.0, 0.25, 0.35);
  vec3 base = mix(cyan, hot, core + uPulse * 0.35);
  base = mix(base, err, uError * 0.65);
  float alpha = core * 0.95 + rim * 0.35 + uPulse * 0.12;
  gl_FragColor = vec4(base, alpha);
}
`

export class ParticleSphere {
  private scene: THREE.Scene
  private root: THREE.Group
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private points: THREE.Points
  private trailPoints: THREE.Points
  private rings: THREE.Mesh[]
  private arcs: THREE.Mesh[]
  private glowLayers: THREE.Mesh[]
  private coreMesh: THREE.Mesh
  private coreUniforms: { uTime: { value: number }; uPulse: { value: number }; uError: { value: number } }
  private orbitalBeads: OrbitalBead[]
  private lightSweep: THREE.Mesh
  private shockwaveMeshes: THREE.Mesh[]
  private shockwaves: Shockwave[] = []
  private basePositions: Float32Array
  private positions: Float32Array
  private colors: Float32Array
  private sizes: Float32Array
  private trailHistory: Float32Array
  private trailCursor = 0
  private count: number
  private trailCount: number
  private state: SphereVisualState = 'idle'
  private energy = 0
  private audioLevel = 0
  private time = 0
  private frame = 0
  private errorAccent = 0
  private readonly golden = Math.PI * (3 - Math.sqrt(5))

  constructor(canvas: HTMLCanvasElement, count: number) {
    this.count = count
    this.scene = new THREE.Scene()
    this.root = new THREE.Group()
    this.root.scale.setScalar(0.9)
    this.scene.add(this.root)

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
    this.camera.position.z = 2.72

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setClearColor(0x000000, 0)

    this.basePositions = new Float32Array(count * 3)
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = this.golden * i
      const shell = 0.84 + Math.random() * 0.14
      this.basePositions[i * 3] = Math.cos(theta) * r * shell
      this.basePositions[i * 3 + 1] = y * shell
      this.basePositions[i * 3 + 2] = Math.sin(theta) * r * shell
      this.sizes[i] = 0.65 + Math.random() * 1.15
    }
    this.positions.set(this.basePositions)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    geometry.setAttribute('sizeMul', new THREE.BufferAttribute(this.sizes, 1))
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.018,
        transparent: true,
        opacity: 0.72,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      })
    )
    this.root.add(this.points)

    this.trailCount = Math.min(900, Math.floor(count * 0.08))
    this.trailHistory = new Float32Array(this.trailCount * 3)
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailHistory, 3))
    this.trailPoints = new THREE.Points(
      trailGeo,
      new THREE.PointsMaterial({
        color: 0x8bdfff,
        size: 0.008,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    this.root.add(this.trailPoints)

    this.glowLayers = []
    const glowSpecs = [
      { r: 0.55, opacity: 0.055, color: 0x28cfff },
      { r: 0.38, opacity: 0.12, color: 0x5ee7ff },
      { r: 0.22, opacity: 0.22, color: 0xb8f4ff }
    ]
    for (const g of glowSpecs) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(g.r, 32, 32),
        new THREE.MeshBasicMaterial({
          color: g.color,
          transparent: true,
          opacity: g.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
      this.glowLayers.push(mesh)
      this.root.add(mesh)
    }

    this.coreUniforms = {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uError: { value: 0 }
    }
    this.coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 48, 48),
      new THREE.ShaderMaterial({
        uniforms: this.coreUniforms,
        vertexShader: CORE_VERTEX,
        fragmentShader: CORE_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    this.root.add(this.coreMesh)

    this.rings = []
    const ringSpecs = [
      { radius: 0.88, tube: 0.0022, opacity: 0.38, color: 0x28cfff, tilt: 0.42, spinMul: 1.5 },
      { radius: 0.98, tube: 0.0018, opacity: 0.28, color: 0x5ee7ff, tilt: 0.62, spinMul: -1.2 },
      { radius: 1.08, tube: 0.002, opacity: 0.24, color: 0x22d3ee, tilt: -0.28, spinMul: 0.95 },
      { radius: 1.2, tube: 0.0016, opacity: 0.18, color: 0x8bdfff, tilt: 0.95, spinMul: -0.8 },
      { radius: 1.34, tube: 0.0012, opacity: 0.12, color: 0x6b9fff, tilt: 1.25, spinMul: 0.65 },
      { radius: 1.48, tube: 0.001, opacity: 0.08, color: 0x3b82f6, tilt: -0.55, spinMul: -0.55 }
    ]
    for (const spec of ringSpecs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, spec.tube, 8, 160),
        new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: spec.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
      ring.rotation.x = spec.tilt
      ring.userData.spinMul = spec.spinMul
      this.rings.push(ring)
      this.root.add(ring)
    }

    this.arcs = []
    for (let i = 0; i < 7; i++) {
      const radius = 0.86 + i * 0.085
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.01, 128, 1, (i * 0.95) % (Math.PI * 2), Math.PI * (0.28 + (i % 3) * 0.08)),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x28cfff : 0xa5f3fc,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
      arc.rotation.x = Math.PI / 2 + i * 0.32
      arc.rotation.y = i * 0.48
      arc.userData.spinMul = i % 2 === 0 ? 1.1 : -0.85
      this.arcs.push(arc)
      this.root.add(arc)
    }

    this.lightSweep = new THREE.Mesh(
      new THREE.RingGeometry(1.02, 1.05, 96, 1, 0, Math.PI * 0.18),
      new THREE.MeshBasicMaterial({
        color: 0xe0f7ff,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    this.lightSweep.rotation.x = Math.PI / 2
    this.root.add(this.lightSweep)

    this.orbitalBeads = []
    const beadGeo = new THREE.SphereGeometry(0.012, 8, 8)
    for (let b = 0; b < 14; b++) {
      const mesh = new THREE.Mesh(
        beadGeo,
        new THREE.MeshBasicMaterial({
          color: b % 3 === 0 ? 0xffffff : 0x67e8f9,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
      this.orbitalBeads.push({
        mesh,
        radius: 0.92 + (b % 5) * 0.11,
        speed: 0.35 + (b % 4) * 0.12,
        phase: (b / 14) * Math.PI * 2,
        tiltX: 0.3 + (b % 3) * 0.4,
        tiltY: (b % 5) * 0.55
      })
      this.root.add(mesh)
    }

    this.shockwaveMeshes = []
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.22, 64),
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
      mesh.visible = false
      this.shockwaveMeshes.push(mesh)
      this.root.add(mesh)
    }
  }

  setVisualState(state: SphereVisualState, energy = 0): void {
    if (state === 'error') {
      this.errorAccent = 1
    }
    this.state = state
    this.energy = Math.min(1, Math.max(0, energy))
    this.audioLevel = this.energy
  }

  triggerShockwave(): void {
    if (this.shockwaves.length >= this.shockwaveMeshes.length) return
    this.shockwaves.push({ age: 0, maxAge: 1.35 })
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    const fit = Math.min(width, height)
    const scale = fit < 320 ? 0.78 : fit < 480 ? 0.85 : 0.9
    this.root.scale.setScalar(scale)
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].age += dt
      if (this.shockwaves[i].age >= this.shockwaves[i].maxAge) {
        this.shockwaves.splice(i, 1)
      }
    }
    for (let i = 0; i < this.shockwaveMeshes.length; i++) {
      const mesh = this.shockwaveMeshes[i]
      const wave = this.shockwaves[i]
      if (!wave) {
        mesh.visible = false
        continue
      }
      const t = wave.age / wave.maxAge
      const scale = 0.85 + t * 1.65
      mesh.visible = true
      mesh.scale.set(scale, scale, scale)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - t) * 0.35
    }
  }

  private updateOrbitalBeads(dt: number, spin: number): void {
    for (const bead of this.orbitalBeads) {
      const angle = this.time * bead.speed * (1 + this.energy * 0.4) + bead.phase
      const x = Math.cos(angle) * bead.radius
      const z = Math.sin(angle) * bead.radius
      const y = Math.sin(angle * 0.7 + bead.phase) * 0.12
      bead.mesh.position.set(x, y, z)
      bead.mesh.rotation.x = bead.tiltX
      bead.mesh.rotation.y = bead.tiltY + this.time * spin * 40
      const mat = bead.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.55 + Math.sin(angle * 2) * 0.25 + this.energy * 0.2
    }
  }

  /** @returns true when the scene should keep animating at full rate */
  shouldRunFast(): boolean {
    if (this.shockwaves.length > 0) return true
    if (this.state !== 'idle') return true
    if (this.energy > 0.04) return true
    return true
  }

  tick(): void {
    this.frame++
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const idle = this.state === 'idle' && this.energy < 0.05 && this.shockwaves.length === 0
    const dt = reduced ? 0.004 : idle ? 0.014 : 0.016
    this.time += dt

    const p = SPHERE_VISUAL_PARAMS[this.state]
    const audioBoost = this.audioLevel * 0.35
    const breathe = Math.sin(this.time * (2.1 + p.pulse * 4)) * 0.5 + 0.5
    const pulse =
      1 +
      breathe * p.pulse * (0.55 + this.energy) +
      audioBoost * 0.1 +
      Math.sin(this.time * 5.2) * p.pulse * 0.15

    if (this.errorAccent > 0) {
      this.errorAccent = Math.max(0, this.errorAccent - dt * 0.85)
    }
    this.coreUniforms.uTime.value = this.time
    this.coreUniforms.uPulse.value = breathe * (0.35 + this.energy * 0.5 + audioBoost * 0.3)
    this.coreUniforms.uError.value = this.errorAccent

    const coreScale = 1 + breathe * 0.08 + audioBoost * 0.06
    this.coreMesh.scale.setScalar(coreScale)
    for (let g = 0; g < this.glowLayers.length; g++) {
      const layer = this.glowLayers[g]
      const s = 1 + breathe * (0.06 - g * 0.015) + this.energy * 0.05
      layer.scale.setScalar(s)
      const mat = layer.material as THREE.MeshBasicMaterial
      mat.opacity = (0.045 + g * 0.04) * (0.85 + breathe * 0.35 + this.energy * 0.25)
    }

    const material = this.points.material as THREE.PointsMaterial
    material.size = p.size * (1 + this.energy * 0.5 + audioBoost * 0.15)
    material.opacity = 0.62 + breathe * 0.18 + this.energy * 0.12

    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttr = this.points.geometry.getAttribute('color') as THREE.BufferAttribute
    const sizeAttr = this.points.geometry.getAttribute('sizeMul') as THREE.BufferAttribute
    const trailAttr = this.trailPoints.geometry.getAttribute('position') as THREE.BufferAttribute

    let cx = 0
    let cy = 0
    let cz = 0

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3
      const bx = this.basePositions[ix]
      const by = this.basePositions[ix + 1]
      const bz = this.basePositions[ix + 2]
      const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1
      const nx = bx / len
      const ny = by / len
      const nz = bz / len

      const flow =
        Math.sin(this.time * 3.8 * (1 + audioBoost) + i * 0.04 + ny * 9) * p.turbulence * (0.45 + audioBoost)
      const band = Math.sin(this.time * p.wave * 2.2 + ny * 8 + nx * 6) * p.turbulence
      const noise =
        Math.sin(this.time * 3.2 + i * 0.018) * p.turbulence * (0.55 + this.energy) +
        Math.cos(this.time * 2.3 + i * 0.012) * p.turbulence * 0.45 +
        band +
        flow

      const scale = pulse + noise
      this.positions[ix] = nx * scale
      this.positions[ix + 1] = ny * scale
      this.positions[ix + 2] = nz * scale

      if (i % 120 === 0) {
        cx += nx * scale
        cy += ny * scale
        cz += nz * scale
      }

      const t = (ny + 1) * 0.5
      const sparkle = 0.5 + Math.sin(this.time * 2.4 + i * 0.07) * 0.5
      const inner = Math.max(0, 1 - len * 0.95)
      const sizeMul = sizeAttr.array[i] as number
      const bright = (0.55 + sparkle * 0.45) * sizeMul

      if (this.state === 'error' && this.errorAccent > 0.2) {
        this.colors[ix] = 0.55 + bright * 0.25
        this.colors[ix + 1] = 0.2 + t * 0.15
        this.colors[ix + 2] = 0.35 + inner * 0.2
      } else {
        this.colors[ix] = (0.08 + inner * 0.12 + p.blue * 0.15) * bright
        this.colors[ix + 1] = (0.45 + t * 0.42 * p.cyan + inner * 0.2) * bright
        this.colors[ix + 2] = (0.88 + t * 0.1 + sparkle * 0.08) * bright
      }
    }

    const samples = Math.max(1, Math.floor(this.count / 120))
    cx /= samples
    cy /= samples
    cz /= samples
    const trailIx = (this.trailCursor % this.trailCount) * 3
    this.trailHistory[trailIx] = cx
    this.trailHistory[trailIx + 1] = cy
    this.trailHistory[trailIx + 2] = cz
    this.trailCursor++

    for (let i = 0; i < this.trailCount; i++) {
      const src = ((this.trailCursor - 1 - i + this.trailCount * 2) % this.trailCount) * 3
      const dst = i * 3
      const fade = 1 - i / this.trailCount
      trailAttr.array[dst] = this.trailHistory[src]
      trailAttr.array[dst + 1] = this.trailHistory[src + 1] * (0.92 + fade * 0.08)
      trailAttr.array[dst + 2] = this.trailHistory[src + 2]
    }

    attr.needsUpdate = true
    colorAttr.needsUpdate = true
    trailAttr.needsUpdate = true

    const spin = reduced ? p.spin * 0.35 : p.spin
    this.root.rotation.y += spin * 0.85
    this.points.rotation.y += spin * 0.35
    this.points.rotation.x = Math.sin(this.time * 0.38) * 0.09
    this.trailPoints.rotation.copy(this.points.rotation)

    for (let r = 0; r < this.rings.length; r++) {
      const ring = this.rings[r]
      const mul = (ring.userData.spinMul as number) ?? 1
      ring.rotation.z += spin * mul
      ring.rotation.y += spin * 0.45 * (r % 2 === 0 ? 1 : -1)
      const mat = ring.material as THREE.MeshBasicMaterial
      const base = r < 2 ? 0.28 : 0.14
      mat.opacity = base + audioBoost * 0.18 + breathe * 0.08
    }

    for (let a = 0; a < this.arcs.length; a++) {
      const arc = this.arcs[a]
      const mul = (arc.userData.spinMul as number) ?? 1
      arc.rotation.z += spin * mul * 0.9
      arc.rotation.x += spin * 0.32
      const mat = arc.material as THREE.MeshBasicMaterial
      mat.opacity = 0.14 + audioBoost * 0.14 + this.energy * 0.1 + breathe * 0.06
    }

    this.lightSweep.rotation.z += spin * 2.4
    this.lightSweep.rotation.x = Math.PI / 2 + Math.sin(this.time * 0.25) * 0.35
    const sweepMat = this.lightSweep.material as THREE.MeshBasicMaterial
    sweepMat.opacity = 0.08 + breathe * 0.12 + this.energy * 0.08

    this.updateOrbitalBeads(dt, spin)
    this.updateShockwaves(dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
    this.trailPoints.geometry.dispose()
    ;(this.trailPoints.material as THREE.Material).dispose()
    for (const ring of this.rings) {
      ring.geometry.dispose()
      ;(ring.material as THREE.Material).dispose()
    }
    for (const arc of this.arcs) {
      arc.geometry.dispose()
      ;(arc.material as THREE.Material).dispose()
    }
    for (const glow of this.glowLayers) {
      glow.geometry.dispose()
      ;(glow.material as THREE.Material).dispose()
    }
    this.coreMesh.geometry.dispose()
    ;(this.coreMesh.material as THREE.Material).dispose()
    for (const bead of this.orbitalBeads) {
      ;(bead.mesh.material as THREE.Material).dispose()
    }
    this.orbitalBeads[0]?.mesh.geometry.dispose()
    this.lightSweep.geometry.dispose()
    ;(this.lightSweep.material as THREE.Material).dispose()
    for (const mesh of this.shockwaveMeshes) {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.renderer.dispose()
  }
}
