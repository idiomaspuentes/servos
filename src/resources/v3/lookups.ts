/**
 * The cross-book lookups of format 3, shaped for the screens: how the bridge texts render a word of the original in
 * every book on the device (`renderings`), and which books use an article (`books`). Pure: the answers come in, what
 * the screens draw comes out.
 *
 * What is not on this device is never said as zero (FILOSOFIA_DE_DISENO: «no está en este aparato» is not «no
 * existe»): a book the map counts but the device lacks goes to `missing` when the language's catalog lists it (its
 * size is what downloading it brings, asked apart), and a book the source does not cover (`none`) is kept apart from
 * one where it is used zero times. Without the map that answers (`installed: false`), nobody looked: nothing is shown.
 */

import { BOOKS } from '@bt-synergy/language-pack-v3'
import type { BookModel, OrigModel } from '@bt-synergy/language-pack-v3'
import type { Answer, BooksData, RenderingsData } from '@bt-synergy/language-pack-client'
import type { ArticleRef } from '../articleLinks'

/** More places than this and the renderings show their counts only, until their places are asked for. */
export const MANY_PLACES = 300

export type Rendering = { text: string; count: number; refs: string[] }

/** A book on the device as the reader gives it: its bridge texts and the original they are aligned to. */
export type BookRead = { book: string; model: BookModel; orig: OrigModel }

export type WordAcrossBooks = {
  /** False when the Strong table (`xmap`) is not on the device: the section is not shown. */
  installed: boolean
  /** By bridge text (`res`, its key), how it renders the word, most used first; places in Bible order. */
  texts: { res: string; renderings: Rendering[] }[]
  /** How many times the word of the original is in the books on the device, and in how many of them. */
  total: number
  books: number
  /** More than `MANY_PLACES`: each rendering shows its count, its places only when opened. */
  folded: boolean
  /** Books where the word is that the language's catalog has and this device does not (bringing them is offered). */
  missing: string[]
  /** Books where the word is, of which the language has no bridge text to bring. */
  elsewhere: string[]
}

const bookIndex = (book: string): number => {
  const i = BOOKS.indexOf(book)
  return i < 0 ? BOOKS.length : i
}

/** `tit 2:11` as numbers, for sorting and for opening the verse. Null for anything else. */
export function parsePlace(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = /^([a-z0-9]{3})\s+(\d+):(\d+)/.exec(ref.trim())
  return m ? { book: m[1], chapter: Number(m[2]), verse: Number(m[3]) } : null
}

function byBibleOrder(a: string, b: string): number {
  const x = parsePlace(a)
  const y = parsePlace(b)
  if (!x || !y) return a < b ? -1 : a > b ? 1 : 0
  return bookIndex(x.book) - bookIndex(y.book) || x.chapter - y.chapter || x.verse - y.verse
}

/** A Strong as the tables key it: the part after a prefix (`c:H0853` is `H0853`). */
const strongKey = (published: string): string => published.slice(published.lastIndexOf(':') + 1)

/**
 * How each bridge text renders the words of the original keyed `key` (the key the `renderings` answer resolved), and
 * how many such words there are: the reader's `renderings` adds the texts together, so a word rendered by the literal
 * and the simple text would be counted twice. Walked as `renderings` walks them: by each text's alignment, words that
 * translate the same original word one after the other being one rendering. A book whose alignment points into
 * another original is left out, as the reader leaves it.
 */
export function renderingsByText(books: BookRead[], key: string): { texts: WordAcrossBooks['texts']; total: number; books: number } {
  const byText = new Map<string, Map<string, { count: number; refs: string[] }>>()
  let total = 0
  let withWord = 0
  for (const { book, model, orig } of books) {
    if (model.orig[1] !== orig.stamp) continue
    const positions = new Set<number>()
    orig.words.forEach((w, i) => strongKey(w.strong) === key && positions.add(i))
    if (positions.size === 0) continue
    total += positions.size
    withWord++
    for (const text of model.texts) {
      if (!text.align) continue
      const found = byText.get(text.res) ?? new Map<string, { count: number; refs: string[] }>()
      byText.set(text.res, found)
      let chapter = ''
      let verse = ''
      let ev = 0
      let ordinal = -1
      let run: { pos: number; words: string[]; ref: string } | undefined
      const flush = () => {
        if (!run) return
        const rendering = run.words.join(' ')
        const e = found.get(rendering) ?? { count: 0, refs: [] }
        e.count++
        if (!e.refs.includes(run.ref)) e.refs.push(run.ref)
        found.set(rendering, e)
        run = undefined
      }
      for (const [i, piece] of text.pieces.entries()) {
        while (ev < text.events.length && text.events[ev][0] <= i) {
          const [, kind, arg] = text.events[ev]
          if (kind === 'chapter') chapter = arg
          else if (kind === 'verse') verse = arg
          ev++
        }
        if (!piece[1]) continue
        ordinal++
        const hit = (text.align[ordinal] ?? []).find((p) => positions.has(p))
        if (hit === undefined) {
          flush()
          continue
        }
        if (run && run.pos === hit) run.words.push(piece[0])
        else {
          flush()
          run = { pos: hit, words: [piece[0]], ref: `${book} ${chapter}:${verse}` }
        }
      }
      flush()
    }
  }
  const texts = [...byText]
    .map(([res, found]) => ({
      res,
      renderings: [...found]
        .map(([text, v]) => ({ text, count: v.count, refs: [...v.refs].sort(byBibleOrder) }))
        .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)),
    }))
    .filter((t) => t.renderings.length > 0)
  return { texts, total, books: withWord }
}

