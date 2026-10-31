import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Expand,
  Home,
  Maximize2,
  Moon,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import GameCanvas, { type Mode } from './GameCanvas'
import { unlockAudio } from './game/audio'
import type { Snapshot } from './game/engine'
import { persist, readBest, readSettings, type Settings } from './storage'

const empty: Snapshot = { score: 0, energy: 0, seconds: 0, level: 1 }
const format = (n: number) => n.toLocaleString('en-US')
const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(n % 60)
    .toString()
    .padStart(2, '0')}`
function IconButton({
  label,
  children,
  onClick,
  pressed,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  pressed?: boolean
}) {
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-pressed={pressed}
    >
      {children}
    </button>
  )
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const el = ref.current!
    el.querySelector<HTMLButtonElement>('button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
      if (e.key === 'Tab') {
        const items = [
          ...el.querySelectorAll<HTMLElement>(
            'button, select, input, [tabindex="0"]',
          ),
        ]
        const first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    el.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [close])
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">{title}</h2>
          <IconButton label="Close dialog" onClick={close}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

export default function App() {
  const [mode, setMode] = useState<Mode>('menu')
  const [run, setRun] = useState(0)
  const [stats, setStats] = useState<Snapshot>(empty)
  const [best, setBest] = useState(readBest)
  const [settings, setSettings] = useState(readSettings)
  const [modal, setModal] = useState<'settings' | 'help' | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [systemLight, setSystemLight] = useState(
    () => matchMedia('(prefers-color-scheme: light)').matches,
  )
  const [fullscreen, setFullscreen] = useState(false)
  const [notice, setNotice] = useState('')
  const arenaRef = useRef<HTMLElement>(null)
  const prefersReduced = useReducedMotion()
  const reduced = !!prefersReduced || !settings.motion
  const light =
    settings.theme === 'light' || (settings.theme === 'system' && systemLight)
  const closeModal = useCallback(() => setModal(null), [])
  const pause = useCallback(
    () => setMode((m) => (m === 'playing' ? 'paused' : m)),
    [],
  )
  useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), 650)
    return () => clearTimeout(timeout)
  }, [])
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: light)'),
      update = () => setSystemLight(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark'
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', light ? '#f3f4ef' : '#080a0e')
  }, [light, reduced])
  useEffect(() => {
    persist('settings', settings)
  }, [settings])
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(id)
  }, [notice])
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))
  const start = () => {
    unlockAudio()
    setStats(empty)
    setRun((n) => n + 1)
    setMode('playing')
    ;(document.activeElement as HTMLElement)?.blur()
    arenaRef.current?.focus({ preventScroll: true })
  }
  const resume = () => {
    unlockAudio()
    setMode('playing')
    arenaRef.current?.focus({ preventScroll: true })
  }
  const end = (s: Snapshot) => {
    setStats(s)
    setMode('over')
    setBest((previous) => {
      const next = Math.max(previous, s.score)
      persist('best', next)
      return next
    })
  }
  const openModal = (which: 'settings' | 'help') => {
    pause()
    setModal(which)
  }
  const expand = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (arenaRef.current?.requestFullscreen)
        await arenaRef.current.requestFullscreen()
      else
        setNotice(
          'Fullscreen is not supported in this browser. Rotate your device for a wider view.',
        )
    } catch {
      setNotice(
        'Fullscreen is unavailable here. You can keep playing in this view.',
      )
    }
  }
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className="app-shell">
        <header className="site-header">
          <button
            className="brand"
            onClick={() => {
              if (mode === 'playing') pause()
              else setMode('menu')
            }}
            aria-label="Neon Orbit home"
          >
            <span className="brand-mark">
              <Orbit size={25} strokeWidth={1.4} />
            </span>
            <span>
              NEON<span className="brand-light">ORBIT</span>
              <span className="brand-dot">®</span>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <span className="nav-current">THE GAME</span>
            <button onClick={() => openModal('help')}>
              HOW TO PLAY <ChevronRight size={13} />
            </button>
          </nav>
          <div className="header-right">
            <span className="header-status">
              <i /> A LITTLE ESCAPE.
            </span>
            <IconButton
              label="Open settings"
              onClick={() => openModal('settings')}
            >
              <Settings2 size={19} />
            </IconButton>
          </div>
        </header>

        <main>
          <div className="intro-line">
            <span>
              <span className="tiny-cross">✳</span> LESS NOISE. MORE FLOW.
            </span>
            <span className="edition">
              AN INDEPENDENT ARCADE EXPERIENCE <span>—</span> VOL. 001
            </span>
          </div>
          <section
            ref={arenaRef}
            tabIndex={-1}
            className={`arena ${mode === 'menu' ? 'menu-arena' : 'active-arena'} ${fullscreen ? 'fullscreen' : ''}`}
            aria-label="Neon Orbit game"
          >
            <GameCanvas
              mode={mode}
              run={run}
              light={light}
              reduced={reduced}
              sound={settings.sound}
              onUpdate={setStats}
              onEnd={end}
              onPause={pause}
            />
            <div className="arena-noise" aria-hidden="true" />
            <div className="arena-topline">
              <span className="live-label">
                <i />{' '}
                {mode === 'menu'
                  ? 'YOUR NEXT LITTLE OBSESSION'
                  : mode === 'playing'
                    ? 'YOU’RE IN THE ORBIT'
                    : mode === 'paused'
                      ? 'TAKE A BREATH'
                      : 'ONE MORE ORBIT?'}
              </span>
              <span className="arena-index">
                {mode === 'menu'
                  ? '01 / ∞'
                  : `SECTOR ${String(stats.level).padStart(2, '0')}`}
              </span>
            </div>
            <AnimatePresence mode="wait">
              {mode === 'menu' && (
                <motion.div
                  key="hero"
                  className="hero-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.45 }}
                >
                  <div className="hero-kicker">
                    <span /> SIMPLE TO PLAY. HARD TO LEAVE.
                  </div>
                  <h1>
                    NEON
                    <br />
                    <span>
                      ORBIT<span className="title-period">.</span>
                    </span>
                  </h1>
                  <p>
                    A little focus. A little chaos.
                    <br />
                    Find your flow in the space between.
                  </p>
                  <div className="hero-actions">
                    <button className="play-button group" onClick={start}>
                      <Play size={17} fill="currentColor" />
                      <span>Let’s play</span>
                      <ArrowRight
                        size={19}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </button>
                    <span className="play-note">
                      NO DOWNLOAD.
                      <br />
                      JUST YOU & THE ORBIT.
                    </span>
                  </div>
                  <div className="hero-record">
                    <Trophy size={14} />
                    <span>PERSONAL BEST</span>
                    <strong>{format(best).padStart(4, '0')}</strong>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {mode === 'menu' && (
              <>
                <div className="orbital-tag">
                  <span className="tag-line" />
                  <span>
                    STAY IN YOUR ORBIT.
                    <br />
                    <b>MAKE IT A GOOD ONE.</b>
                  </span>
                </div>
                <div className="sphere-caption">
                  <span className="caption-dot" /> BUILT FOR THE MOMENT.
                </div>
              </>
            )}
            {mode !== 'menu' && (
              <div className="game-hud">
                <div>
                  <span>SCORE</span>
                  <strong>{format(stats.score).padStart(4, '0')}</strong>
                </div>
                <div className="hud-secondary">
                  <span>ENERGY</span>
                  <strong>
                    <Zap size={15} /> {stats.energy}
                  </strong>
                </div>
                <div className="hud-secondary">
                  <span>TIME</span>
                  <strong>{clock(stats.seconds)}</strong>
                </div>
                <IconButton
                  label={mode === 'playing' ? 'Pause game' : 'Game paused'}
                  onClick={pause}
                >
                  <Pause size={19} />
                </IconButton>
              </div>
            )}
            <AnimatePresence>
              {(mode === 'paused' || mode === 'over') && (
                <motion.div
                  className="game-overlay"
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="result-card"
                    initial={{ y: 15, scale: 0.97 }}
                    animate={{ y: 0, scale: 1 }}
                    role="region"
                    aria-label={mode === 'paused' ? 'Game paused' : 'Game over'}
                  >
                    <span className="result-icon">
                      {mode === 'paused' ? (
                        <Pause size={25} />
                      ) : (
                        <Orbit size={31} />
                      )}
                    </span>
                    <span className="eyebrow">
                      {mode === 'paused'
                        ? 'A MOMENT OF STILLNESS'
                        : 'EVERY END IS A NEW BEGINNING'}
                    </span>
                    <h2>
                      {mode === 'paused'
                        ? 'Take your time.'
                        : 'A good little run.'}
                    </h2>
                    <p>
                      {mode === 'paused'
                        ? 'Your orbit will be right here.'
                        : 'Breathe. Reset. Go a little further.'}
                    </p>
                    <div className="result-stats">
                      <div>
                        <span>
                          {mode === 'paused' ? 'CURRENT SCORE' : 'YOUR SCORE'}
                        </span>
                        <strong>{format(stats.score)}</strong>
                      </div>
                      <div>
                        <span>PERSONAL BEST</span>
                        <strong>{format(best)}</strong>
                      </div>
                    </div>
                    {mode === 'over' &&
                      stats.score > 0 &&
                      stats.score === best && (
                        <div className="new-best">
                          <Trophy size={14} /> A new personal best. Nicely done.
                        </div>
                      )}
                    <button
                      className="play-button"
                      onClick={mode === 'paused' ? resume : start}
                    >
                      {mode === 'paused' ? (
                        <Play size={17} fill="currentColor" />
                      ) : (
                        <RotateCcw size={17} />
                      )}
                      <span>
                        {mode === 'paused'
                          ? 'Back to the orbit'
                          : 'One more orbit'}
                      </span>
                      <ArrowRight size={18} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setMode('menu')}
                    >
                      <Home size={14} /> Back to home
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="arena-bottomline">
              <span>
                <span className="signal-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                {mode === 'menu'
                  ? 'INFINITE POSSIBILITIES. ONE ORBIT.'
                  : 'COLLECT ENERGY. AVOID THE VIOLET.'}
              </span>
              <div>
                <IconButton
                  label={settings.sound ? 'Mute sound' : 'Enable sound'}
                  onClick={() => {
                    unlockAudio()
                    change('sound', !settings.sound)
                  }}
                  pressed={settings.sound}
                >
                  {settings.sound ? (
                    <Volume2 size={16} />
                  ) : (
                    <VolumeX size={16} />
                  )}
                </IconButton>
                <span className="toolbar-divider" />
                <IconButton
                  label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  onClick={() => void expand()}
                >
                  {fullscreen ? <Expand size={16} /> : <Maximize2 size={16} />}
                </IconButton>
              </div>
            </div>
          </section>

          <section className="how-strip" aria-label="How to play">
            <div className="how-title">
              <span className="eyebrow">THE ART OF KEEPING IT SIMPLE</span>
              <h2>
                One more try.
                <br />
                <span>Every single time.</span>
              </h2>
              <button className="text-button" onClick={() => openModal('help')}>
                A quick field guide <ArrowRight size={14} />
              </button>
            </div>
            <div className="instruction">
              <div className="instruction-top">
                <span className="step-number">01</span>
                <Crosshair size={20} strokeWidth={1.3} />
              </div>
              <h3>Find your flow.</h3>
              <p>
                Move with WASD or arrow keys. <br />
                On mobile? Just touch and glide.
              </p>
              <div className="key-group">
                <kbd>W</kbd>
                <span className="key-row">
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd>
                </span>
                <span className="or">/</span>
                <div className="arrow-keys">
                  <kbd>
                    <ArrowUp size={10} />
                  </kbd>
                  <span>
                    <kbd>
                      <ArrowLeft size={10} />
                    </kbd>
                    <kbd>
                      <ArrowDown size={10} />
                    </kbd>
                    <kbd>
                      <ArrowRight size={10} />
                    </kbd>
                  </span>
                </div>
              </div>
            </div>
            <div className="instruction">
              <div className="instruction-top">
                <span className="step-number">02</span>
                <Zap size={20} strokeWidth={1.3} className="energy-color" />
              </div>
              <h3>Chase the energy.</h3>
              <p>
                Collect the glowing green particles. <br />
                Each little spark takes you further.
              </p>
              <span className="mini-pill">
                <span className="energy-dot" /> +100 PER SPARK
              </span>
            </div>
            <div className="instruction">
              <div className="instruction-top">
                <span className="step-number">03</span>
                <Shield size={20} strokeWidth={1.3} className="violet-color" />
              </div>
              <h3>Embrace the chaos.</h3>
              <p>
                Dodge the violet. Stay in the moment. <br />
                The longer you last, the faster it gets.
              </p>
              <span className="mini-pill violet">
                <span className="hazard-dot" /> STAY SHARP. STAY ALIVE.
              </span>
            </div>
          </section>
          <div className="bottom-note">
            <span>
              <span className="small-star">✳</span> A SMALL GAME. A WELL-EARNED
              BREAK.
            </span>
            <span>
              <span className="status-dot" /> FREE TO PLAY. ALWAYS.
            </span>
          </div>
        </main>
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} NEON ORBIT</span>
          <span>Made for the joy of it.</span>
          <div>
            <button onClick={() => openModal('help')}>
              <CircleHelp size={14} /> Field guide
            </button>
            <span>·</span>
            <button onClick={() => openModal('settings')}>
              <Settings2 size={14} /> Settings
            </button>
          </div>
        </footer>
        <AnimatePresence>
          {modal && (
            <Dialog
              title={
                modal === 'settings'
                  ? 'Make it your orbit.'
                  : 'Your orbit starts here.'
              }
              close={closeModal}
            >
              {modal === 'settings' ? (
                <>
                  <p className="dialog-subtitle">
                    A few little things, just the way you like them.
                  </p>
                  <div className="setting-row">
                    <span>
                      <Volume2 size={19} />
                      <span>
                        <b>Sound</b>
                        <small>Soft notes for little victories.</small>
                      </span>
                    </span>
                    <button
                      role="switch"
                      aria-checked={settings.sound}
                      aria-label="Sound"
                      className={`toggle ${settings.sound ? 'on' : ''}`}
                      onClick={() => {
                        unlockAudio()
                        change('sound', !settings.sound)
                      }}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="setting-row">
                    <span>
                      <Sparkles size={19} />
                      <span>
                        <b>Ambient motion</b>
                        <small>
                          {prefersReduced
                            ? 'Reduced by your device preference.'
                            : 'Orbit animations and particle trails.'}
                        </small>
                      </span>
                    </span>
                    <button
                      role="switch"
                      aria-checked={settings.motion && !prefersReduced}
                      disabled={!!prefersReduced}
                      aria-label="Ambient motion"
                      className={`toggle ${settings.motion && !prefersReduced ? 'on' : ''}`}
                      onClick={() => change('motion', !settings.motion)}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="theme-setting">
                    <span>
                      <Sun size={19} /> Appearance
                    </span>
                    <div className="theme-options">
                      {(['dark', 'light', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          className={settings.theme === t ? 'selected' : ''}
                          aria-pressed={settings.theme === t}
                          onClick={() => change('theme', t)}
                        >
                          {t === 'dark' ? (
                            <Moon size={15} />
                          ) : t === 'light' ? (
                            <Sun size={15} />
                          ) : (
                            <Settings2 size={15} />
                          )}
                          {t[0].toUpperCase() + t.slice(1)}
                          {settings.theme === t && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="settings-footnote">
                    <Shield size={14} /> Preferences and your best score stay on
                    this device.
                  </p>
                </>
              ) : (
                <>
                  <p className="dialog-subtitle">
                    No levels to unlock. No rush to get anywhere. Just a better
                    run.
                  </p>
                  <div className="guide-item">
                    <Crosshair />
                    <div>
                      <h3>You’re the bright one.</h3>
                      <p>
                        Use WASD or the arrow keys to move your sphere. On a
                        touch screen, hold and glide across the arena. A mouse
                        works too.
                      </p>
                    </div>
                  </div>
                  <div className="guide-item">
                    <Zap className="energy-color" />
                    <div>
                      <h3>A little energy goes a long way.</h3>
                      <p>
                        Each green spark earns 100 points. You also earn 5
                        points for every second you survive.
                      </p>
                    </div>
                  </div>
                  <div className="guide-item">
                    <Shield className="violet-color" />
                    <div>
                      <h3>Give violet some space.</h3>
                      <p>
                        One collision ends the run. Every 15 seconds, the orbit
                        gets a little busier. Stay moving.
                      </p>
                    </div>
                  </div>
                  <div className="guide-item">
                    <Pause />
                    <div>
                      <h3>Life happens. Hit pause.</h3>
                      <p>
                        Press Esc, P, or Space, or tap the pause button.
                        Switching tabs pauses your run automatically.
                      </p>
                    </div>
                  </div>
                  <button
                    className="play-button guide-done"
                    onClick={closeModal}
                  >
                    Got it. Find my flow.
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
            </Dialog>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!loaded && (
            <motion.div
              className="loading-screen"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Orbit size={44} strokeWidth={1} />
              <span>
                FINDING YOUR ORBIT<span className="loading-dots">...</span>
              </span>
              <div className="loading-track">
                <motion.i
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {mode === 'over'
            ? `Game over. Score ${stats.score}. Personal best ${best}.`
            : mode === 'paused'
              ? 'Game paused.'
              : ''}
        </span>
      </div>
    </MotionConfig>
  )
}
