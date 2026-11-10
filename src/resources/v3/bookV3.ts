/**
 * A book read from a format 3 pack (`PackReader`), in the shape the screens read (`PrototypeData`): what `chapterData`
 * gives from the rows of format 2.0 (`screenData.ts`), so a book is the same book on screen whichever format brought it
 * (`sameBook.test.ts` compares the two from the same pack).
 *
 * The texts are walked the way tc-study's layout walks a chapter's USJ (`usj-processor`, `usjLayout.ts`) into the blocks
 * of its prepared chapters, and those blocks are read with the functions that read the prepared chapters today
 * (`piecesOfLight`, `versesInLines`, `wordsInLines`): headings, paragraphs, lines and the numbering of the words come
 * out the same by construction. The words' alignment is format 3's (`align`: positions in the original book), turned
 * into places among the chapter's words of the original.
 */

import type { BookModel, Event, OrigModel, Piece } from '@bt-synergy/language-pack-v3'
import type { PackReader } from '@bt-synergy/language-pack-client'
import type { FullBlock, FullInline, LightBlock, LightInline } from '@bt-synergy/resource-pipeline/scripture/scripturePreparer'
import type { LexiconFile } from '../../lexicon/lexicon'
import type { PrototypeData, PrototypeText } from '../../prototype/data'
import type { ReferentFile } from '../../original/referents'
import type { TreeFile } from '../../original/syntaxTree'
import { piecesOfLight, versesInLines, wordsInLines, type ChapterPiece, type VerseLine, type WordLine } from '../reading'
import { sectionsOf, type BookSources, type PlacesFrame, type SectionStarts } from '../screenData'
import { originalOf } from '../sources'
import { articlesV3, lexiconV3, maculaV3 } from './companionsV3'
import { chapterHelps, helpsByChapter } from './helpsV3'

// The texts as tc-study's layout reads them

/** A word of a text: its number among the text's word pieces (`align` is by it; in the original it is its position). */
type Word = { word: number; text: string }
/** A node of the document a chapter's events open and close, as USJ has it (`type:marker`). */
type Node = { type: string; marker: string; number?: string; content: Array<Node | Word | string> }

const isWord = (n: Node | Word | string): n is Word => typeof n === 'object' && 'word' in n

const PARAGRAPH = new Set('p q q1 q2 q3 q4 qa qr qc qm qm1 qm2 qm3 qd b m mi pi pi1 pi2 li li1 li2 li3 nb pc pr cls pmo pm pmc pmr po'.split(' '))
const HEADING = new Set('s s1 s2 s3 s4 r ms ms1 mr d sp sr'.split(' '))
const INTRO_HEADING = new Set('mt mt1 mt2 mt3 mt4 mte mte1 imt imt1 imt2 is is1 is2 iot io io1 io2 ip ipi im imi ipq imq ipr iex'.split(' '))
const NOTE = new Set(['f', 'fe', 'ef'])
const XREF = new Set(['x', 'ex'])
const NOTE_ORIGIN = new Set(['fr', 'xo'])
const SKIP = new Set(['id', 'h', 'toc1', 'toc2', 'toc3', 'ide', 'sts', 'rem', 'usfm'])

const deepText = (n: Node | Word | string): string => (typeof n === 'string' ? n : isWord(n) ? n.text : n.content.map(deepText).join(''))

/** The document of one chapter: its events from its `chapter` event to the next one's, with its pieces. */
function chapterTree(pieces: Piece[], events: Event[], ordinals: number[], at: { e0: number; e1: number; p0: number; p1: number }): Node {
  const root: Node = { type: 'root', marker: '', content: [] }
  const stack = [root]
  let e = at.e0
  const apply = (upTo: number) => {
    for (; e < at.e1 && events[e][0] <= upTo; e++) {
      const [, kind, arg] = events[e]
      const top = stack[stack.length - 1]
      if (kind === 'close') {
        if (stack.length > 1) stack.pop()
      } else if (kind === 'open') {
        const colon = arg.indexOf(':')
        const node: Node = { type: colon < 0 ? arg : arg.slice(0, colon), marker: colon < 0 ? '' : arg.slice(colon + 1), content: [] }
        top.content.push(node)
        stack.push(node)
      } else top.content.push({ type: kind, marker: '', number: arg, content: [] })
    }
  }
  for (let p = at.p0; p < at.p1; p++) {
    apply(p)
    const [text, word] = pieces[p]
    if (word) stack[stack.length - 1].content.push({ word: ordinals[p], text })
    else if (text) stack[stack.length - 1].content.push(text)
  }
  apply(Infinity)
  return root
}

