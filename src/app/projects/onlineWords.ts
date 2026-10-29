/**
 * How the screens say what Servos online is doing (spec §2): the size of a download, why it cannot come, how far it
 * went, and what changed. Only which phrase and which values: the phrases are in `i18n/{es,pt,en}.json` (`enLinea.*`),
 * and a phrase that names the phone has its computer form there, chosen by `t` itself.
 */

import type { Blocked } from '../../resources/online/planLanguage'
import type { Progress } from '../../resources/online/downloads'
import type { T } from '../i18n/i18n'

/** A phrase to say: its key and the values that fill it. */
export type Said = { key: string; values?: Record<string, string | number> }

const KB = 1000
const MB = 1000 * 1000

function number(n: number, lang: string, digits: number): string {
  const options = { minimumFractionDigits: digits, maximumFractionDigits: digits }
  try {
    return new Intl.NumberFormat(lang, options).format(n)
  } catch {
    // A language tag Intl does not take (a translation's own code): the numbers as Spanish writes them.
    return new Intl.NumberFormat('es', options).format(n)
  }
}

/**
 * Bytes as a phone says them: whole kilobytes under a megabyte («340 KB»), megabytes with one decimal from there
 * («3,4 MB», with the decimal mark of the app's language). Never «0 KB» for something that weighs anything.
 */
export function sizeSaid(bytes: number, lang: string): Said {
  const kb = Math.round(bytes / KB)
  if (kb < 1000) return { key: 'enLinea.kb', values: { n: number(bytes > 0 ? Math.max(1, kb) : 0, lang, 0) } }
  return { key: 'enLinea.mb', values: { n: number(Math.round((bytes / MB) * 10) / 10, lang, 1) } }
}

export const sizeIn = (t: T, bytes: number, lang: string): string => {
  const s = sizeSaid(bytes, lang)
  return t(s.key, s.values)
}

const BLOCKED: Record<Blocked, string> = {
  preparando: 'enLinea.preparando',
  actualizarApp: 'enLinea.actualizarApp',
  sinIdioma: 'enLinea.sinIdioma',
  noDisponible: 'enLinea.noDisponible',
  sinEspacio: 'enLinea.sinEspacio',
}

/** Why a language's texts and helps cannot come now, as the notice says it (no retry: the app tries by itself). */
export const blockedKey = (why: Blocked): string => BLOCKED[why]

/** How far a download went, in whole percent: by bytes, or by parts when the bytes are not known. */
export function percentOf(p: Progress): number {
  const ratio = p.bytesTotal > 0 ? p.bytesDone / p.bytesTotal : p.total > 0 ? p.done / p.total : 0
  return Math.max(0, Math.min(100, Math.floor(100 * ratio)))
}

/**
 * The line that says a book's texts and helps will come (`alCrear`, in «Add a book») or the button that brings them
 * (`bajar`, in the book): with the size once it is known, and without it meanwhile, so nothing waits for it.
 */
export function downloadSaid(kind: 'alCrear' | 'bajar', size: string | null | undefined): Said {
  return size ? { key: `enLinea.${kind}`, values: { tamano: size } } : { key: `enLinea.${kind}SinTamano` }
}

/** What an update changed in the translated verses; nothing to say when it changed none. */
export function doneSaid(changedVerses: number): Said | null {
  if (changedVerses <= 0) return null
  return changedVerses === 1 ? { key: 'enLinea.alDiaUno' } : { key: 'enLinea.alDia', values: { n: changedVerses } }
}
