import { describe, expect, it } from 'vitest'
import { inSight, keepPlace, litOf, pagedHelps, revealBelow, shortGloss } from './wordCard'

const help = (kind: string, places: Record<string, number[]> = {}) => ({ kind, places })

describe("the card of a touched word", () => {
  it('pages only through the readings, the notes and the words with an article', () => {
    const helps = [help('lectura'), help('glosario'), help('puente'), help('nota'), help('palabra'), help('lexico')]
    expect(pagedHelps(helps).map((h) => h.kind)).toEqual(['lectura', 'nota', 'palabra'])
  })

  it('lights the words of the help being read', () => {
    const helps = [help('puente', { TPS: [7] }), help('nota', { TPL: [2, 3, 4] }), help('palabra', { TPL: [3] })]
    expect([...litOf(helps, 0, { abbreviation: 'TPL', place: 3 }, 'TPL')]).toEqual([2, 3, 4])
    expect([...litOf(helps, 1, { abbreviation: 'TPL', place: 3 }, 'TPL')]).toEqual([3])
  })

  it('with nothing to page through, lights the touched word and the words aligned to it', () => {
    const helps = [help('puente', { TPS: [7, 8], TPL: [3] }), help('lexico', { UHB: [1], TPL: [3] })]
    expect([...litOf(helps, 0, { abbreviation: 'TPL', place: 3 }, 'TPL')]).toEqual([3])
    expect([...litOf(helps, 0, { abbreviation: 'TPL', place: 3 }, 'TPS')]).toEqual([7, 8])
    expect([...litOf(helps, 0, { abbreviation: 'TPL', place: 3 }, 'UHB')]).toEqual([1])
    expect([...litOf([], 0, { abbreviation: 'TPL', place: 3 }, 'TPL')]).toEqual([3])
  })

  it('says a word of the original by its first glosses here, else by the brief', () => {
    expect(shortGloss({ glosses: ['decir', 'hablar', 'contar', 'mandar'] }, 'decir')).toBe('decir, hablar, contar')
    expect(shortGloss({ glosses: [] }, 'YHVH')).toBe('YHVH')
    expect(shortGloss(undefined, 'YHVH')).toBe('YHVH')
  })
})

describe('the pane around the card', () => {
  it('keeps a word where it stood on screen when what is above it changes', () => {
    // A card of 300 px above the word went away: the word came up 300 px, the pane goes up as much.
    expect(keepPlace(500, 310, 10)).toBe(200)
    // Nothing above changed: nothing moves.
    expect(keepPlace(120, 40, 40)).toBe(120)
  })

  it('brings the start of a card into sight without moving the word out of it', () => {
    // It fits: nothing moves.
    expect(revealBelow({ paneTop: 100, paneBottom: 700, wordTop: 300, until: 650 })).toBe(0)
    // It does not: up just enough.
    expect(revealBelow({ paneTop: 100, paneBottom: 700, wordTop: 300, until: 760 })).toBe(68)
    // Far too tall (a keyboard up): only until the word is at the top, still in sight.
    expect(revealBelow({ paneTop: 100, paneBottom: 400, wordTop: 300, until: 1200 })).toBe(192)
    // A word already at the top: nothing moves.
    expect(revealBelow({ paneTop: 100, paneBottom: 400, wordTop: 105, until: 1200 })).toBe(0)
  })

  it('tells a word in sight from one scrolled away', () => {
    expect(inSight({ top: 90, bottom: 110 }, { top: 100, bottom: 700 })).toBe(true)
    expect(inSight({ top: 60, bottom: 90 }, { top: 100, bottom: 700 })).toBe(false)
  })
})
