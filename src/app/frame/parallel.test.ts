import { describe, expect, it } from 'vitest'
import { cellOfOwn, cellOfText, lineIn, rowsOf, shownAtStart, toggleShown, versesOf } from './parallel'

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

  it('where one fits, puts the touched one in its place and keeps it', () => {
    expect(toggleShown(['TPL'], 'TPS', order, 1)).toEqual(['TPS'])
    expect(toggleShown(['TPS'], 'TPS', order, 1)).toEqual(['TPS'])
    expect(shownAtStart(['TPS'], order, 'TPL', 1)).toEqual(['TPS'])
    expect(shownAtStart(['TPL', 'TPS'], order, 'TPS', 1)).toEqual(['TPS'])
    expect(shownAtStart(null, order, 'TPL', 1)).toEqual(['TPL'])
    // Room for two again: the one chosen beside the text read
    expect(shownAtStart(['TPS'], order, 'TPL', 2)).toEqual(['TPL', 'TPS'])
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

describe('rows with the box where the team writes', () => {
  // The team said 1 with 2, and 4 with 5.
  const unitOf = (v: number) => ({ 1: [1, 2], 2: [1, 2], 4: [4, 5], 5: [4, 5] })[v] ?? [v]

  it('gives verses said together one row, as they have one box', () => {
    expect(rowsOf([1, 2, 3, 4, 5], unitOf)).toEqual([[1, 2], [3], [4, 5]])
  })

  it('keeps a verse the texts lack in the row of the verses it is said with', () => {
    expect(rowsOf([1, 3, 4], unitOf)).toEqual([[1, 2], [3], [4, 5]])
  })

  it('finds the line being written among the verses of a row', () => {
    // Verse 2 has two lines, verse 3 three: the box of 2–3 has five.
    const count = (v: number) => ({ 2: 2, 3: 3 })[v] ?? 0
    expect(lineIn([2, 3], 0, count)).toEqual({ verse: 2, line: 0 })
    expect(lineIn([2, 3], 3, count)).toEqual({ verse: 3, line: 1 })
    // A text with fewer lines shows its last.
    expect(lineIn([2, 3], 7, count)).toEqual({ verse: 3, line: 2 })
    expect(lineIn([4], 2, () => 1)).toEqual({ verse: 4, line: 0 })
    expect(lineIn([4], 0, () => 0)).toBeNull()
  })
})
