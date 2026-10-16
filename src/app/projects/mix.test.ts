import { describe, expect, it } from 'vitest'
import { joinPieces, matchingPiece, namesTogether, piecesOf } from './mix'

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