/**
 * A `renderings` answer and the renderings by text (`renderingsByText`), as the word card's «En toda la Biblia» draws
 * them. `listed(book)`: whether the language's catalog has the book's bridge text, so it can be brought.
 */
export function wordAcrossBooks(answer: Answer<RenderingsData>, byText: ReturnType<typeof renderingsByText>, listed: (book: string) => boolean): WordAcrossBooks {
  // Without the Strong table the books not here cannot be told, and a short Greek key may miss its words.
  const installed = answer.data !== null && !answer.notInstalled.some((n) => n.unit === 'xmap')
  // The books the word is in that the device cannot read (its text, or the original it is aligned to, is not here).
  // A book whose positions point into another original (`stale`) is on the device: it is not offered again.
  const lacking = new Set<string>()
  for (const n of answer.notInstalled) {
    if (n.book && n.what !== 'stale' && (n.unit.startsWith('book:') || n.unit.startsWith('orig:'))) lacking.add(n.book)
  }
  const order = [...lacking].sort((a, b) => bookIndex(a) - bookIndex(b))
  return {
    installed,
    texts: byText.texts,
    total: byText.total,
    books: byText.books,
    folded: byText.total > MANY_PLACES,
    missing: order.filter(listed),
    elsewhere: order.filter((b) => !listed(b)),
  }
}

export type ArticleAcrossBooks = {
  /** False when the map that answers (`xmap` for `tw:`, `map` for `ta:`) is not on the device: nothing is shown. */
  installed: boolean
  /** Books on the device that use the article, with how many times. */
  here: { book: string; count: number }[]
  /**
   * Books that use it and are not on the device; `bringable` when the language's catalog lists the book (the answer
   * gives its size then), not when the language's packs do not carry it. What bringing it costs is asked apart.
   */
  missing: { book: string; count: number; bringable: boolean }[]
  /** Books the source does not cover: unknown, not zero. */
  none: string[]
  /** Whether the source covers any book (used there or not): when none, the helps do not tell where it is used. */
  covered: boolean
}

/** A `books` answer, as an article's «Dónde aparece» draws it. A book where it is used zero times is left out. */
export function articleAcrossBooks(answer: Answer<BooksData>): ArticleAcrossBooks {
  const out: ArticleAcrossBooks = { installed: false, here: [], missing: [], none: [], covered: false }
  if (!answer.data || answer.data.installed === false) return out
  out.installed = true
  const cells = Object.entries(answer.data.books).sort(([a], [b]) => bookIndex(a) - bookIndex(b))
  for (const [book, cell] of cells) {
    if (cell.state === 'none') {
      out.none.push(book)
      continue
    }
    out.covered = true
    // `zero` is the source saying the book does not use it; a counted cell with no count says nothing either.
    if ((cell.state !== 'count' && cell.state !== 'partial') || !cell.count) continue
    if (cell.installed) out.here.push({ book, count: cell.count })
    else out.missing.push({ book, count: cell.count, bringable: cell.bytes !== undefined })
  }
  return out
}

/** The id format 3 gives an article: `tw:kt/grace` for `bible/kt/grace`, `ta:translate/figs-metaphor`. */
export const articleIdV3 = (ref: ArticleRef): string => (ref.kind === 'tw' ? `tw:${ref.path.replace(/^bible\//, '')}` : `ta:${ref.path}`)

/** The map unit that answers where an article is used: the English word links for `tw:`, the language's notes for `ta:`. */
export const articleMapUnit = (ref: ArticleRef): 'xmap' | 'map' => (ref.kind === 'tw' ? 'xmap' : 'map')
