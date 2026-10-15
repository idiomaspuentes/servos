/**
 * The app's interface in a language translated on a phone, in one file to pass to another phone (design, section 9):
 * whoever translated the app in their language gives it to the rest of the team. Received, it is gathered without
 * losing anything: a phrase this phone had translated otherwise keeps its own text.
 */

export const INTERFACE_FORMAT = 'servos-interfaz'

export interface InterfacePackage {
  format: typeof INTERFACE_FORMAT
  version: 1
  code: string
  name: string
  /** The base language shown where a phrase is not translated yet. */
  fallback: string
  texts: Record<string, string>
}

export function interfacePackage(code: string, name: string, fallback: string, texts: Record<string, string>): InterfacePackage {
  return { format: INTERFACE_FORMAT, version: 1, code, name, fallback, texts }
}

/** The package in a text, or null when it is not one. */
export function readInterfacePackage(text: string): InterfacePackage | null {
  try {
    const p = JSON.parse(text) as InterfacePackage
    if (p?.format !== INTERFACE_FORMAT || !p.code || typeof p.texts !== 'object' || !p.texts) return null
    const texts = Object.fromEntries(Object.entries(p.texts).filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && v.trim()))
    return { ...p, name: p.name || p.code, texts }
  } catch {
    return null
  }
}

/** What a package adds to this phone's texts in that language: new phrases in, this phone's own kept. */
export function gatherInterface(mine: Record<string, string>, received: Record<string, string>) {
  const texts = { ...mine }
  let added = 0
  let kept = 0
  for (const [key, text] of Object.entries(received)) {
    if (!(key in mine)) {
      texts[key] = text
      added++
    } else if (mine[key] !== text) kept++
  }
  return { texts, added, kept }
}