type Inline =
  | { kind: 'verse'; verse: number }
  | { kind: 'token'; word: number; text: string; verse: number }
  | { kind: 'text' | 'heading' | 'note' | 'xref'; text: string }
type Seg = Inline | { kind: 'break'; marker: string }

/** A note's text, without what names its origin (`\fr`), spaces collapsed. */
const noteText = (note: Node) =>
  note.content
    .filter((c) => typeof c === 'string' || isWord(c) || !NOTE_ORIGIN.has(c.marker))
    .map(deepText)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

/** `collectFlatSegments` of tc-study's layout, on one chapter: its words are tokens, notes their text. */
function segments(nodes: Node['content'], ctx: { verse: number }, out: Seg[]): void {
  for (const n of nodes) {
    if (typeof n === 'string') {
      if (n) out.push({ kind: 'text', text: n })
    } else if (isWord(n)) {
      out.push({ kind: 'token', word: n.word, text: n.text, verse: ctx.verse > 0 ? ctx.verse : 1 })
    } else if (n.type === 'chapter') {
      ctx.verse = 0
    } else if (n.type === 'verse') {
      const verse = parseInt(n.number ?? '', 10)
      if (Number.isFinite(verse)) {
        ctx.verse = verse
        out.push({ kind: 'verse', verse })
      }
    } else if (SKIP.has(n.marker)) {
      continue
    } else if (n.type === 'note' || NOTE.has(n.marker) || XREF.has(n.marker)) {
      const text = noteText(n)
      if (text) out.push({ kind: XREF.has(n.marker) ? 'xref' : 'note', text })
    } else if (n.type === 'char' && (n.marker === 'xt' || n.marker === 'xts')) {
      const text = deepText(n).replace(/\s+/g, ' ').trim()
      if (text) out.push({ kind: 'xref', text })
    } else if (HEADING.has(n.marker) || INTRO_HEADING.has(n.marker)) {
      out.push({ kind: 'break', marker: n.marker || 's' })
      const inside: Seg[] = []
      segments(n.content, ctx, inside)
      for (const s of inside) {
        if (s.kind === 'text') {
          if (s.text.trim()) out.push({ kind: 'heading', text: s.text })
        } else if (s.kind !== 'break') out.push(s)
      }
    } else if (PARAGRAPH.has(n.marker) || n.type === 'para') {
      out.push({ kind: 'break', marker: n.marker || 'p' })
      segments(n.content, ctx, out)
    } else segments(n.content, ctx, out)
  }
}

type Block = { marker: string; verseNumbers: number[]; inline: Inline[] }

/** `groupSegments` of tc-study's layout: a block a paragraph or heading, a blank gap before anything in it left out. */
function blocksOf(segs: Seg[]): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null
  const flush = () => {
    if (current && (current.inline.length || current.marker === 'b')) blocks.push(current)
    current = null
  }
  for (const s of segs) {
    if (s.kind === 'break') {
      flush()
      current = { marker: s.marker, verseNumbers: [], inline: [] }
      continue
    }
    const block: Block = (current ??= { marker: 'p', verseNumbers: [], inline: [] })
    const verse = s.kind === 'verse' || s.kind === 'token' ? s.verse : null
    if (verse !== null && !block.verseNumbers.includes(verse)) block.verseNumbers.push(verse)
    if (s.kind === 'text' && !s.text.trim() && !block.inline.length) continue
    block.inline.push(s)
  }
  flush()
  return blocks
}

