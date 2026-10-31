let context: AudioContext | undefined
export function unlockAudio() {
  try {
    context ??= new AudioContext()
    void context.resume().catch(() => {})
  } catch {
    /* Audio is optional. */
  }
}
export function playTone(kind: 'collect' | 'end', enabled: boolean) {
  if (!enabled || !context || context.state !== 'running') return
  const now = context.currentTime
  const osc = context.createOscillator(),
    gain = context.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(kind === 'collect' ? 660 : 180, now)
  osc.frequency.exponentialRampToValueAtTime(
    kind === 'collect' ? 1100 : 55,
    now + 0.16,
  )
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.075, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
  osc.connect(gain)
  gain.connect(context.destination)
  osc.start()
  osc.stop(now + 0.25)
}
