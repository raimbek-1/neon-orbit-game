export type Vec = { x: number; y: number }
export type Orb = Vec & {
  radius: number
  vx: number
  vy: number
  phase: number
}
export type Spark = Vec & {
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}
export type Snapshot = {
  score: number
  energy: number
  seconds: number
  level: number
}
export type GameEvents = {
  update: (snapshot: Snapshot) => void
  collect: () => void
  end: (snapshot: Snapshot) => void
}

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))
export function circlesOverlap(a: Vec, ar: number, b: Vec, br: number) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (ar + br) ** 2
}
// Relative swept-circle collision catches fast obstacles crossing between frames.
export function sweptCollision(
  a0: Vec,
  a1: Vec,
  ar: number,
  b0: Vec,
  b1: Vec,
  br: number,
) {
  const x = a0.x - b0.x,
    y = a0.y - b0.y
  const dx = a1.x - a0.x - (b1.x - b0.x),
    dy = a1.y - a0.y - (b1.y - b0.y)
  const length = dx * dx + dy * dy
  const t = length ? clamp(-(x * dx + y * dy) / length, 0, 1) : 0
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 <= (ar + br) ** 2
}
export const difficulty = (seconds: number) => 1 + Math.floor(seconds / 15)

export class OrbitEngine {
  width = 1100
  height = 600
  player = { x: 550, y: 300, vx: 0, vy: 0, radius: 10 }
  obstacles: Orb[] = []
  energy: Orb[] = []
  sparks: Spark[] = []
  trail: Vec[] = []
  keys = new Set<string>()
  target: Vec | null = null
  score = 0
  collected = 0
  seconds = 0
  alive = true
  private hudTime = 0
  private spawnTime = 0
  constructor(
    private events: GameEvents,
    private random = Math.random,
  ) {}
  get snapshot(): Snapshot {
    return {
      score: this.score,
      energy: this.collected,
      seconds: this.seconds,
      level: difficulty(this.seconds),
    }
  }
  resize(width: number, height: number) {
    const sx = width / this.width,
      sy = height / this.height
    for (const item of [
      this.player,
      ...this.obstacles,
      ...this.energy,
      ...this.sparks,
      ...this.trail,
    ]) {
      item.x *= sx
      item.y *= sy
    }
    this.width = width
    this.height = height
    this.target = null
  }
  reset() {
    this.player = {
      x: this.width / 2,
      y: this.height / 2,
      vx: 0,
      vy: 0,
      radius: 10,
    }
    this.obstacles = []
    this.energy = []
    this.sparks = []
    this.trail = []
    this.keys.clear()
    this.target = null
    this.score = 0
    this.collected = 0
    this.seconds = 0
    this.hudTime = 0
    this.spawnTime = 0
    this.alive = true
    for (let i = 0; i < 7; i++) this.addEnergy()
    for (let i = 0; i < 3; i++) this.addObstacle()
    this.events.update(this.snapshot)
  }
  private addEnergy() {
    const margin = 35
    this.energy.push({
      x: margin + this.random() * (this.width - margin * 2),
      y: margin + this.random() * (this.height - margin * 2),
      radius: 5,
      vx: 0,
      vy: 0,
      phase: this.random() * Math.PI * 2,
    })
  }
  private addObstacle() {
    const side = Math.floor(this.random() * 4)
    const x =
      side === 0
        ? -30
        : side === 1
          ? this.width + 30
          : this.random() * this.width
    const y =
      side === 2
        ? -30
        : side === 3
          ? this.height + 30
          : this.random() * this.height
    const angle =
      Math.atan2(this.player.y - y, this.player.x - x) +
      (this.random() - 0.5) * 0.8
    const speed = Math.min(
      185,
      52 + difficulty(this.seconds) * 11 + this.random() * 30,
    )
    this.obstacles.push({
      x,
      y,
      radius: 10 + this.random() * 9,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      phase: this.random() * 6,
    })
  }
  step(dt: number, reducedMotion = false) {
    if (!this.alive) return
    dt = clamp(dt, 0, 0.04)
    this.seconds += dt
    this.spawnTime += dt
    this.hudTime += dt
    const p = this.player,
      before = { x: p.x, y: p.y }
    let dx =
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'))
    let dy =
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup'))
    const maxSpeed = Math.min(315, Math.max(235, this.width * 0.38))
    if (this.target && dx === 0 && dy === 0) {
      dx = (this.target.x - p.x) / 65
      dy = (this.target.y - p.y) / 65
    }
    const magnitude = Math.hypot(dx, dy)
    if (magnitude > 1) {
      dx /= magnitude
      dy /= magnitude
    }
    const smoothing = 1 - Math.exp(-13 * dt)
    p.vx += (dx * maxSpeed - p.vx) * smoothing
    p.vy += (dy * maxSpeed - p.vy) * smoothing
    p.x = clamp(p.x + p.vx * dt, p.radius + 4, this.width - p.radius - 4)
    p.y = clamp(p.y + p.vy * dt, p.radius + 4, this.height - p.radius - 4)
    if (!reducedMotion) {
      this.trail.unshift({ x: p.x, y: p.y })
      this.trail.length = Math.min(24, this.trail.length)
    } else this.trail = []
    for (let i = this.energy.length - 1; i >= 0; i--) {
      const e = this.energy[i]
      if (sweptCollision(before, p, p.radius + 3, e, e, e.radius)) {
        this.energy.splice(i, 1)
        this.collected++
        this.events.collect()
        if (!reducedMotion)
          for (let j = 0; j < 14; j++) {
            const a = this.random() * Math.PI * 2,
              speed = 25 + this.random() * 100
            this.sparks.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
              life: 0.6,
              maxLife: 0.6,
              color: '#b9f391',
            })
          }
        this.addEnergy()
      }
    }
    for (const o of this.obstacles) {
      const old = { x: o.x, y: o.y }
      o.x += o.vx * dt
      o.y += o.vy * dt
      if (sweptCollision(before, p, p.radius * 0.85, old, o, o.radius * 0.85)) {
        this.alive = false
        this.score = Math.floor(this.seconds * 5) + this.collected * 100
        this.events.update(this.snapshot)
        this.events.end(this.snapshot)
        return
      }
    }
    this.obstacles = this.obstacles.filter(
      (o) =>
        o.x > -90 &&
        o.x < this.width + 90 &&
        o.y > -90 &&
        o.y < this.height + 90,
    )
    const interval = Math.max(0.65, 2.4 - difficulty(this.seconds) * 0.17)
    if (this.spawnTime > interval) {
      this.spawnTime = 0
      this.addObstacle()
      if (difficulty(this.seconds) > 4) this.addObstacle()
    }
    for (const s of this.sparks) {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life -= dt
    }
    this.sparks = this.sparks.filter((s) => s.life > 0)
    this.score = Math.floor(this.seconds * 5) + this.collected * 100
    if (this.hudTime > 0.1) {
      this.hudTime = 0
      this.events.update(this.snapshot)
    }
  }
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
  g.addColorStop(0, color)
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}
export function drawGame(
  ctx: CanvasRenderingContext2D,
  engine: OrbitEngine,
  light: boolean,
  reduced: boolean,
) {
  const { width: w, height: h, player: p, seconds: t } = engine
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = light ? 'rgba(45,65,50,.12)' : 'rgba(155,180,162,.13)'
  for (let x = 24; x < w; x += 32)
    for (let y = 24; y < h; y += 32) {
      ctx.beginPath()
      ctx.arc(x, y, 0.65, 0, Math.PI * 2)
      ctx.fill()
    }
  for (const e of engine.energy) {
    const pulse = reduced ? 1 : 1 + Math.sin(t * 3 + e.phase) * 0.15
    glow(ctx, e.x, e.y, 24 * pulse, light ? '#6dba2930' : '#c1ff782d')
    ctx.fillStyle = light ? '#618c32' : '#cbf7a5'
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.radius * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = light ? '#618c3230' : '#b9f39135'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(e.x, e.y, 11 * pulse, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const o of engine.obstacles) {
    glow(ctx, o.x, o.y, o.radius * 2.8, '#a391ff22')
    const g = ctx.createRadialGradient(o.x - 3, o.y - 4, 0, o.x, o.y, o.radius)
    g.addColorStop(0, light ? '#d4c9ec' : '#6c608b')
    g.addColorStop(1, light ? '#9275b9' : '#211d32')
    ctx.fillStyle = g
    ctx.strokeStyle = light ? '#8870a9' : '#a591d580'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  for (let i = engine.trail.length - 1; i >= 0; i--) {
    const v = engine.trail[i]
    ctx.fillStyle = `rgba(165,216,255,${(1 - i / engine.trail.length) * 0.18})`
    ctx.beginPath()
    ctx.arc(v.x, v.y, p.radius * (1 - i / engine.trail.length), 0, Math.PI * 2)
    ctx.fill()
  }
  for (const s of engine.sparks) {
    ctx.globalAlpha = s.life / s.maxLife
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(s.x, s.y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  glow(ctx, p.x, p.y, 45, '#a4d3ff40')
  const g = ctx.createRadialGradient(p.x - 3, p.y - 4, 0, p.x, p.y, p.radius)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.45, '#e4f1ff')
  g.addColorStop(1, '#82a8d8')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
  ctx.fill()
}

export function drawOrbit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  light: boolean,
  reduced: boolean,
) {
  ctx.clearRect(0, 0, w, h)
  const cx = w < 650 ? w * 0.52 : w * 0.735,
    cy = w < 650 ? h * 0.74 : h * 0.49
  const r = Math.min(w < 650 ? w * 0.38 : w * 0.215, h * 0.43)
  const t = reduced ? 4 : time
  const random = (i: number) => {
    const v = Math.sin(i * 127.1 + 31.7) * 43758.5453
    return v - Math.floor(v)
  }
  for (let i = 0; i < 95; i++) {
    ctx.fillStyle = light
      ? `rgba(70,90,70,${0.08 + random(i + 3) * 0.2})`
      : `rgba(210,225,210,${0.08 + random(i + 3) * 0.28})`
    ctx.beginPath()
    ctx.arc(
      random(i) * w,
      random(i + 200) * h,
      random(i + 400) > 0.9 ? 1.2 : 0.6,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  glow(ctx, cx, cy, r * 1.4, light ? '#a2cb8724' : '#779f6220')
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.43)
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = light
      ? `rgba(78,100,65,${0.12 + i * 0.018})`
      : `rgba(183,214,160,${0.09 + i * 0.014})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.ellipse(
      0,
      0,
      r * (1.36 - i * 0.14),
      r * (0.59 - i * 0.055),
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  }
  const angle = t * 0.12 + 0.5
  const ex = Math.cos(angle) * r * 1.22,
    ey = Math.sin(angle) * r * 0.535
  glow(ctx, ex, ey, 27, '#c4f79670')
  ctx.fillStyle = '#c3ee9c'
  ctx.beginPath()
  ctx.arc(ex, ey, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // A procedural sphere: original artwork, with latitude and longitude wire lines.
  const sphere = r * 0.62
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, sphere, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(
    cx - sphere * 0.42,
    cy - sphere * 0.48,
    0,
    cx + sphere * 0.1,
    cy + sphere * 0.2,
    sphere * 1.3,
  )
  g.addColorStop(0, light ? '#b9cbb0' : '#4b5a46')
  g.addColorStop(0.5, light ? '#8d9e87' : '#1e2b20')
  g.addColorStop(1, light ? '#53674f' : '#090f0b')
  ctx.fillStyle = g
  ctx.fillRect(cx - sphere, cy - sphere, sphere * 2, sphere * 2)
  ctx.translate(cx, cy)
  ctx.rotate(-0.32)
  ctx.strokeStyle = light ? '#e9f3e22a' : '#b9d6a725'
  ctx.lineWidth = 0.6
  for (let i = -5; i <= 5; i++) {
    const y = (i / 6) * sphere,
      rx = Math.sqrt(sphere * sphere - y * y)
    ctx.beginPath()
    ctx.ellipse(0, y, rx, rx * 0.15, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let i = 0; i < 11; i++) {
    ctx.beginPath()
    ctx.ellipse(
      0,
      0,
      Math.abs(Math.sin((i / 11) * Math.PI + t * 0.015)) * sphere,
      sphere,
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = light ? '#e2f0d755' : '#b8db9b40'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, sphere, 0, Math.PI * 2)
  ctx.stroke()
  // Foreground orbit passes over the sphere for depth.
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.43)
  ctx.strokeStyle = light ? '#7b9c60' : '#c4eaa78c'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.36, r * 0.59, 0, 0.05, Math.PI * 0.95)
  ctx.stroke()
  const a = -t * 0.16 + 2.5,
    px = Math.cos(a) * r * 1.36,
    py = Math.sin(a) * r * 0.59
  glow(ctx, px, py, 26, '#dcecff70')
  ctx.fillStyle = '#f1f6ff'
  ctx.beginPath()
  ctx.arc(px, py, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
