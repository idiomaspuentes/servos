import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import pt from '../i18n/pt.json'
import list from './door43-languages.json'
import { languagesFromDoor43 } from './languages'
import { askedSaid, helpsRows, mayChoose, serverLanguagesFound } from './serverHelps'

const texts: Record<string, Record<string, string>> = { es, pt, en }
const languages = languagesFromDoor43(list)
const codes = (found: Array<{ code: string }>) => found.map((l) => l.code)

describe('the languages offered from the server', () => {
  it('are the gateway languages of the list Servos already has, searched as the project language is', () => {
    expect(codes(serverLanguagesFound(languages, 'swahili', []))).toEqual(['sw'])
    expect(codes(serverLanguagesFound(languages, 'portug', []))).toEqual(expect.arrayContaining(['pt', 'pt-br']))
    // Not a gateway language: not offered, however well it matches.
    expect(serverLanguagesFound(languages, 'quechua', [])).toEqual([])
    expect(serverLanguagesFound(languages, 'quz', [])).toEqual([])
  })

  it('leave out those already on the device, and say nothing before anything is typed', () => {
    const found = codes(serverLanguagesFound(languages, 'espa', ['es-419']))
    expect(found).toContain('es')
    expect(found).not.toContain('es-419')
    expect(serverLanguagesFound(languages, '  ', [])).toEqual([])
  })
})

describe('which rows the helps choice shows', () => {
  const here = ['es-419']

  it('offline, the languages here and nothing else, as before', () => {
    expect(helpsRows({ here, value: 'es-419', asked: null, online: false })).toEqual({ server: null, away: null, other: false })
    // A project's own language that is not here is still kept, and said so.
    expect(helpsRows({ here, value: 'fr', asked: null, online: false })).toEqual({ server: null, away: 'fr', other: false })
  })

  it('online, «Otro idioma…» too', () => {
    expect(helpsRows({ here, value: 'es-419', asked: null, online: true }).other).toBe(true)
  })

  it('a language the server has becomes a row with its books, and is not said to be away when chosen', () => {
    const asked = { code: 'fr', answer: { kind: 'listo' as const, books: ['tit', 'rut'] } }
    expect(helpsRows({ here, value: 'fr', asked, online: true })).toEqual({ server: { code: 'fr', books: 2 }, away: null, other: true })
    // Chosen another one after: its row stays, to come back to it.
    expect(helpsRows({ here, value: 'es-419', asked, online: true }).server).toEqual({ code: 'fr', books: 2 })
  })

  it('a language asked for that cannot be had, or is still being asked, makes no row', () => {
    for (const answer of [null, { kind: 'preparando' as const }, { kind: 'sinIdioma' as const }, { kind: 'listo' as const, books: [] }]) {
      expect(helpsRows({ here, value: 'es-419', asked: { code: 'fr', answer }, online: true }).server).toBeNull()
    }
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

  it('while it is asked, and why it cannot be had: «preparando» to try later, the others as a book says them', () => {
    expect(askedSaid(null)).toEqual({ key: 'enLinea.preguntando' })
    expect(askedSaid({ kind: 'preparando' })).toEqual({ key: 'enLinea.preparandoIdioma' })
    expect(askedSaid({ kind: 'sinIdioma' })).toEqual({ key: 'enLinea.sinIdioma' })
    expect(askedSaid({ kind: 'listo', books: [] })).toEqual({ key: 'enLinea.sinIdioma' })
    expect(askedSaid({ kind: 'noDisponible' })).toEqual({ key: 'enLinea.noDisponible' })
    expect(askedSaid({ kind: 'actualizarApp' })).toEqual({ key: 'enLinea.actualizarApp' })
  })

  it('every phrase it can choose, and those of the search, are there in the three languages', () => {
    const keys = ['enLinea.enServidor', 'enLinea.enServidorUno', 'enLinea.preguntando', 'enLinea.preparandoIdioma', 'enLinea.otroIdioma', 'enLinea.buscarIdioma', 'enLinea.ningunIdioma']
    for (const key of keys) for (const lang of Object.keys(texts)) expect(texts[lang][key], `${lang} ${key}`).toBeTruthy()
    // None of them names the phone.
    for (const key of keys) expect(texts.es[key]).not.toMatch(/teléfono/)
  })
})