/** tc-study's rule for a space before a word (`shouldInsertSpaceBeforeInline`). */
const spaceBefore = (prev: Inline | undefined) => (!prev ? false : prev.kind === 'text' || prev.kind === 'heading' ? !/\s$/.test(prev.text) : true)

const role = (marker: string) => (marker === 'b' ? 'break' : HEADING.has(marker) ? 'heading' : INTRO_HEADING.has(marker) ? 'intro' : 'para')

/** A chapter of a text, read as the prepared chapters are read: pieces, lines of words, the words with what they translate. */
export interface ChapterText {
  pieces: ChapterPiece[]
  /** Each verse in its lines of text (`readChapterLines`). */
  verseLines: Record<number, VerseLine[]>
  lines: Record<number, WordLine[]>
  /** The chapter's words, by place: the word's number in the text, its verse, and the original positions it translates. */
  words: Array<{ word: number; verse: number; text: string; originals: number[] }>
  /** The notes the text gives after a word, by the word's place. */
  notes?: Record<number, string>
  tree: Node
}

/** The chapters of a text (a bridge text or the original), each read when asked. */
export function textChapters(text: { pieces: Piece[]; events: Event[]; align?: number[][] }): { numbers: number[]; read(chapter: number): ChapterText | null } {
  const ordinals: number[] = []
  let count = 0
  for (const [, word] of text.pieces) ordinals.push(word ? count++ : -1)
  const starts = text.events.flatMap(([position, kind, arg], e) => (kind === 'chapter' ? [{ number: parseInt(arg, 10), e, p: position }] : []))
  return {
    numbers: starts.map((s) => s.number).filter((n) => Number.isFinite(n) && n > 0),
    read(chapter) {
      const i = starts.findIndex((s) => s.number === chapter)
      if (i < 0) return null
      const next = starts[i + 1]
      const tree = chapterTree(text.pieces, text.events, ordinals, { e0: starts[i].e, e1: next?.e ?? text.events.length, p0: starts[i].p, p1: next?.p ?? text.pieces.length })
      const segs: Seg[] = []
      segments(tree.content, { verse: 0 }, segs)
      const blocks = blocksOf(segs)
      const head = (b: Block) => ({ marker: b.marker, role: role(b.marker), indentLevel: 0, chapterNumber: chapter, verseNumbers: b.verseNumbers })
      const light: LightBlock[] = blocks.map((b) => {
        const inline: LightInline[] = []
        b.inline.forEach((item, at) => {
          const piece: LightInline =
            item.kind === 'token' ? { kind: 'text', text: spaceBefore(b.inline[at - 1]) ? ` ${item.text}` : item.text }
            : item.kind === 'verse' ? { kind: 'verse', chapterNumber: chapter, verseNumber: item.verse }
            : item.kind === 'note' || item.kind === 'xref' ? { kind: item.kind, caller: '', text: item.text }
            : { kind: item.kind, text: item.text }
          const last = inline[inline.length - 1]
          if (piece.kind === 'text' && last?.kind === 'text') last.text += piece.text
          else inline.push(piece)
        })
        return { ...head(b), inline }
      })
      // The full tier's words: their own key is their number, what they translate the original positions (`o{n}`).
      const matchKeys: string[] = []
      const keyOf = new Map<string, number>()
      const key = (k: string) => keyOf.get(k) ?? (keyOf.set(k, matchKeys.push(k) - 1), matchKeys.length - 1)
      const full: FullBlock[] = blocks.map((b) => ({
        ...head(b),
        inline: b.inline.map((item): FullInline => {
          if (item.kind !== 'token') return item.kind === 'verse' ? { kind: 'verse', chapterNumber: chapter, verseNumber: item.verse } : item.kind === 'note' || item.kind === 'xref' ? { kind: item.kind, caller: '', text: item.text } : { kind: item.kind, text: item.text }
          const aligned = [...new Set(text.align?.[item.word] ?? [])]
          return { kind: 'token', token: { c: item.text, o: 0, k: key(`w${item.word}`), ...(aligned.length ? { a: aligned.map((p) => key(`o${p}`)) } : {}) } }
        }),
      }))
      const read = wordsInLines({ version: 0, unit: chapter, matchKeys, blocks: full })
      const texts = new Map(blocks.flatMap((b) => b.inline.flatMap((i) => (i.kind === 'token' ? [[i.word, i.text] as const] : []))))
      return {
        pieces: piecesOfLight(light),
        verseLines: versesInLines(light),
        lines: read.lines,
        words: read.words.map((w) => {
          const word = Number(w.own.slice(1))
          return { word, verse: w.verse, text: texts.get(word) ?? '', originals: w.originals.map((k) => Number(k.slice(1))) }
        }),
        ...(read.notes ? { notes: read.notes } : {}),
        tree,
      }
    },
  }
}

