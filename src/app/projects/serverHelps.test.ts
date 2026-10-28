import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import pt from '../i18n/pt.json'
import list from './door43-languages.json'
import { languageLabel, languagesFromDoor43 } from './languages'
import {
  NO_ASK,
  askAnswered,
  askStarted,
  askedSaid,
  helpsNoteKey,
  helpsRows,
  mayChoose,
  rowChosen,
  serverLanguagesFound,
} from './serverHelps'

const texts: Record<string, Record<string, string>> = { es, pt, en }
const languages = languagesFromDoor43(list)
const codes = (found: Array<{ code: string }>) => found.map((l) => l.code)
const none = { leaveOut: [] }
/** The names the app shows, in the language it speaks (as `useLanguageLabel`). */
const labelIn = (lang: string) => (code: string) => languageLabel(code, [lang])

describe('the languages offered from the server', () => {
  it('are the gateway languages of the list Servos already has, searched as the project language is', () => {
    expect(codes(serverLanguagesFound(languages, 'swahili', none))).toEqual(['sw'])
    expect(codes(serverLanguagesFound(languages, 'portug', none))).toEqual(expect.arrayContaining(['pt', 'pt-br']))
    // Not a gateway language: not offered, however well it matches.
    expect(serverLanguagesFound(languages, 'quechua', none)).toEqual([])
    expect(serverLanguagesFound(languages, 'quz', none)).toEqual([])
  })

  it('leave out those already on the device and the one already chosen, and say nothing before anything is typed', () => {
    const found = codes(serverLanguagesFound(languages, 'espa', { leaveOut: ['es-419'] }))
    expect(found).toContain('es')
    expect(found).not.toContain('es-419')
    expect(codes(serverLanguagesFound(languages, 'swahili', { leaveOut: ['sw'] }))).toEqual([])
    expect(serverLanguagesFound(languages, '  ', none)).toEqual([])
  })

  it('are found by the name the app says them in, in Spanish, Portuguese and English', () => {
    // Door43 names English «English» and French «français»: a Spanish speaker types «inglés» or «francés».
    expect(codes(serverLanguagesFound(languages, 'ingl', { leaveOut: [], labelOf: labelIn('es') }))).toContain('en')
    expect(codes(serverLanguagesFound(languages, 'francés', { leaveOut: [], labelOf: labelIn('es') }))).toContain('fr')
    expect(codes(serverLanguagesFound(languages, 'inglês', { leaveOut: [], labelOf: labelIn('pt') }))).toContain('en')
    expect(codes(serverLanguagesFound(languages, 'frances', { leaveOut: [], labelOf: labelIn('pt') }))).toContain('fr')
    expect(codes(serverLanguagesFound(languages, 'french', { leaveOut: [], labelOf: labelIn('en') }))).toContain('fr')
    expect(codes(serverLanguagesFound(languages, 'swedish', { leaveOut: [], labelOf: labelIn('en') }))).toEqual([])
    // Without the app's names, only Door43's.
    expect(codes(serverLanguagesFound(languages, 'ingl', none))).toEqual([])
  })

  it('show the app\'s name among the others, once', () => {
    const [english] = serverLanguagesFound(languages, 'ingl', { leaveOut: [], labelOf: labelIn('es') })
    expect(english.aliases[0]).toBe('Inglés')
    const [swahili] = serverLanguagesFound(languages, 'kiswahili', { leaveOut: [], labelOf: () => 'Kiswahili' })
    expect(swahili.aliases).not.toContain('Kiswahili')
  })
})

describe('asking, and choosing meanwhile', () => {
  const listo = { kind: 'listo' as const, books: ['rut', 'tit'] }

  it('the answer of the language asked chooses it, once the server has its books', () => {
    const asked = askStarted(NO_ASK, 'sv')
    expect(asked.pending).toEqual({ code: 'sv', answer: null })
    const { flow, choose } = askAnswered(asked, 'sv', listo)
    expect(choose).toBe('sv')
    expect(flow).toEqual({ last: null, pending: null, got: { code: 'sv', answer: listo } })
  })

  it('a refusal is said, and chooses nothing', () => {
    const { flow, choose } = askAnswered(askStarted(NO_ASK, 'sv'), 'sv', { kind: 'preparando' })
    expect(choose).toBeNull()
    expect(flow.pending).toEqual({ code: 'sv', answer: { kind: 'preparando' } })
    expect(askAnswered(askStarted(NO_ASK, 'sv'), 'sv', { kind: 'listo', books: [] }).choose).toBeNull()
  })

  it('a row touched while a language is asked wins: the late answer changes nothing', () => {
    // «Sueco» touched («Preguntando…»), then es-419; Sueco then answers «listo».
    const touched = rowChosen(askStarted(NO_ASK, 'sv'))
    expect(touched.pending).toBeNull()
    const { flow, choose } = askAnswered(touched, 'sv', listo)
    expect(choose).toBeNull()
    expect(flow).toBe(touched)
  })

  it('another language asked meanwhile: only its answer counts', () => {
    const both = askStarted(askStarted(NO_ASK, 'sv'), 'fr')
    expect(askAnswered(both, 'sv', listo).choose).toBeNull()
    expect(askAnswered(both, 'fr', listo).choose).toBe('fr')
  })

  it('a row chosen keeps the server\'s language as a row, to come back to it', () => {
    const got = askAnswered(askStarted(NO_ASK, 'sv'), 'sv', listo).flow
    expect(rowChosen(got).got).toEqual({ code: 'sv', answer: listo })
  })
})

