import { describe, expect, it } from 'vitest'
import { cellOfOwn, cellOfText, shownAtStart, toggleShown, versesOf } from './parallel'

const order = ['TPL', 'TPS', 'Hebreo', 'suyo']

describe('texts side by side', () => {
  it('puts a text beside the others, in the order of the list, and takes it away again', () => {
    expect(toggleShown(['TPS'], 'TPL', order, 3)).toEqual(['TPL', 'TPS'])
    expect(toggleShown(['TPL', 'TPS'], 'TPL', order, 3)).toEqual(['TPS'])
  })

  it('always keeps one, and does nothing past the most that fit', () => {
    expect(toggleShown(['TPL'], 'TPL', order, 3)).toEqual(['TPL'])
    expect(toggleShown(['TPL', 'TPS'], 'Hebreo', order, 2)).toEqual(['TPL', 'TPS'])
    expect(toggleShown(['TPL', 'TPS'], 'Hebreo', order, 3)).toEqual(['TPL', 'TPS', 'Hebreo'])
  })

  it('opens with what was kept, the text being read among them', () => {
    expect(shownAtStart(['TPS', 'Hebreo'], order, 'TPS', 3)).toEqual(['TPS', 'Hebreo'])
    expect(shownAtStart(['TPS', 'Hebreo'], order, 'TPL', 2)).toEqual(['TPL', 'TPS'])
    expect(shownAtStart(null, order, 'TPS', 3)).toEqual(['TPS'])
    expect(shownAtStart(['otro'], order, undefined, 3)).toEqual(['TPL'])
    expect(shownAtStart('roto', [], undefined, 3)).toEqual([])
  })

  it('keeps no more than fit when the window narrows, the text read first', () => {
    expect(shownAtStart(['TPL', 'TPS', 'Hebreo'], order, 'Hebreo', 2)).toEqual(['TPL', 'Hebreo'])
    expect(shownAtStart(['TPL', 'TPS', 'Hebreo'], order, undefined, 2)).toEqual(['TPL', 'TPS'])
  })

  it('has a row for every verse any text has, in order', () => {
    expect(versesOf([[1, 2, 3], [2, 3, 4], [0]])).toEqual([1, 2, 3, 4])
  })

  it('says a verse missing in a text instead of leaving it out', () => {
    expect(cellOfText({ 1: ['a'], 3: ['c'] }, 2)).toEqual({ kind: 'missing' })
    expect(cellOfText({ 1: ['a'] }, 1)).toEqual({ kind: 'text' })
  })

  it('says where the team said a verse together with the one before', () => {
    const startOf = (v: number) => (v === 5 ? 4 : v)
    const textOf = (v: number) => ({ 3: '', 4: 'cuatro y cinco' })[v] ?? 'algo'
    expect(cellOfOwn(5, startOf, textOf)).toEqual({ kind: 'joined', from: 4 })
    expect(cellOfOwn(4, startOf, textOf)).toEqual({ kind: 'text' })
    expect(cellOfOwn(3, startOf, textOf)).toEqual({ kind: 'missing' })
  })
})
