import { describe, expect, it } from 'vitest'
import list from './door43-languages.json'
import { languagesFromDoor43, searchLanguages, writtenRightToLeft } from './languages'

const languages = languagesFromDoor43(list)

describe('elegir el idioma de un proyecto', () => {
  it('la lista que viene con la app trae los idiomas de Door43, cada uno una vez', () => {
    expect(languages.length).toBeGreaterThan(9000)
    expect(new Set(languages.map((l) => l.code)).size).toBe(languages.length)
  })

  it('se encuentra por el nombre, sin tildes, por otro de sus nombres o por el código', () => {
    expect(searchLanguages(languages, 'cusco').map((l) => l.code)).toContain('quz')
    expect(searchLanguages(languages, 'quz')[0].code).toBe('quz')
    expect(searchLanguages(languages, 'espanol').map((l) => l.code)).toContain('es')
    expect(searchLanguages(languages, 'Runasimi Qusqu').map((l) => l.code)).toContain('quz')
  })

  it('pocos resultados, y nada sin escribir', () => {
    expect(searchLanguages(languages, 'a').length).toBeLessThanOrEqual(8)
    expect(searchLanguages(languages, '  ')).toEqual([])
  })

  it('la dirección se propone por el idioma', () => {
    expect(writtenRightToLeft('ar')).toBe(true)
    expect(writtenRightToLeft('quz')).toBe(false)
  })
})
