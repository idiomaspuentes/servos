import { describe, expect, it } from 'vitest'
import { gatherInterface, interfacePackage, readInterfacePackage } from './interfacePackage'

describe('passing the app translated in a language to another phone', () => {
  it('reads back the package it writes', () => {
    const p = interfacePackage('qu', 'Kichwa', 'es', { 'marco.volver': 'Kutiy' })
    expect(readInterfacePackage(JSON.stringify(p))).toEqual(p)
  })

  it('refuses a text that is not a package', () => {
    expect(readInterfacePackage('{"format":"servos-compartir"}')).toBeNull()
    expect(readInterfacePackage('no es json')).toBeNull()
  })

  it('leaves out empty phrases', () => {
    const p = readInterfacePackage(JSON.stringify(interfacePackage('qu', '', 'es', { a: 'x', b: '  ' })))
    expect(p?.texts).toEqual({ a: 'x' })
    expect(p?.name).toBe('qu')
  })

  it('adds new phrases and keeps the ones this phone translated otherwise', () => {
    const { texts, added, kept } = gatherInterface({ a: 'mío', b: 'igual' }, { a: 'suyo', b: 'igual', c: 'nuevo' })
    expect(texts).toEqual({ a: 'mío', b: 'igual', c: 'nuevo' })
    expect(added).toBe(1)
    expect(kept).toBe(1)
  })
})
