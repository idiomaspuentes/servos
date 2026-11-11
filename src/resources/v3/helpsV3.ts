/**
 * The notes, questions, word links and introductions of a chapter read from a format 3 book (`BookModel`), as
 * `chapterData` gives them from the rows of format 2.0 (`screenData.ts`).
 *
 * Format 2.0 kept, for each help and each bridge text, the words of the text it stands on ("helps-align"). Format 3
 * keeps the original words a help quotes (`quote`, positions in the original book) and the original words each word of
 * a text translates (`align`), so the words a help stands on are those aligned to its quote: the same rule tc-study's
 * alignment of helps follows (`findAlignedTokens`), with positions where it had ids. The rest is today's code
 * (`placesThrough`, `linkPlaces`, `textQuoteOf`, `introsOfNotes`).
 *
 * Format 3 writes the links of a text as ids (`[[ta:translate/figs-metaphor]]`, ids.md) and undoes the TSV escapes; the
 * screens read `rc:` links, so the ids are written back as `rc://*` links (`rcLinks`).
 */

import type { BookModel, HelpRow } from '@bt-synergy/language-pack-v3'
import type { PackReader } from '@bt-synergy/language-pack-client'
import type { PrototypeData } from '../../prototype/data'
import { articleOf, rcLinksIn } from '../articleLinks'
import { introsOfNotes, referenceCovers, referenceSpan, spanCovers, textQuoteOf, type ChapterIntros, type VerseHelps } from '../reading'
import { linkPlaces, placesThrough, type PlacesFrame } from '../screenData'
import { textChapters, type ChapterText } from './bookV3'

/** `[[ta:…]]` and `[[tw:…]]` as the `rc:` links the screens read (`articleOf`). */
export function rcLinks(md: string): string {
  return md.replace(/\[\[(ta|tw):([^\]\s]+)\]\]/g, (_, kind: string, path: string) =>
    kind === 'ta' ? `[[rc://*/ta/man/${path}]]` : `[[rc://*/tw/dict/bible/${path}]]`
  )
}

const chapterOfId = (id: number) => Math.floor((id % 1_000_000) / 1_000)
const text = (row: HelpRow, column: string) => String(row.cols[column] ?? '')

/** A note's quote, as the notes give it: none when its occurrence is 0 (old notes put a heading there). */
const quoteOf = (row: HelpRow) => (text(row, 'occurrence').trim() === '0' ? '' : text(row, 'quote'))

/**
 * The places of a text's words aligned to a help's quote, in the text's order (none without a quote). `byOriginal` is
 * the text's words by the original positions they translate (`placesByOriginal`), so a help costs its quote, not the
 * chapter: walking every word of a chapter for every help, and again for every verse a help covers, made Psalms take
 * seconds.
 */
function wordsOn(byOriginal: Map<number, number[]>, quote: number[] | undefined, fold: (p: number) => number): number[] {
  const found = new Set<number>()
  for (const p of quote ?? []) if (p >= 0) for (const at of byOriginal.get(fold(p)) ?? []) found.add(at)
  return [...found].sort((a, b) => a - b)
}

/**
 * A text's words by the original positions they translate: a position, the places of its words in the text's order. A
 * qere's position is folded into its ketiv's (`fold`), as the screens place it (`readBookV3`).
 */
function placesByOriginal(words: ChapterText['words'], fold: (p: number) => number): Map<number, number[]> {
  const out = new Map<number, number[]>()
  words.forEach((w, at) => {
    for (const original of w.originals) {
      const p = fold(original)
      const list = out.get(p)
      if (!list) out.set(p, [at])
      else if (list[list.length - 1] !== at) list.push(at)
    }
  })
  return out
}

/** The words of a text a help stands on, as format 2.0 joined them (`textQuoteOf`), or null. */
const quoteIn = (words: ChapterText['words'], places: number[]) => textQuoteOf({ p: places, m: places.length ? 1 : 0, t: places.map((at) => words[at].text) })

export interface ChapterHelpsInput {
  book: string
  chapter: number
  /** The chapter's verses, as the literal text has them. */
  verses: number[]
  frame: PlacesFrame
  /** The words of each bridge text of the chapter (`TPS` when the chapter has the simple one). */
  texts: { TPL: ChapterText['words']; TPS?: ChapterText['words'] }
  /**
   * The chapter's qere positions → their ketiv's (`qereOf`). A Hebrew word read otherwise than written has both in the
   * original; a quote or a bridge word may name either, so both are taken as the ketiv before they are matched.
   */
  qere?: ReadonlyMap<number, number>
}

/** The notes, questions and word links of one chapter, in the order of their tables. */
export type ChapterRows = { notes: HelpRow[]; questions: HelpRow[]; links: HelpRow[] }

/**
 * A book's helps by chapter, bucketed once. What stands before chapter 1 (`front:intro`, and a row whose reference names
 * no verse, which format 3 places at the book's introduction, chapter 0) goes with chapter 1, first: it is the book's
 * introduction, which the screens keep with the first chapter.
 */
export function helpsByChapter(model: BookModel): (chapter: number) => ChapterRows {
  const by = new Map<number, ChapterRows>()
  for (const kind of ['notes', 'questions', 'links'] as const)
    for (const row of model[kind]?.rows ?? []) {
      const chapter = Math.max(1, chapterOfId(row.from))
      let rows = by.get(chapter)
      if (!rows) by.set(chapter, (rows = { notes: [], questions: [], links: [] }))
      rows[kind].push(row)
    }
  // Chapter 0's rows were pushed in table order with chapter 1's; the book's introduction comes before chapter 1's own.
  const first = by.get(1)
  if (first) first.notes.sort((a, b) => Number(chapterOfId(a.from) !== 0) - Number(chapterOfId(b.from) !== 0))
  return (chapter) => by.get(chapter) ?? { notes: [], questions: [], links: [] }
}