// The original

/** A ketiv's qere stands in the footnote after it (`\f + \ft Q \+w …\+w*\f*`): each qere word's position → the ketiv's. */
export function qereOf(tree: Node): Map<number, number> {
  const found = new Map<number, number>()
  const walk = (nodes: Node['content']) => {
    let ketiv: number | undefined
    for (const n of nodes) {
      if (typeof n === 'string') {
        if (/[\p{L}\p{N}]/u.test(n)) ketiv = undefined
      } else if (isWord(n)) ketiv = n.word
      else if (n.type === 'note') {
        if (ketiv !== undefined && n.marker === 'f')
          for (const ft of n.content)
            if (typeof ft === 'object' && !isWord(ft) && ft.type === 'char' && ft.marker === 'ft' && /^\s*Q(\s|$)/.test(String(ft.content.find((c) => typeof c === 'string') ?? '')))
              for (const w of ft.content) if (isWord(w)) found.set(w.word, ketiv)
        ketiv = undefined
      } else {
        ketiv = undefined
        walk(n.content)
      }
    }
  }
  walk(tree.content)
  return found
}

/** The lemma and Strong number of each word of the chapter outside notes, and the words of notes (`originalWordsOf`). */
export function originalWordsIn(tree: Node, orig: OrigModel, count: number): { words: NonNullable<PrototypeText['words']>; inNotes: Record<number, number[]> } | null {
  const words: NonNullable<PrototypeText['words']> = []
  const inNotes: Record<number, number[]> = {}
  let verse = 0
  let counted = 0
  const walk = (n: Node | Word | string, inNote: boolean) => {
    if (typeof n === 'string') return
    if (isWord(n)) {
      counted++
      const w = orig.words[n.word]
      if (inNote) (inNotes[verse] ??= []).push(counted)
      else words.push({ lemma: w?.lemma ?? '', strong: w?.strong ?? '', morph: w?.morph ?? '' })
      return
    }
    if (n.type === 'verse') {
      verse = Number(n.number) || verse
      counted = 0
    }
    for (const c of n.content) walk(c, inNote || n.type === 'note')
  }
  walk(tree, false)
  return words.length === count ? { words, inNotes } : null
}

// The book

/** The book's name as its text gives it: `\toc2`, else `\h` (`bookNameInText`). */
function bookName(text: { pieces: Piece[]; events: Event[] }, book: string): string {
  const of = (marker: string) => {
    const at = text.events.findIndex(([, kind, arg]) => kind === 'open' && arg === `para:${marker}`)
    return at < 0 ? '' : text.pieces.slice(text.events[at][0], text.events[at + 1]?.[0] ?? text.pieces.length).map((p) => p[0]).join('').trim()
  }
  return of('toc2') || of('h') || book.toUpperCase()
}

const resourceId = (key: string) => key.split('/').pop() ?? ''

