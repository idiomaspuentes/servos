/**
 * The cross-book lookups of format 3, shaped for the screens: how the bridge texts render a word of the original in
 * every book on the device (`renderings`), and which books use an article (`books`). Pure: the answers come in, what
 * the screens draw comes out.
 *
 * What is not on this device is never said as zero (FILOSOFIA_DE_DISENO: «no está en este aparato» is not «no
 * existe»): a book the map counts but the device lacks goes to `missing`, with its size when the language's catalog
 * lists it, and a book the source does not cover (`none`) is kept apart from one where it is used zero times. Without
 * the map that answers (`installed: false`), nobody looked: the screens show nothing.
 */

import { BOOKS } from '@bt-synergy/language-pack-v3'
import type { Answer, BooksData, RenderingsData } from '@bt-synergy/language-pack-client'
import type { ArticleRef } from '../articleLinks'

/** More places than this and the renderings show their counts only, until their places are asked for. */
export const MANY_PLACES = 300

export type Rendering = { text: string; count: number; refs: string[] }

export type WordAcrossBooks = {
  /** False when the Strong table (`xmap`) is not on the device: the section is not shown. */
  installed: boolean
  /** How the bridge texts on the device render the word, most used first; places in Bible order. */
  renderings: Rendering[]
  /** Every place counted, and in how many books on the device. */
  total: number
  books: number
  /** More than `MANY_PLACES`: each rendering shows its count, its places only when opened. */
  folded: boolean
  /** Books where the word is, whose bridge text the language has but this device does not: what bringing it costs. */
  missing: { book: string; bytes: number }[]
  /** Books where the word is, whose bridge text the language's packs do not carry (only the original is listed). */
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

/** A `renderings` answer, as the word card's «En toda la Biblia» draws it. */
export function wordAcrossBooks(answer: Answer<RenderingsData>): WordAcrossBooks {
  // Without the Strong table the books not here cannot be told, and a short Greek key may miss its words.
  const installed = answer.data !== null && !answer.notInstalled.some((n) => n.unit === 'xmap')
  const renderings = (answer.data?.renderings ?? [])
    .filter((r) => r.count > 0)
    .map((r) => ({ text: r.text, count: r.count, refs: [...r.refs].sort(byBibleOrder) }))
  const total = renderings.reduce((n, r) => n + r.count, 0)
  const books = new Set(renderings.flatMap((r) => r.refs.map((ref) => parsePlace(ref)?.book ?? '')).filter(Boolean)).size

  // By book: the bridge text (`book:`) and the original it is aligned to (`orig:`) that the device lacks. A book whose
  // positions point into another original (`stale`) is on the device: it is not offered again.
  const lacking = new Map<string, { text: boolean; bytes: number }>()
  for (const n of answer.notInstalled) {
    if (!n.book || n.what === 'stale' || (!n.unit.startsWith('book:') && !n.unit.startsWith('orig:'))) continue
    const entry = lacking.get(n.book) ?? { text: false, bytes: 0 }
    if (n.unit.startsWith('book:')) entry.text = true
    entry.bytes += n.bytes
    lacking.set(n.book, entry)
  }
  const order = [...lacking.keys()].sort((a, b) => bookIndex(a) - bookIndex(b))
  return {
    installed,
    renderings,
    total,
    books,
    folded: total > MANY_PLACES,
    missing: order.filter((b) => lacking.get(b)!.text).map((book) => ({ book, bytes: lacking.get(book)!.bytes })),
    elsewhere: order.filter((b) => !lacking.get(b)!.text),
  }
}

export type ArticleAcrossBooks = {
  /** False when the map that answers (`xmap` for `tw:`, `map` for `ta:`) is not on the device: nothing is shown. */
  installed: boolean
  /** Books on the device that use the article, with how many times. */
  here: { book: string; count: number }[]
  /**
   * Books that use it and are not on the device; `bytes` when the language's catalog lists the book (it can be
   * brought), none when the language's packs do not carry it.
   */
  missing: { book: string; count: number; bytes?: number }[]
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
    else out.missing.push({ book, count: cell.count, ...(cell.bytes !== undefined ? { bytes: cell.bytes } : {}) })
  }
  return out
}

/** The id format 3 gives an article: `tw:kt/grace` for `bible/kt/grace`, `ta:translate/figs-metaphor`. */
export const articleIdV3 = (ref: ArticleRef): string => (ref.kind === 'tw' ? `tw:${ref.path.replace(/^bible\//, '')}` : `ta:${ref.path}`)

/** The map unit that answers where an article is used: the English word links for `tw:`, the language's notes for `ta:`. */
export const articleMapUnit = (ref: ArticleRef): 'xmap' | 'map' => (ref.kind === 'tw' ? 'xmap' : 'map')
