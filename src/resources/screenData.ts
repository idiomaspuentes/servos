/**
 * A chapter of a book, as the screens read it (`PrototypeData`), from the resources a language pack left on this
 * device: the bridge texts with their words and places, the original, the notes, questions and word links of each
 * verse with the places they stand in each text, and the articles they point to.
 *
 * Only a bridge text (the literal one) and the original are needed; everything else is read when it is there and left
 * out when it is not, so a language whose team has published only its literal text still opens (the screens say what
 * is missing). The prototype's Titus and Jonah were written from the same function (`makeData.test.ts`).
 */

import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { unwrapVersioned } from '@bt-synergy/resource-pipeline/cache/versionedEnvelope'
import type { Places, PrototypeData, PrototypeText } from '../prototype/data'
import {
  alignedPlaces,
  booksOfText,
  introsOf,
  notesOfVerse,
  originalWordsOf,
  readChapter,
  readChapterWords,
  referenceCovers,
  type ChapterPiece,
  type ChapterWords,
} from './reading'
import type { ResourceStores } from './store'

/** The original a book is translated from, as the screens name it. */
export interface Original {
  key: string
  abbreviation: string
  dir: 'ltr' | 'rtl'
  lang: string
}

export const GREEK: Original = { key: 'unfoldingWord/el-x-koine/ugnt', abbreviation: 'Griego', dir: 'ltr', lang: 'grc' }
export const HEBREW: Original = { key: 'unfoldingWord/hbo/uhb', abbreviation: 'Hebreo', dir: 'rtl', lang: 'hbo' }

/** The resources a book is read from: their keys on this device (`owner/language/resource`). */
export interface BookSources {
  /** The pack's language (`es-419`) and the owner of its resources (`es-419_gl/es-419`), said in each chapter. */
  language: string
  owner: string
  /** The literal bridge text (TPL): needed. */
  literal: string
  /** The simple one (TPS), notes, questions, word links and the articles: when the language has them here. */
  simple?: string
  notes?: string
  questions?: string
  wordLinks?: string
  words?: string
  academy?: string
  original: Original
  /** Beside tc-study's: the lexicon of the book's original, in the language (its Strong numbers' entries), and what MACULA says of it. */
  lexicon?: string
  macula?: string
}

/** Where each section begins in a chapter, when a table says so (else the literal text's paragraphs are the sections). */
export type SectionStarts = number[]

/** The chapter's sections: from where each begins, or else one for each paragraph of the literal text. */
export function sectionsOf(verses: number[], starts: SectionStarts | undefined, pieces: ChapterPiece[]): number[][] {
  if (starts?.length) {
    const sections = starts.map((start, i) => verses.filter((v) => v >= start && v < (starts[i + 1] ?? Infinity))).filter((s) => s.length)
    const covered = new Set(sections.flat())
    // Verses before the first start (a table made for another versification) go with the first section.
    const before = verses.filter((v) => !covered.has(v))
    if (before.length && sections.length) sections[0] = [...before, ...sections[0]].sort((a, b) => a - b)
    return sections.length ? sections : [verses]
  }
  const fromParagraphs = pieces.flatMap((p) => (p.kind === 'paragraph' && p.verses.length ? [[...new Set(p.verses.map((v) => v.verse))]] : []))
  const seen = new Set<number>()
  const sections = fromParagraphs.map((s) => s.filter((v) => !seen.has(v) && seen.add(v))).filter((s) => s.length)
  return sections.length ? sections : [verses]
}

