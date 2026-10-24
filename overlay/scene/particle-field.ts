import * as THREE from 'three'

export class ParticleField {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private points: THREE.Points
  private positions: Float32Array
  private velocities: Float32Array
  private attractors: THREE.Vector2[] = []
  private count: number

  constructor(canvas: HTMLCanvasElement, count: number) {
    this.count = count
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    this.renderer.setClearColor(0x000000, 0)

    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 4
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 2.5
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 2
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.01
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.005
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    const material = new THREE.PointsMaterial({
      color: 0x22d3ee,
      size: 0.02,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    this.points = new THREE.Points(geometry, material)
    this.scene.add(this.points)
  }

  setAttractors(normalized: { x: number; y: number }[]): void {
    this.attractors = normalized.map((p) => new THREE.Vector2((p.x - 0.5) * 4, (0.5 - p.y) * 2.5))
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  tick(): void {
    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3
      let vx = this.velocities[ix]
      let vy = this.velocities[ix + 1]
      let vz = this.velocities[ix + 2]

      for (const a of this.attractors) {
        const dx = a.x - this.positions[ix]
        const dy = a.y - this.positions[ix + 1]
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.05
        const force = 0.0008 / dist
        vx += dx * force
        vy += dy * force
      }

      vx *= 0.98
      vy *= 0.98
      vz *= 0.98

      this.positions[ix] += vx
      this.positions[ix + 1] += vy
      this.positions[ix + 2] += vz

      if (Math.abs(this.positions[ix]) > 2.2) this.positions[ix] *= 0.99
      if (Math.abs(this.positions[ix + 1]) > 1.4) this.positions[ix + 1] *= 0.99

      this.velocities[ix] = vx
      this.velocities[ix + 1] = vy
      this.velocities[ix + 2] = vz
    }
    attr.needsUpdate = true
    this.points.rotation.z += 0.0004
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
    this.renderer.dispose()
  }
}
