import { describe, expect, it } from 'vitest'
import '../miniapps/registry'
import { computerKey, deviceOf, phoneKeyOf } from './device'
import { BASE_LANGUAGES, allKeys, baseText, lookup, marksOf, soundPhrases, type Texts } from './i18n'

const pointer = (fine: boolean) => ({ matchMedia: (q: string) => ({ matches: fine && q === '(hover: hover) and (pointer: fine)' }) })

describe('a phone or a computer, for the wording', () => {
  it('is a computer with a mouse or a touchpad, a phone with a finger', () => {
    expect(deviceOf(pointer(true))).toBe('computadora')
    expect(deviceOf(pointer(false))).toBe('telefono')
  })

  it('is a computer in the desktop build', () => {
    expect(deviceOf({ ...pointer(false), __TAURI_INTERNALS__: {} })).toBe('computadora')
  })

  it('is a phone when nothing can be asked', () => {
    expect(deviceOf(undefined)).toBe('telefono')
    expect(deviceOf({})).toBe('telefono')
    expect(
      deviceOf({
        matchMedia: () => {
          throw new Error('no')
        },
      })
    ).toBe('telefono')
  })
})

describe('a phrase on a phone and on a computer', () => {
  const es: Texts = { 'a.toque': 'Toque un libro.', 'a.toque.computadora': 'Haga clic en un libro.', 'a.volver': 'Volver' }
  const mine: Texts = { 'a.toque': 'Libruta llapiy.' }

  it('says each its own way', () => {
    expect(lookup('a.toque', [es], 'telefono')).toBe('Toque un libro.')
    expect(lookup('a.toque', [es], 'computadora')).toBe('Haga clic en un libro.')
  })

  it('says one way on both when there is one', () => {
    expect(lookup('a.volver', [es], 'computadora')).toBe('Volver')
    expect(lookup('a.nada', [es], 'computadora')).toBeUndefined()
  })

  it('stays in the person’s language, though only its phone form is translated', () => {
    expect(lookup('a.toque', [mine, es], 'computadora')).toBe('Libruta llapiy.')
    expect(lookup('a.toque', [{ ...mine, 'a.toque.computadora': 'Librupi clic.' }, es], 'computadora')).toBe('Librupi clic.')
  })
})

describe('the app’s phrases on a computer', () => {
  const keys = allKeys()
  const phones = keys.filter((k) => !phoneKeyOf(k))
  const texts = Object.fromEntries(BASE_LANGUAGES.map((lang) => [lang, Object.fromEntries(keys.map((k) => [k, baseText(lang, k)!]))]))
  const textOn = (lang: (typeof BASE_LANGUAGES)[number], key: string, device: 'telefono' | 'computadora') => lookup(key, [texts[lang]], device)!

  // Fingers and this phone; «Touch up» (retouch a mix) is not a touch.
  const TOUCH = /tel[ée]fon|\btoqu|\btóqu|\bdedo\b|\bdesli[cz]|\bphones?\b|\btap\b|\btouch\b(?! up)|\bswipe|\bslide|\bfinger/i
  const CLICK = /computador|\bclic|\bcliqu|\bclick|\brat[óo]n\b|\bmouse\b/i
  // Phrases that name a phone or a computer where it is right on both.
  const NAMES_A_PHONE = ['interfaz.enTelefono']
  const NAMES_A_COMPUTER = [
    'interfaz.enComputadora',
    'door43.host.mock',
    // Files for another computer: said so on a phone too since books are shared in one file (fc725d4).
    'ajustes.compartirAyuda',
    'glosario.compartirAyuda',
    'libro.compartirAyuda',
    'libro.recibirTrabajo',
    'libro.recibirTrabajoAyuda',
  ]

  it('no phrase speaks of a finger or of this phone', () => {
    for (const lang of BASE_LANGUAGES) {
      const wrong = phones.filter((k) => !NAMES_A_PHONE.includes(k) && TOUCH.test(textOn(lang, k, 'computadora')))
      expect(wrong, lang).toEqual([])
    }
  })

  it('on a phone, no phrase speaks of a mouse or of this computer', () => {
    for (const lang of BASE_LANGUAGES) {
      const wrong = phones.filter((k) => !NAMES_A_COMPUTER.includes(k) && CLICK.test(textOn(lang, k, 'telefono')))
      expect(wrong, lang).toEqual([])
    }
  })

  it('each computer form stands beside its phrase, in the three languages, with its marks', () => {
    for (const key of keys.filter((k) => phoneKeyOf(k))) {
      const phone = phoneKeyOf(key)!
      for (const lang of BASE_LANGUAGES) {
        expect(baseText(lang, key), `${lang} ${key}`).toBeTruthy()
        expect(marksOf(baseText(lang, key)!), `${lang} ${key}`).toEqual(marksOf(baseText(lang, phone) ?? ''))
      }
    }
  })

  it('a translation received keeps its computer forms, and leaves out one with other marks or none in the app', () => {
    const received = soundPhrases({
      'marco.guardadoAqui.computadora': '✓ kay antanikipi',
      [computerKey('libro.faltaPaquete')]: 'mana kanchu',
      [computerKey('marco.volver')]: 'Kutiy',
    })
    expect(received).toEqual({ 'marco.guardadoAqui.computadora': '✓ kay antanikipi' })
  })
})