export async function chapterData(
  stores: ResourceStores,
  sources: BookSources,
  bookId: string,
  chapter: number,
  options: { sections?: SectionStarts; today?: string } = {}
): Promise<PrototypeData> {
  const { literal, simple, original } = sources
  const raw = async <T,>(key: string, version: number) => unwrapVersioned<T>(await stores.cache.get(key), version)
  const title = async (key: string) => String((await stores.catalog.get(key))?.title ?? key)

  const book = (await booksOfText(stores, literal)).find((b) => b.book === bookId)
  if (!book) throw new Error(`${literal} no tiene ${bookId} en este aparato`)
  const glt = await readChapter(stores, literal, bookId, chapter)
  if (!glt) throw new Error(`${literal} no tiene ${bookId} ${chapter} en este aparato`)
  const gst = simple ? await readChapter(stores, simple, bookId, chapter) : null
  const verses = glt.flatMap((p) => (p.kind === 'paragraph' ? p.verses.map((v) => v.verse) : []))

  type Q = { id: string; reference: string; question: string; response: string }
  type L = { id: string; reference: string; origWords: string; articlePath: string; tags: string }
  const questions = sources.questions ? ((await raw<{ questions: Q[] }>(`prepared:questions:${sources.questions}:${bookId}:${chapter}:light`, 1))?.questions ?? []) : []
  const links = sources.wordLinks ? ((await raw<{ links: L[] }>(`prepared:words-links:${sources.wordLinks}:${bookId}:${chapter}:light`, 1))?.links ?? []) : []

  // Where each note and word link stands in each text: aligned places in TPL and TPS, and the original's words those
  // places translate (a touched Hebrew word finds its notes through them).
  const literalWords = await readChapterWords(stores, literal, bookId, chapter)
  const originalOwn = await readChapterWords(stores, original.key, bookId, chapter)
  if (!literalWords || !originalOwn) throw new Error(`Faltan las palabras de ${bookId} ${chapter} en este aparato`)
  const simpleWords = gst && simple ? await readChapterWords(stores, simple, bookId, chapter) : null
  const words3: Record<string, ChapterWords> = { TPL: literalWords, [original.abbreviation]: originalOwn }
  if (simpleWords) words3.TPS = simpleWords
  const alignedIn = async (helps: string | undefined, text: string | undefined) =>
    helps && text ? await alignedPlaces(stores, helps, text, bookId, chapter) : {}
  const aligned = {
    tn: { TPL: await alignedIn(sources.notes, literal), TPS: await alignedIn(sources.notes, simpleWords ? simple : undefined) },
    twl: { TPL: await alignedIn(sources.wordLinks, literal), TPS: await alignedIn(sources.wordLinks, simpleWords ? simple : undefined) },
  }
  const originalPlace = new Map(originalOwn.words.map((w, i) => [w.own, i]))
  const originalWords = (await originalWordsOf(stores, original.key, bookId, chapter)) ?? []
  const originalsOfVerse = (verse: number) =>
    (originalOwn.lines[verse] ?? []).flatMap((l) => l.pieces.map((p) => p.word).filter((w): w is number => w !== undefined))
  const toOriginal = (abbr: 'TPL' | 'TPS') =>
    words3[abbr].words.map((w) => w.originals.map((key) => originalPlace.get(key)).filter((p): p is number => p !== undefined))
  const placesOf = (helps: 'tn' | 'twl', id: string): Places => {
    const tpl = aligned[helps].TPL[id] ?? []
    const tps = aligned[helps].TPS[id] ?? []
    const originals = new Set<number>()
    for (const [abbr, places] of [['TPL', tpl], ['TPS', tps]] as const) {
      for (const at of places) for (const key of words3[abbr]?.words[at]?.originals ?? []) {
        const place = originalPlace.get(key)
        if (place !== undefined) originals.add(place)
      }
    }
    return { TPL: tpl, ...(simpleWords ? { TPS: tps } : {}), [original.abbreviation]: [...originals].sort((a, b) => a - b) }
  }
  /**
   * The places of one of several links of the same words in a verse. The cached alignment of a word link does not know
   * which occurrence it is, so links of the same words (יְהוָה twice in Jonah 1:3, three times in 1:14) come with the
   * places of all of them; the k-th link takes the k-th of them in reading order. Where a text's places do not part
   * evenly, its share is found through the original words the TPL's share translates.
   */
  const nthPlaces = (places: Places, nth: number, of: number, verse: number): Places => {
    const share = (list: number[] | undefined) => {
      const sorted = [...(list ?? [])].sort((x, y) => x - y)
      if (!sorted.length || sorted.length % of !== 0) return null
      const size = sorted.length / of
      return sorted.slice(nth * size, (nth + 1) * size)
    }
    const tpl = share(places.TPL)
    if (!tpl) return places
    const originals = new Set<number>()
    for (const at of tpl) for (const key of words3.TPL.words[at]?.originals ?? []) {
      const place = originalPlace.get(key)
      if (place !== undefined) originals.add(place)
    }
    const own = share(places[original.abbreviation])
    // The original's share, when the TPL's leads to one word that all of them lead to (the alignment knows one): the
    // k-th word of the verse with its Strong number, if there are as many as links.
    if (originals.size === 1) {
      const strong = originalWords[[...originals][0]]?.strong
      const same = originalsOfVerse(verse).filter((p) => strong && originalWords[p]?.strong === strong)
      if (same.length === of) {
        originals.clear()
        originals.add(same[nth])
      }
    }
    const originalShare = originals.size ? [...originals].sort((x, y) => x - y) : (own ?? places[original.abbreviation] ?? [])
    if (!simpleWords) return { TPL: tpl, [original.abbreviation]: originalShare }
    const tpsThrough = (places.TPS ?? []).filter((at) => (simpleWords.words[at]?.originals ?? []).some((key) => originals.has(originalPlace.get(key) ?? -1)))
    const tps = share(places.TPS) ?? (tpsThrough.length ? tpsThrough : (places.TPS ?? []))
    return { TPL: tpl, TPS: tps, [original.abbreviation]: originalShare }
  }

  const words: PrototypeData['words'] = {}
  const twStamp = sources.words ? resourceContentStamp(await stores.catalog.get(sources.words)) : null
  for (const link of links) {
    if (words[link.articlePath]) continue
    const entry = link.articlePath.replace(/^bible\//, '')
    const titleRow = sources.words ? await stores.cache.get(`helps-text:tw-title:${sources.words}@${twStamp}:${entry}`) : null
    const article = sources.words ? await stores.cache.get(`${sources.words}/${link.articlePath}`) : null
    words[link.articlePath] = {
      title: unwrapVersioned<string>(titleRow, 1) ?? entry.split('/').pop()!,
      markdown: typeof article === 'string' ? article : '',
    }
  }

  const byVerse: PrototypeData['verses'] = []
  const academy: PrototypeData['academy'] = {}
  for (const verse of verses) {
    const inGlt = sources.notes ? await notesOfVerse(stores, { notesKey: sources.notes, textKey: literal, book: bookId, chapter, verse }) : []
    const inGst = sources.notes && simpleWords && simple ? await notesOfVerse(stores, { notesKey: sources.notes, textKey: simple, book: bookId, chapter, verse }) : []
    for (const n of inGlt) {
      const path = n.supportReference.split('/ta/man/')[1]
      if (!path || academy[path]) continue
      const article = sources.academy ? await stores.cache.get(`${sources.academy}/${path}`) : null
      const markdown = typeof article === 'string' ? article : ''
      academy[path] = { title: markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path, markdown }
    }
    byVerse.push({
      verse,
      notes: inGlt.map((n) => ({
        id: n.id,
        quote: n.quote,
        glt: n.textQuote,
        gst: inGst.find((g) => g.id === n.id)?.textQuote ?? null,
        note: n.note,
        academy: n.supportReference.split('/ta/man/')[1] ?? null,
        places: placesOf('tn', n.id),
      })),
      questions: questions.filter((q) => referenceCovers(q.reference, chapter, verse)).map((q) => ({ id: q.id, question: q.question, response: q.response })),
      words: links
        .filter((l) => referenceCovers(l.reference, chapter, verse))
        .map((l, _, here) => {
          const places = placesOf('twl', l.id)
          // Links to the same article given the same places are one link per occurrence, in order (see `nthPlaces`); not
          // by their words, which differ in their accents (יְהוָ֔ה, יְהוָ֑ה).
          const twins = here.filter((o) => o.articlePath === l.articlePath && JSON.stringify(placesOf('twl', o.id)) === JSON.stringify(places))
          return {
            id: l.id,
            original: l.origWords,
            article: l.articlePath,
            keyTerm: l.tags.includes('keyterm'),
            places: twins.length > 1 ? nthPlaces(places, twins.indexOf(l), twins.length, verse) : places,
          }
        }),
    })
  }

  const intros = sources.notes ? await introsOf(stores, sources.notes, bookId, chapter) : { book: null, chapter: null }
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const texts: PrototypeText[] = [{ key: literal, abbreviation: 'TPL', title: await title(literal), pieces: glt, lines: literalWords.lines, toOriginal: toOriginal('TPL') }]
  if (gst && simple && simpleWords) texts.push({ key: simple, abbreviation: 'TPS', title: await title(simple), pieces: gst, lines: simpleWords.lines, toOriginal: toOriginal('TPS') })
  texts.push({
    key: original.key,
    abbreviation: original.abbreviation,
    title: await title(original.key),
    pieces: (await readChapter(stores, original.key, bookId, chapter))!,
    lines: originalOwn.lines,
    words: originalWords.length ? originalWords : undefined,
    original: true,
    dir: original.dir,
    lang: original.lang,
  })

  return {
    ...(intros.chapter ? { intro: intros.chapter } : {}),
    ...(intros.book ? { bookIntro: intros.book } : {}),
    source: `Recursos de ${sources.owner} y originales de unfoldingWord en Door43 (CC BY-SA 4.0), sacados de los paquetes de idioma el ${today}.`,
    language: sources.language,
    book: { id: bookId, name: book.name, chapters: book.chapters.length },
    chapter,
    texts,
    sections: sectionsOf(verses, options.sections, glt),
    verses: byVerse,
    words,
    academy,
  }
}
