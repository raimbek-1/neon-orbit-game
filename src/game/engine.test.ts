import { describe, expect, it } from 'vitest'
import {
  OrbitEngine,
  circlesOverlap,
  sweptCollision,
  difficulty,
} from './engine'

const setup = () => {
  const updates: number[] = [],
    ends: number[] = []
  let collected = 0
  const engine = new OrbitEngine(
    {
      update: (s) => updates.push(s.score),
      end: (s) => ends.push(s.score),
      collect: () => collected++,
    },
    () => 0.25,
  )
  engine.reset()
  engine.obstacles = []
  engine.energy = []
  return { engine, updates, ends, collected: () => collected }
}
describe('collision geometry', () => {
  it('includes touching edges and rejects separated circles', () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 15, y: 0 }, 5)).toBe(true)
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 16, y: 0 }, 5)).toBe(false)
  })
  it('detects obstacles crossing the player between frames', () => {
    expect(
      sweptCollision(
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        8,
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        8,
      ),
    ).toBe(true)
    expect(
      sweptCollision(
        { x: 50, y: 80 },
        { x: 50, y: 80 },
        8,
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        8,
      ),
    ).toBe(false)
  })
})
describe('survival loop', () => {
  it('collects energy once, awards points, and replenishes the field', () => {
    const s = setup(),
      p = s.engine.player
    s.engine.energy = [{ x: p.x, y: p.y, radius: 5, vx: 0, vy: 0, phase: 0 }]
    s.engine.step(0.016)
    expect(s.collected()).toBe(1)
    expect(s.engine.collected).toBe(1)
    expect(s.engine.score).toBe(100)
    expect(s.engine.energy).toHaveLength(1)
    s.engine.step(0.016)
    expect(s.collected()).toBe(1)
  })
  it('ends on collision and prevents post-game movement and scoring', () => {
    const s = setup(),
      p = s.engine.player
    s.engine.obstacles = [
      { x: p.x, y: p.y, radius: 15, vx: 0, vy: 0, phase: 0 },
    ]
    s.engine.step(0.02)
    expect(s.ends).toHaveLength(1)
    expect(s.engine.alive).toBe(false)
    const time = s.engine.seconds
    s.engine.step(0.02)
    expect(s.engine.seconds).toBe(time)
    expect(s.ends).toHaveLength(1)
  })
  it('supports all keyboard directions and keeps diagonal speed bounded', () => {
    const a = setup().engine,
      b = setup().engine
    const origin = { ...a.player }
    a.keys.add('arrowright')
    b.keys.add('d')
    b.keys.add('w')
    for (let i = 0; i < 30; i++) {
      a.step(1 / 60)
      b.step(1 / 60)
    }
    expect(a.player.x).toBeGreaterThan(origin.x)
    expect(b.player.y).toBeLessThan(origin.y)
    expect(
      Math.hypot(b.player.x - origin.x, b.player.y - origin.y),
    ).toBeCloseTo(a.player.x - origin.x, 4)
  })
  it('follows touch targets smoothly without teleporting and respects bounds', () => {
    const e = setup().engine,
      x = e.player.x
    e.target = { x: 2000, y: e.player.y }
    e.step(0.016)
    expect(e.player.x).toBeGreaterThan(x)
    expect(e.player.x - x).toBeLessThan(6)
    e.player.x = e.width - 14
    e.keys.add('d')
    e.step(0.04)
    expect(e.player.x).toBeLessThanOrEqual(e.width - 14)
  })
  it('increases difficulty every 15 seconds', () => {
    expect(difficulty(14.9)).toBe(1)
    expect(difficulty(15)).toBe(2)
    expect(difficulty(60)).toBe(5)
  })
  it('scales positions on resize and resets all run state', () => {
    const e = setup().engine
    e.resize(550, 300)
    expect(e.player.x).toBe(275)
    expect(e.player.y).toBe(150)
    e.keys.add('d')
    e.collected = 5
    e.seconds = 50
    e.alive = false
    e.reset()
    expect(e.snapshot).toEqual({ score: 0, energy: 0, seconds: 0, level: 1 })
    expect(e.keys.size).toBe(0)
    expect(e.alive).toBe(true)
    expect(e.energy).toHaveLength(7)
    expect(e.obstacles).toHaveLength(3)
  })
})
