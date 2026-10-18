/**
 * Where the app is used, for its wording only (design philosophy, principle 13): on a computer the texts say «haga
 * clic» and «esta computadora», on a phone «toque» and «este teléfono». The layout does not go by this but by the
 * window's width: a narrow window on a computer is laid out as a phone, and still says «haga clic».
 *
 * A computer is a pointer that is fine and can hover (a mouse, a touchpad), or the desktop build (Tauri, which Servos
 * uses only on computers: design, section 11). A touch screen with nothing else, a computer's too, is touched.
 *
 * A phrase that says it otherwise on a computer has its computer form beside it, a key of its own,
 * `{key}.computadora`, in the three base languages; it is translated like any other phrase.
 */

export type Device = 'telefono' | 'computadora'

const FINE_POINTER = '(hover: hover) and (pointer: fine)'

/** What is read of the window: its pointer, and whether the desktop build put Tauri in it. */
export interface Host {
  matchMedia?(query: string): { matches: boolean }
  __TAURI_INTERNALS__?: unknown
}

export function deviceOf(host: Host | undefined): Device {
  if (!host) return 'telefono'
  if (host.__TAURI_INTERNALS__) return 'computadora'
  try {
    return host.matchMedia?.(FINE_POINTER).matches ? 'computadora' : 'telefono'
  } catch {
    return 'telefono'
  }
}

/** The device of this window; a phone where there is no window (the tests). */
export function currentDevice(): Device {
  return deviceOf(typeof window === 'undefined' ? undefined : (window as Host))
}

/** Tells when the pointer changes (a mouse plugged into a tablet, or taken out); gives back how to stop. */
export function watchDevice(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(FINE_POINTER)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const COMPUTER = '.computadora'

/** The key of a phrase's computer form. */
export const computerKey = (key: string) => `${key}${COMPUTER}`

/** The phrase a computer form stands for, or null when the key is not one. */
export const phoneKeyOf = (key: string): string | null => (key.endsWith(COMPUTER) ? key.slice(0, -COMPUTER.length) : null)
