import { describe, expect, it } from 'vitest'
import type { Answer, BookCell, BooksData, NotInstalled, RenderingsData } from '@bt-synergy/language-pack-client'
import { articleAcrossBooks, articleIdV3, parsePlace, renderingsByText, wordAcrossBooks, type BookRead } from './lookups'

const envelope = <T>(query: Answer<T>['query'], data: T | null, notInstalled: NotInstalled[] = []): Answer<T> => ({
  query,
  data,
  cites: [],
  revision: { units: {} },
  notInstalled,
})

// χάρις in es-419 with Titus on the device, as staging answers it (trimmed): the reader adds both texts together.
const grace = (notInstalled: NotInstalled[] = []) =>
  envelope<RenderingsData>(
    'renderings',
    {
      strong: 'G54850',
      renderings: [
        { text: 'Gracia', count: 1, refs: ['tit 1:4'] },
        { text: 'siga demostrándote su favor', count: 1, refs: ['tit 1:4'] },
      ],
    },
    notInstalled,
  )

/** Titus 1:4 and 2:11 with χάρις (G54850) once each, in a literal text (`glt`) and a simple one (`gst`). */
function titus(stamp = 's1', graces = 2): BookRead {
  const words = [{ form: 'χάρις', lemma: 'χάρις', strong: 'G54850', morph: '' }, { form: 'καὶ', lemma: 'καί', strong: 'G25320', morph: '' }]
  const orig = { book: 'tit', key: 'el-x-koine/ugnt', stamp: 's1', words: Array.from({ length: graces }, () => words).flat(), pieces: [], events: [] }
  const glt = {
    res: 'es-419/glt',
    pieces: [['Gracia', true], [' y ', false], ['paz', true], [' ', false], ['gracia', true]] as [string, boolean][],
    events: [[0, 'chapter', '1'], [0, 'verse', '4'], [4, 'chapter', '2'], [4, 'verse', '11']] as [number, 'chapter' | 'verse', string][],
    align: [[0], [1], [2]],
  }
  const gst = {
    res: 'es-419/gst',
    pieces: [['siga', true], [' ', false], ['su', true], [' ', false], ['favor', true], [' ', false], ['regalo', true]] as [string, boolean][],
    events: [[0, 'chapter', '1'], [0, 'verse', '4'], [6, 'chapter', '2'], [6, 'verse', '11']] as [number, 'chapter' | 'verse', string][],
    align: [[0], [0], [0], [2]],
  }
  return { book: 'tit', model: { lang: 'es-419', book: 'tit', orig: ['el-x-koine/ugnt', stamp], res: [], texts: [glt, gst] }, orig }
}

const listed = (book: string) => ['rut', 'jon', 'tit', '3jn'].includes(book)

describe('wordAcrossBooks', () => {
  it('counts the word once, however many texts render it, and groups the renderings by text', () => {
    const w = wordAcrossBooks(grace(), renderingsByText([titus()], 'G54850'), listed)
    expect(w.total).toBe(2)
    expect(w.books).toBe(1)
    expect(w.texts).toEqual([
      {
        res: 'es-419/glt',
        renderings: [
          { text: 'Gracia', count: 1, refs: ['tit 1:4'] },
          { text: 'gracia', count: 1, refs: ['tit 2:11'] },
        ],
      },
      {
        res: 'es-419/gst',
        renderings: [
          { text: 'regalo', count: 1, refs: ['tit 2:11'] },
          { text: 'siga su favor', count: 1, refs: ['tit 1:4'] },
        ],
      },
    ])
  })

  it('missing books are those the language can bring', () => {
    const w = wordAcrossBooks(
      grace([
        { book: 'rut', unit: 'book:rut', bytes: 53497, what: 'G54850' },
        { book: 'rut', unit: 'orig:rut', bytes: 32340, what: 'G54850' },
        // Its text is installed, its original is not: bringing the book brings it.
        { book: '3jn', unit: 'orig:3jn', bytes: 9000, what: 'G54850' },
        // The language has no Luke: only its original is listed.
        { book: 'luk', unit: 'orig:luk', bytes: 270361, what: 'G54850' },
      ]),
      renderingsByText([titus()], 'G54850'),
      listed,
    )
    expect(w.installed).toBe(true)
    expect(w.missing).toEqual(['rut', '3jn'])
    expect(w.elsewhere).toEqual(['luk'])
  })

  it('a book whose original moved on is on the device, not offered again nor counted', () => {
    const w = wordAcrossBooks(grace([{ book: 'tit', unit: 'orig:tit', bytes: 9, what: 'stale' }]), renderingsByText([titus('s0')], 'G54850'), listed)
    expect(w.missing).toEqual([])
    expect(w.elsewhere).toEqual([])
    expect(w.total).toBe(0)
  })

  it('no map hides the section', () => {
    const byText = renderingsByText([titus()], 'G54850')
    expect(wordAcrossBooks(grace([{ unit: 'xmap', bytes: 0 }]), byText, listed).installed).toBe(false)
    expect(wordAcrossBooks(envelope<RenderingsData>('renderings', null), byText, listed).installed).toBe(false)
  })

  it('more than 300 places shows counts only', () => {
    // Counted as the original's words: two texts rendering 151 of them are 151 places, not 302.
    expect(wordAcrossBooks(grace(), renderingsByText([titus('s1', 151)], 'G54850'), listed).folded).toBe(false)
    expect(wordAcrossBooks(grace(), renderingsByText([titus('s1', 301)], 'G54850'), listed).folded).toBe(true)
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

  it('missing books say whether the language can bring them', () => {
    const a = articleAcrossBooks(metaphor)
    expect(a.here).toEqual([{ book: 'tit', count: 15 }])
    expect(a.missing).toEqual([
      { book: 'rut', count: 7, bringable: true },
      { book: 'mat', count: 2, bringable: false },
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
