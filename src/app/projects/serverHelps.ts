/**
 * A project's helps language from the server (`HelpsChoice`): with internet, beside the languages on the device, «Otro
 * idioma…» searches the gateway languages of the list Servos already has (`languages.ts`, the same search as the
 * project's language, also by the name the app says them in), and the one chosen is asked of the Worker, alone
 * (`askLanguage`). Here only which rows to show, what an answer does to the choice, and which phrase to say; the phrases
 * are in `i18n/{es,pt,en}.json` (`enLinea.*`, `nuevo.*`).
 */

import type { LanguageAnswer } from '../../resources/online/onlineResources'
import { searchLanguages, type LanguageOption } from './languages'
import { blockedKey, type Said } from './onlineWords'

/** A language asked for: its code and, once it came, the Worker's answer (null while it is asked). */
export type Asked = { code: string; answer: LanguageAnswer | null }

/**
 * The gateway languages that match what was typed, without those left out (on the device, or already chosen from the
 * server); nothing before typing. Door43 names a language in itself and in English («English», «français»): the name
 * the app says it in (`labelOf`, «Inglés») is searched too, and shown first among its other names.
 */
export function serverLanguagesFound(
  list: readonly LanguageOption[],
  query: string,
  { leaveOut, labelOf }: { leaveOut: readonly string[]; labelOf?: (code: string) => string },
): LanguageOption[] {
  const offered = list
    .filter((l) => l.gateway && !leaveOut.includes(l.code))
    .map((l) => {
      const label = labelOf?.(l.code)
      const known = !label || label === l.code || label === l.name || l.aliases.includes(label)
      return known ? l : { ...l, aliases: [label, ...l.aliases] }
    })
  return searchLanguages(offered, query)
}

/** A language the server has books of: a project can be made with it now. */
export const mayChoose = (answer: LanguageAnswer | null): answer is { kind: 'listo'; books: string[] } =>
  answer?.kind === 'listo' && answer.books.length > 0

/**
 * Where the asking stands: the language last asked whose answer is still awaited (`last`), the one being asked or
 * refused (`pending`, said under the search), and the last one the server has (`got`, a row).
 */
export type AskFlow = { last: string | null; pending: Asked | null; got: Asked | null }
export const NO_ASK: AskFlow = { last: null, pending: null, got: null }

/** A language touched in the search: it is asked, and its answer awaited. */
export const askStarted = (flow: AskFlow, code: string): AskFlow => ({ ...flow, last: code, pending: { code, answer: null } })

/** A row touched (here, the server's, the project's own): the choice is made; no answer still coming may change it. */
export const rowChosen = (flow: AskFlow): AskFlow => ({ ...flow, last: null, pending: null })

/**
 * An answer came. Only that of the language last asked counts, and only while no row was touched since: a late answer
 * changes nothing. One the server has books of is chosen (`choose`); a refusal is said.
 */
export function askAnswered(flow: AskFlow, code: string, answer: LanguageAnswer): { flow: AskFlow; choose: string | null } {
  if (flow.last !== code) return { flow, choose: null }
  if (!mayChoose(answer)) return { flow: { ...flow, last: null, pending: { code, answer } }, choose: null }
  return { flow: { last: null, pending: null, got: { code, answer } }, choose: code }
}

/**
 * The rows beside the languages here: the one the server has (while it can be chosen), the project's own language that
 * is neither here nor that one (kept, and said so, as before), «Otro idioma…» with internet, and whether to say there
 * are no texts on the device (not once a language of the server is chosen: it would say the opposite).
 */
export function helpsRows(input: { here: readonly string[]; value: string; got: Asked | null; online: boolean }): {
  server: { code: string; books: number } | null
  away: string | null
  other: boolean
  noPacks: boolean
} {
  const { here, value, got, online } = input
  const server = got && mayChoose(got.answer) ? { code: got.code, books: got.answer.books.length } : null
  const fromServer = server !== null && value === server.code
  const away = value && !here.includes(value) && !fromServer ? value : null
  return { server, away, other: online, noPacks: !here.length && !fromServer }
}

/** The note above the choice: with internet it says the server's languages come too. */
export const helpsNoteKey = (online: boolean): string => (online ? 'nuevo.ayudasNotaEnLinea' : 'nuevo.ayudasNota')

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
    case 'noDisponible':
      return { key: 'enLinea.noRespondeIdioma' }
    default:
      return { key: blockedKey(answer.kind) }
  }
}
