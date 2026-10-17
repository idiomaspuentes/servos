import { describe, expect, it } from 'vitest'
import { joinPieces, matchingPiece, namesTogether, piecesOf, splitPiece } from './mix'

describe('un versículo en trozos para tocar', () => {
  it('se corta después de sus signos, y las comillas que cierran van con su trozo', () => {
    expect(piecesOf('«Anda a Nínive, la gran ciudad, y grita contra ella, porque he visto su maldad».').map((p) => p.text)).toEqual([
      '«Anda a Nínive,',
      'la gran ciudad,',
      'y grita contra ella,',
      'porque he visto su maldad».',
    ])
  })

  it('un tramo largo sin signos se corta otra vez, en partes parejas de unas cuatro palabras', () => {
    expect(piecesOf('Taytaku Jonasman rimarqa hatun Ninive llaktaman riy nispa willarqa').map((p) => p.text)).toEqual([
      'Taytaku Jonasman rimarqa',
      'hatun Ninive llaktaman',
      'riy nispa willarqa',
    ])
  })

  it('los renglones de un poema se guardan: al juntar los trozos vuelven a ser renglones', () => {
    const poem = 'Desde mi angustia clamé al Señor,\ny él me respondió.'
    const pieces = piecesOf(poem)
    expect(pieces.map((p) => [p.text, Boolean(p.lineEnd)])).toEqual([
      ['Desde mi angustia clamé al Señor,', true],
      ['y él me respondió.', false],
    ])
    expect(joinPieces(pieces)).toBe(poem)
  })

  it('juntar los trozos de un versículo da el mismo versículo', () => {
    const verse = '«Levántate y ve a Nínive, esa gran ciudad, y anuncia contra ella que su maldad ha llegado hasta mí».'
    expect(joinPieces(piecesOf(verse))).toBe(verse)
  })
})

describe('partir un trozo con el dedo', () => {
  const pieces = piecesOf('«Levántate, ve a Nínive, la gran ciudad, y proclama contra ella, porque su maldad ha subido delante de mí».')
  const last = pieces.length - 1
  it('se parte en la palabra tocada, y el versículo sigue diciendo lo mismo', () => {
    // The automatic cut left «porque su maldad ha»: the person cuts «ha» off, where the meaning goes on.
    const cut = splitPiece(pieces, last - 1, 3)
    expect(cut.slice(-3).map((p) => p.text)).toEqual(['porque su maldad', 'ha', 'subido delante de mí».'])
    expect(joinPieces(cut)).toBe(joinPieces(pieces))
  })
  it('no se parte antes de la primera palabra ni después de la última', () => {
    expect(splitPiece(pieces, 0, 0)).toBe(pieces)
    expect(splitPiece(pieces, 0, 9)).toBe(pieces)
  })
  it('el final de un renglón de un poema queda después de la segunda parte', () => {
    const poem = piecesOf('Desde mi angustia clamé al Señor,\ny él me respondió.')
    const cut = splitPiece(poem, 0, 3)
    expect(cut.map((p) => [p.text, Boolean(p.lineEnd)])).toEqual([
      ['Desde mi angustia', false],
      ['clamé al Señor,', true],
      ['y él me respondió.', false],
    ])
  })
})

describe('la app propone el trozo que corresponde', () => {
  const carla = piecesOf('«Levántate, ve a Nínive, la gran ciudad, y proclama contra ella, porque su maldad ha subido delante de mí».')
  it('el que tiene más palabras en común, sin contar signos ni mayúsculas', () => {
    expect(carla[matchingPiece('y grita contra ella,', carla)].text).toBe('y proclama contra ella,')
    expect(carla[matchingPiece('porque he visto su maldad».', carla)].text).toBe('porque su maldad ha')
  })
  it('ninguno, si no comparten ni una palabra', () => {
    expect(matchingPiece('Taytaku rimarqa', carla)).toBe(-1)
  })
})

it('los nombres se dicen juntos como se habla', () => {
  expect([namesTogether(['Ana'], ' y '), namesTogether(['Ana', 'Dani'], ' y '), namesTogether(['Ana', 'Bea', 'Dani'], ' y ')]).toEqual([
    'Ana',
    'Ana y Dani',
    'Ana, Bea y Dani',
  ])
})
