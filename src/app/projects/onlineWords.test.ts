import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import pt from '../i18n/pt.json'
import type { Blocked } from '../../resources/online/planLanguage'
import { blockedKey, doneSaid, downloadSaid, percentOf, sizeSaid } from './onlineWords'

const texts: Record<string, Record<string, string>> = { es, pt, en }

describe('the size of a download', () => {
  it('says kilobytes under a megabyte, whole', () => {
    expect(sizeSaid(340_000, 'es')).toEqual({ key: 'enLinea.kb', values: { n: '340' } })
    expect(sizeSaid(340_499, 'en')).toEqual({ key: 'enLinea.kb', values: { n: '340' } })
    expect(sizeSaid(999_000, 'es')).toEqual({ key: 'enLinea.kb', values: { n: '999' } })
  })

  it('never says 0 KB for something that weighs anything', () => {
    expect(sizeSaid(120, 'es').values).toEqual({ n: '1' })
    expect(sizeSaid(0, 'es').values).toEqual({ n: '0' })
  })

  it('says megabytes with one decimal, in the language’s decimal mark', () => {
    expect(sizeSaid(3_400_000, 'es')).toEqual({ key: 'enLinea.mb', values: { n: '3,4' } })
    expect(sizeSaid(3_400_000, 'pt')).toEqual({ key: 'enLinea.mb', values: { n: '3,4' } })
    expect(sizeSaid(3_400_000, 'en')).toEqual({ key: 'enLinea.mb', values: { n: '3.4' } })
    expect(sizeSaid(12_000_000, 'es').values).toEqual({ n: '12,0' })
  })

  it('goes to megabytes where kilobytes would round to a thousand', () => {
    expect(sizeSaid(999_600, 'es')).toEqual({ key: 'enLinea.mb', values: { n: '1,0' } })
  })

  it('writes the number even for a language Intl does not take', () => {
    expect(sizeSaid(3_400_000, 'not a tag!').values).toEqual({ n: '3,4' })
  })
})

describe('why the texts cannot come', () => {
  const codes: Blocked[] = ['preparando', 'actualizarApp', 'sinIdioma', 'noDisponible', 'sinEspacio']

  it('each code has its phrase, in the three languages', () => {
    for (const code of codes) {
      const key = blockedKey(code)
      expect(key).toBe(`enLinea.${code}`)
      for (const lang of Object.keys(texts)) expect(texts[lang][key], `${lang} ${key}`).toBeTruthy()
    }
  })

  it('no space names the phone, and so has its computer form', () => {
    for (const lang of Object.keys(texts)) expect(texts[lang][`${blockedKey('sinEspacio')}.computadora`], lang).toBeTruthy()
  })
})

describe('the download line and button', () => {
  it('says the size once it is known, and the phrase without it meanwhile', () => {
    expect(downloadSaid('alCrear', '3,4 MB')).toEqual({ key: 'enLinea.alCrear', values: { tamano: '3,4 MB' } })
    expect(downloadSaid('alCrear', undefined)).toEqual({ key: 'enLinea.alCrearSinTamano' })
    expect(downloadSaid('bajar', '340 KB')).toEqual({ key: 'enLinea.bajar', values: { tamano: '340 KB' } })
    expect(downloadSaid('bajar', null)).toEqual({ key: 'enLinea.bajarSinTamano' })
  })

  it('every phrase it can choose is there in the three languages', () => {
    for (const key of ['enLinea.alCrear', 'enLinea.alCrearSinTamano', 'enLinea.bajar', 'enLinea.bajarSinTamano', 'enLinea.kb', 'enLinea.mb', 'enLinea.alDia', 'enLinea.alDiaUno'])
      for (const lang of Object.keys(texts)) expect(texts[lang][key], `${lang} ${key}`).toBeTruthy()
  })
})

describe('how far a download went', () => {
  it('goes by bytes, in whole percent', () => {
    expect(percentOf({ done: 1, total: 4, bytesDone: 455, bytesTotal: 1000 })).toBe(45)
    expect(percentOf({ done: 4, total: 4, bytesDone: 1000, bytesTotal: 1000 })).toBe(100)
  })

  it('goes by parts when the bytes are not known, and is 0 with nothing', () => {
    expect(percentOf({ done: 1, total: 4, bytesDone: 0, bytesTotal: 0 })).toBe(25)
    expect(percentOf({ done: 0, total: 0, bytesDone: 0, bytesTotal: 0 })).toBe(0)
  })
})

describe('what an update changed', () => {
  it('says nothing when no translated verse changed', () => {
    expect(doneSaid(0)).toBeNull()
  })

  it('says one verse and several verses each its way', () => {
    expect(doneSaid(1)).toEqual({ key: 'enLinea.alDiaUno' })
    expect(doneSaid(3)).toEqual({ key: 'enLinea.alDia', values: { n: 3 } })
  })
})