/** The resources of a book model, as `chapterData` names them (literal and simple texts by their ids, `…lt` and `…st`). */
function sourcesOf(model: BookModel, language: string, orig: OrigModel | undefined): BookSources | null {
  const literal = model.texts.find((t) => /lt$/.test(resourceId(t.res)))
  if (!literal) return null
  const simple = model.texts.find((t) => /st$/.test(resourceId(t.res)))
  return {
    language,
    owner: literal.res.split('/').slice(0, -1).join('/'),
    literal: literal.res,
    ...(simple ? { simple: simple.res } : {}),
    ...(model.notes ? { notes: model.notes.res } : {}),
    ...(model.questions ? { questions: model.questions.res } : {}),
    ...(model.links ? { wordLinks: model.links.res } : {}),
    original: { ...originalOf(model.book), ...(orig ? { key: orig.key } : {}) },
  }
}

/** The resource keys a language's book is read from in format 3 (its texts and helps); null when the book is not installed. */
export async function sourcesV3(reader: PackReader, language: string, book: string): Promise<BookSources | null> {
  const model = reader.installed(`book:${book}`) ? await reader.book(book) : undefined
  return model ? sourcesOf(model, language, reader.installed(`orig:${book}`) ? await reader.orig(book) : undefined) : null
}

export interface ReadBookOptions {
  sections?: (chapter: number) => SectionStarts | undefined
  /** A resource's title (the catalog's); the reader does not give titles, so without it a text is titled by its key. */
  titles?: (key: string) => string | undefined
  /** The day the chapters say they were read (`YYYY-MM-DD`), for tests. */
  today?: string
  /** Told after each chapter is read (chapters read, of how many), as `loadBook` tells the screens today. */
  onChapter?: (done: number, total: number) => void
  /** What gives the screen a turn between chapters (a timer by default); the timings screen wraps it to count the wait. */
  yield?: () => Promise<void>
}

/**
 * A book of a language read from format 3: its chapters as the screens read them, the lexicon entries of its original's
 * words and what MACULA says of it. Null when `book:<book>` is not installed.
 */
