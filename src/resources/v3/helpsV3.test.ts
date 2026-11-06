import { describe, expect, it } from 'vitest'
import type { BookModel, HelpRow } from '@bt-synergy/language-pack-v3'
import type { PlacesFrame } from '../screenData'
import { chapterHelps, rcLinks, type ChapterHelpsInput } from './helpsV3'

const TIT_1_1 = 56001001

/** Titus 1:1 with two words of the literal text, «Dios … Dios», each aligned to its own Θεοῦ (original places 0 and 1). */
const input: ChapterHelpsInput = {
  book: 'tit',
  chapter: 1,
  verses: [1],
  frame: { original: 'Griego', toOriginal: { TPL: [[0], [1]] }, strongs: ['G23160', 'G23160'], originalsOfVerse: () => [0, 1] } satisfies PlacesFrame,
  texts: {
    TPL: [
      { word: 0, verse: 1, text: 'Dios', originals: [0] },
      { word: 1, verse: 1, text: 'Dios', originals: [1] },
    ],
  },
}

const row = (id: string, cols: HelpRow['cols'], extra: Partial<HelpRow> = {}): HelpRow => ({ id, ref: '1:1', from: TIT_1_1, to: TIT_1_1, cols, ...extra })
const book = (parts: Partial<BookModel>): BookModel => ({ lang: 'es-419', book: 'tit', orig: ['unfoldingWord/el-x-koine/ugnt', 'v0.34'], res: [], texts: [], ...parts })
const link = (id: string, quote: number[]) => row(id, { origWords: 'Θεοῦ', articlePath: 'bible/kt/god', tags: 'keyterm' }, { concept: 'tw:kt/god', quote })

describe('the helps of a chapter from format 3', () => {
  it('a link repeated in a verse takes the k-th place', () => {
    // Two links of the same article that name both words (a quote that does not tell its occurrence): one each, in order.
    const both = chapterHelps(book({ links: { res: 'twl', rows: [link('a', [0, 1]), link('b', [0, 1])] } }), input)
    expect(both.verses[0].words.map((w) => w.places)).toEqual([
      { TPL: [0], Griego: [0] },
      { TPL: [1], Griego: [1] },
    ])
    // With their own quotes, each stands on its own word.
    const own = chapterHelps(book({ links: { res: 'twl', rows: [link('a', [1]), link('b', [0])] } }), input)
    expect(own.verses[0].words.map((w) => w.places.TPL)).toEqual([[1], [0]])
    expect(own.articles.tw).toEqual(['bible/kt/god'])
  })

  it('a note with no quote has no places', () => {
    const helps = chapterHelps(
      book({ notes: { res: 'tn', rows: [row('n1', { quote: '', occurrence: '0', note: 'Ver [[ta:translate/figs-metaphor]].', isIntro: false }, { concept: 'ta:translate/figs-metaphor', quote: [] })] } }),
      input
    )
    expect(helps.verses[0].notes).toEqual([
      { id: 'n1', quote: '', glt: null, gst: null, note: 'Ver [[rc://*/ta/man/translate/figs-metaphor]].', academy: 'translate/figs-metaphor', places: { TPL: [], Griego: [] } },
    ])
    expect(helps.articles.ta).toEqual(['translate/figs-metaphor'])
  })

  it('a note stands on the words aligned to its quote, joined with «…» where others lie between', () => {
    const three: ChapterHelpsInput = {
      ...input,
      frame: { ...input.frame, toOriginal: { TPL: [[0], [5], [1]] } },
      texts: { TPL: [{ word: 0, verse: 1, text: 'de', originals: [0] }, { word: 1, verse: 1, text: 'la', originals: [5] }, { word: 2, verse: 1, text: 'fe', originals: [1] }] },
    }
    const helps = chapterHelps(book({ notes: { res: 'tn', rows: [row('n2', { quote: 'κατὰ πίστιν', occurrence: '1', note: '' }, { quote: [0, 1] })] } }), three)
    expect(helps.verses[0].notes[0]).toMatchObject({ glt: 'de … fe', places: { TPL: [0, 2], Griego: [0, 1] } })
  })

  it('takes the introductions from the notes marked so: in chapter 1 the book’s, then the chapter’s', () => {
    const intro = (id: string, note: string) => row(id, { note, isIntro: true, quote: '', occurrence: '0' }, { quote: [] })
    const helps = chapterHelps(book({ notes: { res: 'tn', rows: [intro('i1', '# Introducción a Tito\n(Ver: [[tw:kt/grace]])'), intro('i2', '# Tito 1')] } }), input)
    expect(helps.intros).toEqual({ book: '# Introducción a Tito\n(Ver: [[rc://*/tw/dict/bible/kt/grace]])', chapter: '# Tito 1' })
    expect(helps.verses[0].notes).toEqual([])
    expect(helps.articles.tw).toEqual(['bible/kt/grace'])
  })

  it('writes the ids of articles back as rc links, and leaves other links as they are', () => {
    expect(rcLinks('[[tw:kt/grace]] [[ta:translate/figs-you]] [texto](ref:tit 2:3)')).toBe(
      '[[rc://*/tw/dict/bible/kt/grace]] [[rc://*/ta/man/translate/figs-you]] [texto](ref:tit 2:3)'
    )
  })
})