/** An introduction: marked so (format 2.0 rewrote its reference to the first verse), or at a verse 0 (`front:intro`, `1:intro`). */
const isIntro = (row: HelpRow) => row.cols.isIntro === true || row.from % 1_000 === 0

/** The helps of a chapter: each verse's, its introductions, and the articles they point to (word paths, academy paths). */
export function chapterHelps(rows: ChapterRows, input: ChapterHelpsInput): { verses: PrototypeData['verses']; intros: ChapterIntros; articles: { tw: string[]; ta: string[] } } {
  const { chapter, frame, texts } = input
  const { notes, questions, links } = rows
  const fold = (p: number) => input.qere?.get(p) ?? p
  const tplByOriginal = placesByOriginal(texts.TPL, fold)
  const tpsByOriginal = texts.TPS ? placesByOriginal(texts.TPS, fold) : null
  // A row that covers several verses is placed once; each verse gets its own copy of the places.
  const placed = new Map<HelpRow, { tpl: number[]; tps: number[] }>()
  const placesOf = (row: HelpRow) => {
    let at = placed.get(row)
    if (!at) placed.set(row, (at = { tpl: wordsOn(tplByOriginal, row.quote, fold), tps: tpsByOriginal ? wordsOn(tpsByOriginal, row.quote, fold) : [] }))
    const tpl = [...at.tpl]
    const tps = [...at.tps]
    return { tpl, tps, places: placesThrough(frame, tpl, tps) }
  }
  // Each row's reference read once, not once a verse (`referenceCovers` reads it each time).
  const spans = new Map<HelpRow, ReturnType<typeof referenceSpan>>()
  const spanOf = (row: HelpRow) => {
    if (!spans.has(row)) spans.set(row, referenceSpan(row.ref))
    return spans.get(row)!
  }
  const articleOfLink = (row: HelpRow) => text(row, 'articlePath') || (row.concept?.startsWith('tw:') ? `bible/${row.concept.slice(3)}` : '')
  const tw: string[] = []
  const ta: string[] = []
  const keep = (list: string[], path: string) => path && !list.includes(path) && list.push(path)
  for (const link of links) keep(tw, articleOfLink(link))

  const verses: PrototypeData['verses'] = input.verses.map((verse) => {
    const covers = (r: HelpRow) => spanCovers(spanOf(r), chapter, verse)
    const here = links.filter(covers)
    const linked = linkPlaces(frame, here.map((l) => ({ article: articleOfLink(l), places: placesOf(l).places })), verse)
    return {
      verse,
      notes: notes
        .filter((n) => !isIntro(n) && covers(n))
        .map((n) => {
          const { tpl, tps, places } = placesOf(n)
          const academy = n.concept?.startsWith('ta:') ? n.concept.slice(3) : null
          if (academy) keep(ta, academy)
          return {
            id: n.id,
            quote: quoteOf(n),
            glt: quoteIn(texts.TPL, tpl),
            gst: texts.TPS ? quoteIn(texts.TPS, tps) : null,
            note: rcLinks(text(n, 'note')),
            academy,
            places,
          }
        }),
      questions: questions.filter(covers).map((q) => ({ id: q.id, question: text(q, 'question'), response: text(q, 'response') })),
      words: here.map((l, i) => ({ id: l.id, original: text(l, 'origWords'), article: articleOfLink(l), keyTerm: text(l, 'tags').includes('keyterm'), places: linked[i] })),
    }
  })

  const intros = introsOfNotes(notes.map((n) => ({ isIntro: isIntro(n), note: rcLinks(text(n, 'note')) })), chapter)
  // The articles the introductions point to («(Ver: [[rc://…/tw/dict/bible/kt/grace]], …)»).
  for (const rc of rcLinksIn(`${intros.book ?? ''}\n${intros.chapter ?? ''}`)) {
    const ref = articleOf(rc)
    if (ref) keep(ref.kind === 'tw' ? tw : ta, ref.path)
  }
  return { verses, intros, articles: { tw, ta } }
}

/** The helps of these verses of a book as format 3 has them here (`readVerseHelps`): its notes and its bridge texts. */
export async function verseHelpsV3(
  reader: PackReader,
  _language: string,
  book: string,
  places: ReadonlyArray<{ chapter: number; verse: number }>
): Promise<VerseHelps[]> {
  const model = reader.installed(`book:${book}`) ? await reader.book(book) : undefined
  const byId = (pattern: RegExp) => model?.texts.find((t) => pattern.test(t.res.split('/').pop() ?? ''))
  const read = [byId(/lt$/), byId(/st$/)].map((t) => (t ? textChapters(t) : null))
  const chapters = new Map<string, ChapterText | null>()
  const lineOf = (which: 0 | 1, chapter: number, verse: number) => {
    const at = `${which}:${chapter}`
    if (!chapters.has(at)) chapters.set(at, read[which]?.read(chapter) ?? null)
    return (chapters.get(at)?.verseLines[verse] ?? []).map((l) => l.text).join(' ')
  }
  return places.map(({ chapter, verse }) => ({
    chapter,
    verse,
    notes: (model?.notes?.rows ?? [])
      .filter((n) => chapterOfId(n.from) === chapter && !isIntro(n) && referenceCovers(n.ref, chapter, verse))
      .map((n) => ({ id: n.id, quote: quoteOf(n), note: rcLinks(text(n, 'note')) })),
    literal: lineOf(0, chapter, verse),
    simple: lineOf(1, chapter, verse),
  }))
}