export async function readBookV3(
  reader: PackReader,
  language: string,
  book: string,
  o: ReadBookOptions = {}
): Promise<{ chapters: PrototypeData[]; lexicon: Record<string, LexiconFile>; macula: { trees: TreeFile | null; referents: ReferentFile | null } } | null> {
  const model = reader.installed(`book:${book}`) ? await reader.book(book) : undefined
  if (!model) return null
  const orig = reader.installed(`orig:${book}`) ? await reader.orig(book) : undefined
  const sources = sourcesOf(model, language, orig)
  if (!sources) throw new Error(`${language} no tiene texto literal de ${book} en este aparato`)
  if (!orig) throw new Error(`Faltan las palabras del original de ${book} en este aparato`)
  // Positions mean something only with the original book they were counted in (ids.md): with another, no alignment.
  const sameOriginal = model.orig[0] === orig.key && model.orig[1] === orig.stamp
  const textOf = (key: string | undefined) => {
    const t = model.texts.find((x) => x.res === key)
    return t ? textChapters(sameOriginal ? t : { ...t, align: undefined }) : null
  }
  const literal = textOf(sources.literal)!
  const simple = textOf(sources.simple)
  const original = textChapters(orig)
  const abbr = sources.original.abbreviation
  const title = (key: string) => o.titles?.(key) ?? key
  const today = o.today ?? new Date().toISOString().slice(0, 10)
  const name = bookName(model.texts.find((t) => t.res === sources.literal)!, book)
  const quotes = sameOriginal ? model : { ...model, notes: model.notes && { ...model.notes, rows: model.notes.rows.map((r) => ({ ...r, quote: [] })) }, links: model.links && { ...model.links, rows: model.links.rows.map((r) => ({ ...r, quote: [] })) } }

  const chapters: PrototypeData[] = []
  const wanted = { tw: new Set<string>(), ta: new Set<string>() }
  const perChapter: Array<{ tw: string[]; ta: string[] }> = []
  const rowsOf = helpsByChapter(quotes)
  for (const [i, chapter] of literal.numbers.entries()) {
    const glt = literal.read(chapter)!
    const own = original.read(chapter)
    if (!own) throw new Error(`Faltan las palabras de ${book} ${chapter} en este aparato`)
    const gst = simple?.read(chapter) ?? null
    const verses = glt.pieces.flatMap((p) => (p.kind === 'paragraph' ? p.verses.map((v) => v.verse) : []))
    // A position of the original → its place among the chapter's words; a qere's → its ketiv's.
    const place = new Map(own.words.map((w, i) => [w.word, i]))
    for (const [qere, ketiv] of qereOf(own.tree)) if (place.has(ketiv)) place.set(qere, place.get(ketiv)!)
    const toOriginal = (t: ChapterText) => t.words.map((w) => w.originals.map((p) => place.get(p)).filter((p): p is number => p !== undefined))
    const read = originalWordsIn(own.tree, orig, own.words.length)
    const frame: PlacesFrame = {
      original: abbr,
      toOriginal: { TPL: toOriginal(glt), ...(gst ? { TPS: toOriginal(gst) } : {}) },
      strongs: (read?.words ?? []).map((w) => w.strong),
      originalsOfVerse: (verse) => (own.lines[verse] ?? []).flatMap((l) => l.pieces.map((p) => p.word).filter((w): w is number => w !== undefined)),
    }
    const helps = chapterHelps(rowsOf(chapter), { book, chapter, verses, frame, texts: { TPL: glt.words, ...(gst ? { TPS: gst.words } : {}) } })
    helps.articles.tw.forEach((p) => wanted.tw.add(p))
    helps.articles.ta.forEach((p) => wanted.ta.add(p))
    perChapter.push(helps.articles)
    const texts: PrototypeText[] = [{ key: sources.literal, abbreviation: 'TPL', title: title(sources.literal), pieces: glt.pieces, lines: glt.lines, toOriginal: frame.toOriginal.TPL }]
    if (gst && sources.simple) texts.push({ key: sources.simple, abbreviation: 'TPS', title: title(sources.simple), pieces: gst.pieces, lines: gst.lines, toOriginal: frame.toOriginal.TPS })
    texts.push({
      key: orig.key,
      abbreviation: abbr,
      title: title(orig.key),
      pieces: own.pieces,
      lines: own.lines,
      words: read?.words.length ? read.words : undefined,
      ...(read && Object.keys(read.inNotes).length ? { inNotes: read.inNotes } : {}),
      ...(own.notes ? { wordNotes: own.notes } : {}),
      original: true,
      dir: sources.original.dir,
      lang: sources.original.lang,
    })
    chapters.push({
      ...(helps.intros.chapter ? { intro: helps.intros.chapter } : {}),
      ...(helps.intros.book ? { bookIntro: helps.intros.book } : {}),
      source: `Recursos de ${sources.owner} y originales de unfoldingWord en Door43 (CC BY-SA 4.0), sacados de los paquetes de idioma el ${today}.`,
      language,
      book: { id: book, name, chapters: literal.numbers.length },
      chapter,
      texts,
      sections: sectionsOf(verses, o.sections?.(chapter), glt.pieces),
      verses: helps.verses,
      words: {},
      academy: {},
    })
    o.onChapter?.(i + 1, literal.numbers.length)
    // A chapter at a time, so the screen stays answering while a long book is read (as `loadBook` does).
    await (o.yield ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0))))()
  }
  // Each article once for the book, then given to the chapters that name it.
  const articles = await articlesV3(reader, [...wanted.tw], [...wanted.ta])
  chapters.forEach((c, i) => {
    for (const p of perChapter[i].tw) c.words[p] = articles.tw[p]
    for (const p of perChapter[i].ta) c.academy[p] = articles.ta[p]
  })
  const strongs = chapters.flatMap((c) => c.texts.find((t) => t.original)?.words?.map((w) => w.strong) ?? [])
  return { chapters, lexicon: await lexiconV3(reader, strongs), macula: maculaV3(orig) }
}

