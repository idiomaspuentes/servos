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
import { introsOfNotes, referenceCovers, textQuoteOf, type ChapterIntros, type VerseHelps } from '../reading'
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

/** The places of a text's words aligned to a help's quote, in the text's order (none without a quote). */
function wordsOn(words: ChapterText['words'], quote: number[] | undefined): number[] {
  const wanted = new Set((quote ?? []).filter((p) => p >= 0))
  if (!wanted.size) return []
  return words.flatMap((w, at) => (w.originals.some((p) => wanted.has(p)) ? [at] : []))
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
}

/** The helps of a chapter: each verse's, its introductions, and the articles they point to (word paths, academy paths). */
export function chapterHelps(model: BookModel, input: ChapterHelpsInput): { verses: PrototypeData['verses']; intros: ChapterIntros; articles: { tw: string[]; ta: string[] } } {
  const { chapter, frame, texts } = input
  const ofChapter = (rows: HelpRow[] | undefined) => (rows ?? []).filter((r) => chapterOfId(r.from) === chapter)
  const notes = ofChapter(model.notes?.rows)
  const questions = ofChapter(model.questions?.rows)
  const links = ofChapter(model.links?.rows)
  const placesOf = (row: HelpRow) => {
    const tpl = wordsOn(texts.TPL, row.quote)
    const tps = texts.TPS ? wordsOn(texts.TPS, row.quote) : []
    return { tpl, tps, places: placesThrough(frame, tpl, tps) }
  }
  const articleOfLink = (row: HelpRow) => text(row, 'articlePath') || (row.concept?.startsWith('tw:') ? `bible/${row.concept.slice(3)}` : '')
  const tw: string[] = []
  const ta: string[] = []
  const keep = (list: string[], path: string) => path && !list.includes(path) && list.push(path)
  for (const link of links) keep(tw, articleOfLink(link))

  const verses: PrototypeData['verses'] = input.verses.map((verse) => {
    const covers = (r: HelpRow) => referenceCovers(r.ref, chapter, verse)
    const here = links.filter(covers)
    const linked = linkPlaces(frame, here.map((l) => ({ article: articleOfLink(l), places: placesOf(l).places })), verse)
    return {
      verse,
      notes: notes
        .filter((n) => n.cols.isIntro !== true && covers(n))
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

  const intros = introsOfNotes(notes.map((n) => ({ isIntro: n.cols.isIntro === true, note: rcLinks(text(n, 'note')) })), chapter)
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
      .filter((n) => chapterOfId(n.from) === chapter && n.cols.isIntro !== true && referenceCovers(n.ref, chapter, verse))
      .map((n) => ({ id: n.id, quote: quoteOf(n), note: rcLinks(text(n, 'note')) })),
    literal: lineOf(0, chapter, verse),
    simple: lineOf(1, chapter, verse),
  }))
}
