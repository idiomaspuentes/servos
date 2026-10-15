import { describe, expect, it } from 'vitest'
import type { PrototypeData } from '../../prototype/data'
import { byWord, renderingOf, renderingsOf, wordChecksOf } from './wordChecks'

const word = (id: string, article: string) => ({ id, original: 'א', article, keyTerm: true, places: {} })
const chapter = (n: number, verses: Array<[number, ReturnType<typeof word>[]]>) =>
  ({ chapter: n, verses: verses.map(([verse, words]) => ({ verse, words, notes: [], questions: [] })) }) as unknown as PrototypeData

describe('revisar las palabras', () => {
  it('cada uso de una palabra, una vez, en el orden de los versículos; y palabra por palabra', () => {
    const items = wordChecksOf([
      chapter(1, [
        [1, [word('a', 'bible/kt/god'), word('b', 'bible/names/jonah')]],
        [2, [word('c', 'bible/kt/god'), word('a', 'bible/kt/god')]],
      ]),
      chapter(2, [[1, [word('d', 'bible/names/jonah')]]]),
    ])
    expect(items.map((i) => [i.id, i.chapter, i.verse, i.kind])).toEqual([
      ['a', 1, 1, 'kt'],
      ['b', 1, 1, 'names'],
      ['c', 1, 2, 'kt'],
      ['d', 2, 1, 'names'],
    ])
    expect(byWord(items).map((i) => i.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('lo marcado se lee en orden, sin la puntuación de los extremos, con «…» donde faltan palabras', () => {
    const words = ['Pablo,', 'Diospa', 'servidor,', '«Taytaku»', 'nin.']
    expect(renderingOf(words, [3])).toBe('Taytaku')
    expect(renderingOf(words, [2, 1])).toBe('Diospa servidor')
    expect(renderingOf(words, [0, 3])).toBe('Pablo … Taytaku')
  })

  it('las traducciones de una palabra, la más usada primero, sin distinguir mayúsculas', () => {
    const found = renderingsOf([
      { chapter: 1, verse: 1, text: 'Taytaku' },
      { chapter: 1, verse: 3, text: 'Dios' },
      { chapter: 2, verse: 2, text: 'taytaku' },
      { chapter: 2, verse: 4, text: '' },
    ])
    expect(found.map((r) => [r.text, r.places.map((p) => `${p.chapter}:${p.verse}`)])).toEqual([
      ['Taytaku', ['1:1', '2:2']],
      ['Dios', ['1:3']],
    ])
  })
})
