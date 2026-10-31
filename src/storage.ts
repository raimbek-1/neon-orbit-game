export type Settings = {
  sound: boolean
  motion: boolean
  theme: 'dark' | 'light' | 'system'
}
export const defaults: Settings = { sound: true, motion: true, theme: 'dark' }
export function readBest() {
  try {
    const n = Number(localStorage.getItem('neon-orbit.best'))
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}
export function readSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('neon-orbit.settings') || '{}')
    return {
      sound: typeof s.sound === 'boolean' ? s.sound : true,
      motion: typeof s.motion === 'boolean' ? s.motion : true,
      theme: ['dark', 'light', 'system'].includes(s.theme) ? s.theme : 'dark',
    }
  } catch {
    return defaults
  }
}
export function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(`neon-orbit.${key}`, JSON.stringify(value))
  } catch {
    /* Private browsing can restrict storage. */
  }
}