describe('which rows the helps choice shows', () => {
  const here = ['es-419']

  it('offline, the languages here and nothing else, as before', () => {
    expect(helpsRows({ here, value: 'es-419', got: null, online: false })).toEqual({ server: null, away: null, other: false, noPacks: false })
    // A project's own language that is not here is still kept, and said so.
    expect(helpsRows({ here, value: 'fr', got: null, online: false })).toEqual({ server: null, away: 'fr', other: false, noPacks: false })
  })

  it('online, «Otro idioma…» too', () => {
    expect(helpsRows({ here, value: 'es-419', got: null, online: true }).other).toBe(true)
  })

  it('a language the server has becomes a row with its books, and is not said to be away when chosen', () => {
    const got = { code: 'fr', answer: { kind: 'listo' as const, books: ['tit', 'rut'] } }
    expect(helpsRows({ here, value: 'fr', got, online: true })).toEqual({ server: { code: 'fr', books: 2 }, away: null, other: true, noPacks: false })
    // Chosen another one after: its row stays, to come back to it.
    expect(helpsRows({ here, value: 'es-419', got, online: true }).server).toEqual({ code: 'fr', books: 2 })
  })

  it('a language that cannot be had makes no row', () => {
    for (const answer of [null, { kind: 'preparando' as const }, { kind: 'sinIdioma' as const }, { kind: 'listo' as const, books: [] }]) {
      expect(helpsRows({ here, value: 'es-419', got: { code: 'fr', answer }, online: true }).server).toBeNull()
    }
  })

  it('«no texts here» is said while nothing here is chosen, not once a language of the server is', () => {
    expect(helpsRows({ here: [], value: 'es-419', got: null, online: true }).noPacks).toBe(true)
    const got = { code: 'fr', answer: { kind: 'listo' as const, books: ['tit'] } }
    expect(helpsRows({ here: [], value: 'fr', got, online: true }).noPacks).toBe(false)
    expect(helpsRows({ here: [], value: 'es-419', got, online: true }).noPacks).toBe(true)
  })
})

describe('the note above the choice', () => {
  it('says the device\'s languages come first and the server\'s too, only with internet', () => {
    expect(helpsNoteKey(false)).toBe('nuevo.ayudasNota')
    expect(helpsNoteKey(true)).toBe('nuevo.ayudasNotaEnLinea')
  })

  it('is there in the three languages, with its computer form', () => {
    for (const lang of Object.keys(texts)) {
      expect(texts[lang]['nuevo.ayudasNotaEnLinea'], lang).toBeTruthy()
      expect(texts[lang]['nuevo.ayudasNotaEnLinea.computadora'], lang).toBeTruthy()
    }
    expect(texts.es['nuevo.ayudasNotaEnLinea']).toMatch(/teléfono/)
    expect(texts.es['nuevo.ayudasNotaEnLinea.computadora']).toMatch(/computadora/)
  })
})

describe('whether it can be chosen', () => {
  it('only with books to download', () => {
    expect(mayChoose({ kind: 'listo', books: ['tit'] })).toBe(true)
    expect(mayChoose({ kind: 'listo', books: [] })).toBe(false)
    expect(mayChoose({ kind: 'preparando' })).toBe(false)
    expect(mayChoose({ kind: 'noDisponible' })).toBe(false)
    expect(mayChoose(null)).toBe(false)
  })
})

describe('what is said of a language asked for', () => {
  it('its books on the server, one or several', () => {
    expect(askedSaid({ kind: 'listo', books: ['tit', 'rut'] })).toEqual({ key: 'enLinea.enServidor', values: { n: 2 } })
    expect(askedSaid({ kind: 'listo', books: ['tit'] })).toEqual({ key: 'enLinea.enServidorUno' })
  })

  it('while it is asked, and why it cannot be had: to try later where nothing tries for the person', () => {
    expect(askedSaid(null)).toEqual({ key: 'enLinea.preguntando' })
    expect(askedSaid({ kind: 'preparando' })).toEqual({ key: 'enLinea.preparandoIdioma' })
    expect(askedSaid({ kind: 'sinIdioma' })).toEqual({ key: 'enLinea.sinIdioma' })
    expect(askedSaid({ kind: 'listo', books: [] })).toEqual({ key: 'enLinea.sinIdioma' })
    expect(askedSaid({ kind: 'noDisponible' })).toEqual({ key: 'enLinea.noRespondeIdioma' })
    expect(askedSaid({ kind: 'actualizarApp' })).toEqual({ key: 'enLinea.actualizarApp' })
  })

  it('every phrase it can choose, and those of the search, are there in the three languages', () => {
    const keys = [
      'enLinea.enServidor', 'enLinea.enServidorUno', 'enLinea.preguntando', 'enLinea.preparandoIdioma', 'enLinea.noRespondeIdioma',
      'enLinea.otroIdioma', 'enLinea.buscarIdioma', 'enLinea.ningunIdioma',
    ]
    for (const key of keys) for (const lang of Object.keys(texts)) expect(texts[lang][key], `${lang} ${key}`).toBeTruthy()
    // None of them names the phone, nor speaks of «idiomas puente».
    for (const key of keys) for (const lang of Object.keys(texts)) expect(texts[lang][key], `${lang} ${key}`).not.toMatch(/teléfono|telefone|phone|idioma puente|idioma ponte|gateway/i)
  })
})
