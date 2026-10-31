import { useEffect, useRef } from 'react'
import { OrbitEngine, drawGame, drawOrbit, type Snapshot } from './game/engine'
import { playTone } from './game/audio'

export type Mode = 'menu' | 'playing' | 'paused' | 'over'
type Props = {
  mode: Mode
  run: number
  light: boolean
  reduced: boolean
  sound: boolean
  onUpdate: (s: Snapshot) => void
  onEnd: (s: Snapshot) => void
  onPause: () => void
}
export default function GameCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  latest.current = props
  useEffect(() => {
    const canvas = canvasRef.current!,
      ctx = canvas.getContext('2d')!
    const engine = new OrbitEngine({
      update: (s) => latest.current.onUpdate(s),
      collect: () => playTone('collect', latest.current.sound),
      end: (s) => {
        playTone('end', latest.current.sound)
        latest.current.onEnd(s)
      },
    })
    let frame = 0,
      previous = 0,
      run = -1,
      lastMode: Mode = 'menu',
      pointer: number | null = null
    const resize = () => {
      const rect = canvas.getBoundingClientRect(),
        dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      engine.resize(rect.width, rect.height)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    const tick = (now: number) => {
      const p = latest.current
      if (p.run !== run) {
        run = p.run
        if (run > 0) engine.reset()
      }
      if (p.mode !== lastMode) {
        engine.keys.clear()
        engine.target = null
        pointer = null
        lastMode = p.mode
        previous = now
      }
      const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0
      previous = now
      if (p.mode === 'menu')
        drawOrbit(
          ctx,
          engine.width,
          engine.height,
          now / 1000,
          p.light,
          p.reduced,
        )
      else {
        if (p.mode === 'playing') engine.step(dt, p.reduced)
        drawGame(ctx, engine, p.light, p.reduced)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const movement = [
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowleft',
      'arrowdown',
      'arrowright',
    ]
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, select, [role="dialog"]'))
        return
      const key = e.key.toLowerCase()
      if (latest.current.mode === 'playing' && movement.includes(key)) {
        e.preventDefault()
        engine.keys.add(key)
      }
      if (
        latest.current.mode === 'playing' &&
        ['escape', 'p', ' '].includes(key) &&
        !(key === ' ' && (e.target as HTMLElement)?.closest('button')) &&
        !e.repeat
      ) {
        e.preventDefault()
        latest.current.onPause()
      }
    }
    const up = (e: KeyboardEvent) => engine.keys.delete(e.key.toLowerCase())
    const blur = () => {
      engine.keys.clear()
      engine.target = null
      if (latest.current.mode === 'playing') latest.current.onPause()
    }
    const visibility = () => {
      if (document.hidden) blur()
    }
    const movePointer = (e: PointerEvent) => {
      if (latest.current.mode !== 'playing' || e.pointerId !== pointer) return
      const rect = canvas.getBoundingClientRect()
      engine.target = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const pointerDown = (e: PointerEvent) => {
      if (latest.current.mode !== 'playing' || pointer !== null) return
      pointer = e.pointerId
      canvas.setPointerCapture(e.pointerId)
      movePointer(e)
    }
    const pointerUp = (e: PointerEvent) => {
      if (e.pointerId === pointer) {
        engine.target = null
        pointer = null
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', movePointer)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerUp)
    canvas.addEventListener('lostpointercapture', pointerUp)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', movePointer)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerUp)
      canvas.removeEventListener('lostpointercapture', pointerUp)
    }
  }, [])
  return (
    <canvas
      ref={canvasRef}
      className={`game-canvas ${props.mode === 'playing' ? 'is-playing' : ''}`}
      aria-label="Game arena. Move with WASD or arrow keys, or hold and drag on the arena. Collect green energy and avoid violet obstacles."
      role="img"
    />
  )
}
