/**
 * A project's helps language from the server (`HelpsChoice`): with internet, beside the languages on the device, «Otro
 * idioma…» searches the gateway languages of the list Servos already has (`languages.ts`, the same search as the
 * project's language), and the one chosen is asked of the Worker, alone (`askLanguage`). Here only which rows to show,
 * whether a language can be chosen, and which phrase to say; the phrases are in `i18n/{es,pt,en}.json` (`enLinea.*`).
 */

import type { LanguageAnswer } from '../../resources/online/onlineResources'
import { searchLanguages, type LanguageOption } from './languages'
import { blockedKey, type Said } from './onlineWords'

/** A language asked for: its code and, once it came, the Worker's answer (null while it is asked). */
export type Asked = { code: string; answer: LanguageAnswer | null }

/** The gateway languages that match what was typed, without those already on the device; nothing before typing. */
export function serverLanguagesFound(list: readonly LanguageOption[], query: string, here: readonly string[]): LanguageOption[] {
  return searchLanguages(
    list.filter((l) => l.gateway && !here.includes(l.code)),
    query,
  )
}

/** A language the server has books of: a project can be made with it now. */
export const mayChoose = (answer: LanguageAnswer | null): answer is { kind: 'listo'; books: string[] } =>
  answer?.kind === 'listo' && answer.books.length > 0

/**
 * The rows beside the languages here: the one the server has (once asked, and while it can be chosen), the project's
 * own language that is neither here nor that one (kept, and said so, as before), and «Otro idioma…» with internet.
 */
export function helpsRows(input: { here: readonly string[]; value: string; asked: Asked | null; online: boolean }): {
  server: { code: string; books: number } | null
  away: string | null
  other: boolean
} {
  const { here, value, asked, online } = input
  const server = asked && mayChoose(asked.answer) ? { code: asked.code, books: asked.answer.books.length } : null
  const away = value && !here.includes(value) && value !== server?.code ? value : null
  return { server, away, other: online }
}

/** What is said of a language asked for: while it is asked, its books on the server, or why it cannot be had. */
export function askedSaid(answer: LanguageAnswer | null): Said {
  if (!answer) return { key: 'enLinea.preguntando' }
  switch (answer.kind) {
    case 'listo':
      if (!answer.books.length) return { key: blockedKey('sinIdioma') }
      return answer.books.length === 1 ? { key: 'enLinea.enServidorUno' } : { key: 'enLinea.enServidor', values: { n: answer.books.length } }
    // Not «se intentará otra vez»: nothing tries again for a language no project reads; the person does.
    case 'preparando':
      return { key: 'enLinea.preparandoIdioma' }
    default:
      return { key: blockedKey(answer.kind) }
  }
}
