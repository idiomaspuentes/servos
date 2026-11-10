import { describe, expect, it } from 'vitest'
import type { Answer, BookCell, BooksData, NotInstalled, RenderingsData } from '@bt-synergy/language-pack-client'
import { articleAcrossBooks, articleIdV3, parsePlace, wordAcrossBooks } from './lookups'

const envelope = <T>(query: Answer<T>['query'], data: T | null, notInstalled: NotInstalled[] = []): Answer<T> => ({
  query,
  data,
  cites: [],
  revision: { units: {} },
  notInstalled,
})

// χάρις in es-419 with Titus on the device, as staging answers it (trimmed).
const grace = (notInstalled: NotInstalled[] = []) =>
  envelope<RenderingsData>(
    'renderings',
    {
      strong: 'G54850',
      renderings: [
        { text: 'gracia', count: 3, refs: ['tit 3:15', 'tit 2:11', 'tit 3:7'] },
        { text: 'Gracia', count: 1, refs: ['tit 1:4'] },
      ],
    },
    notInstalled,
  )

describe('wordAcrossBooks', () => {
  it('missing books carry their bytes', () => {
    const w = wordAcrossBooks(
      grace([
        { book: 'rut', unit: 'book:rut', bytes: 53497, what: 'G54850' },
        { book: 'rut', unit: 'orig:rut', bytes: 32340, what: 'G54850' },
        { book: 'jon', unit: 'book:jon', bytes: 37703, what: 'G54850' },
        // The language has no Luke: only its original is listed.
        { book: 'luk', unit: 'orig:luk', bytes: 270361, what: 'G54850' },
      ]),
    )
    expect(w.installed).toBe(true)
    // What bringing the book fetches: its text and the original it is aligned to.
    expect(w.missing).toEqual([
      { book: 'rut', bytes: 53497 + 32340 },
      { book: 'jon', bytes: 37703 },
    ])
    expect(w.elsewhere).toEqual(['luk'])
  })

  it('orders the places in the Bible and counts the books on the device', () => {
    const w = wordAcrossBooks(grace())
    expect(w.renderings[0]).toEqual({ text: 'gracia', count: 3, refs: ['tit 2:11', 'tit 3:7', 'tit 3:15'] })
    expect(w.total).toBe(4)
    expect(w.books).toBe(1)
    expect(w.folded).toBe(false)
  })

  it('a book whose original moved on is on the device, not offered again', () => {
    const w = wordAcrossBooks(grace([{ book: 'tit', unit: 'orig:tit', bytes: 9, what: 'stale' }]))
    expect(w.missing).toEqual([])
    expect(w.elsewhere).toEqual([])
  })

  it('no map hides the section', () => {
    expect(wordAcrossBooks(grace([{ unit: 'xmap', bytes: 0 }])).installed).toBe(false)
    expect(wordAcrossBooks(envelope<RenderingsData>('renderings', null)).installed).toBe(false)
  })

  it('more than 300 places shows counts only', () => {
    const many = (n: number) =>
      envelope<RenderingsData>('renderings', { strong: 'G35880', renderings: [{ text: 'el', count: n, refs: ['tit 1:1'] }] })
    expect(wordAcrossBooks(many(301)).folded).toBe(true)
    expect(wordAcrossBooks(many(300)).folded).toBe(false)
  })
})

const cell = (c: Partial<BookCell> & Pick<BookCell, 'state'>): BookCell => ({ installed: false, ...c })

describe('articleAcrossBooks', () => {
  // ta:translate/figs-metaphor in es-419 with Titus on the device, as staging answers it.
  const metaphor = envelope<BooksData>('books', {
    books: {
      gen: cell({ state: 'none' }),
      rut: cell({ state: 'count', count: 7, verses: 7, bytes: 53497 }),
      jon: cell({ state: 'zero', count: 0, verses: 0, bytes: 37703 }),
      tit: cell({ state: 'count', count: 15, verses: 15, installed: true }),
      mat: cell({ state: 'count', count: 2, verses: 2 }),
    },
  })

  it('missing books carry their bytes', () => {
    const a = articleAcrossBooks(metaphor)
    expect(a.here).toEqual([{ book: 'tit', count: 15 }])
    expect(a.missing).toEqual([
      { book: 'rut', count: 7, bytes: 53497 },
      { book: 'mat', count: 2 },
    ])
  })

  it('none is not zero', () => {
    const a = articleAcrossBooks(metaphor)
    expect(a.none).toEqual(['gen'])
    expect(a.covered).toBe(true)
    // Used zero times is not listed anywhere, and nothing is ever said with a count of 0.
    expect([...a.here, ...a.missing].map((b) => b.book)).not.toContain('jon')
    expect([...a.here, ...a.missing].every((b) => b.count > 0)).toBe(true)
  })

  it('no map hides the section', () => {
    const a = articleAcrossBooks(envelope<BooksData>('books', { installed: false, books: {} }, [{ unit: 'map', bytes: 0 }]))
    expect(a).toEqual({ installed: false, here: [], missing: [], none: [], covered: false })
  })
})

describe('the ids and places', () => {
  it('names articles as format 3 does', () => {
    expect(articleIdV3({ kind: 'tw', path: 'bible/kt/grace' })).toBe('tw:kt/grace')
    expect(articleIdV3({ kind: 'ta', path: 'translate/figs-metaphor' })).toBe('ta:translate/figs-metaphor')
  })

  it('reads a place', () => {
    expect(parsePlace('tit 2:11')).toEqual({ book: 'tit', chapter: 2, verse: 11 })
    expect(parsePlace('tit')).toBeNull()
  })
})
