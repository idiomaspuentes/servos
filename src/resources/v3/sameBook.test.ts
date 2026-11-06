/// <reference types="node" />
/**
 * A book read from format 3 is the same book on screen as the one read from today's rows, from the same pack: the pack
 * is opened twice, once into tc-study's stores as Servos opens packs today (`openPack`, then `chapterData` per chapter,
 * as `library.ts` reads a book) and once bridged into a format 3 client (`importOldPack`, then `readBookV3`), and every
 * chapter is compared. The allowed differences are listed below, each with its reason; anything else fails.
 *
 * The fixtures are bt-synergy's spec test data (es-419 Titus and the UGNT of Titus, format 1.1). With real packs, Titus
 * and Jonah of es-419 with their articles and lexicons:
 *
 *   SERVOS_PAQUETES=<folder with originals.langpack.zip and es-419.langpack.zip> npx vitest run src/resources/v3/sameBook.test.ts
 */
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClient, memoryStore, type PackReader } from '@bt-synergy/language-pack-client'
import { zipSource } from '@bt-synergy/language-pack-v3'
import { btSynergyRoot } from '../../../scripts/btSynergy'
import hebrewNumbering from '../../lexicon/hebrewNumbering.json'
import { strongParts, type LexiconFile } from '../../lexicon/lexicon'
import type { PrototypeData } from '../../prototype/data'
import { readLexiconEntry, readMacula } from '../companions'
import { openPack } from '../packs'
import { booksOfText, readVerseHelps, type VerseHelps } from '../reading'
import { chapterData } from '../screenData'
import { sectionStartsOf } from '../sections'
import { availability, deviceIndex } from '../sources'
import { openResourceStores, type ResourceStores } from '../store'
import { readBookV3, textChapters } from './bookV3'
import { verseHelpsV3 } from './helpsV3'

const DATA = join(btSynergyRoot(join(__dirname, '..', '..', '..')), 'packages', 'language-pack-v3', 'spec', 'tests', 'data')
const file = (folder: string, name: string) => new Uint8Array(readFileSync(join(folder, name)))
const TODAY = '2026-11-06'

/** Markdown as allowed difference 2 reads it: line ends, `rc://` languages and verse links written one way. */
const markdownNormal = (s: string) =>
  s
    .replace(/\\n|<br>/g, '\n')
    .replace(/rc:\/\/[^/\]\s]+\//g, 'rc://*/')
    .replace(/\]\((?:rc:\/\/\*\/tn\/help\/[^)]*|\.\.\/\d+\/\d+\.md|ref:[^)]*)\)/g, '](verse)')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/**
 * The differences format 3 is allowed in a chapter, each with its reason. Each is a normalisation applied to both sides
 * before they are compared (and `CASE_SHIFT`, between the two sides); nothing else may differ.
 */
const ALLOWED: Array<{ what: string; why: string; apply: (c: PrototypeData) => void }> = [
  {
    what: 'texts[].title',
    why: 'The format 3 reader gives no resource titles (they are in the catalog it keeps to itself); readBookV3 takes them from `titles` and, without, titles a text by its key.',
    apply: (c) => c.texts.forEach((t) => (t.title = '')),
  },
  {
    what: 'line ends, `rc://` languages and verse links in notes, questions, introductions and articles',
    why:
      'Format 3 keeps the TSV escapes undone (`\\n` and `<br>` are line breaks, book.cddl) and writes links as ids (ids.md): ' +
      'articles are written back as `rc://*/…`, a verse stays `[text](ref:tit 2:3)`; the rows keep `\\n` and `<br>` as written, ' +
      '`rc://es-419/…`, and a verse as `rc://*/tn/help/tit/02/03` or `../02/03.md`. On screen: Markdown breaks lines on a `\\n` ' +
      'as on a line end, articleOf reads either language, and a link that is no article is shown as its text, so those look ' +
      'the same; a `<br>` does not: Markdown has no rule for it, so the rows show a literal «<br>» where format 3 shows a line ' +
      'break (format 3 is the better one there).',
    apply: (c) => {
      if (c.intro) c.intro = markdownNormal(c.intro)
      if (c.bookIntro) c.bookIntro = markdownNormal(c.bookIntro)
      for (const v of c.verses) {
        for (const n of v.notes) n.note = markdownNormal(n.note)
        for (const q of v.questions) {
          q.question = markdownNormal(q.question)
          q.response = markdownNormal(q.response)
        }
      }
      for (const a of [...Object.values(c.words), ...Object.values(c.academy)]) a.markdown = markdownNormal(a.markdown)
    },
  },
]

const normal = (c: PrototypeData): PrototypeData => {
  const copy = structuredClone(c)
  for (const rule of ALLOWED) rule.apply(copy)
  return copy
}

/**
 * The Hebrew places where the Hebrew Bible's numbering and ours are not one to one: two Hebrew verses that are one of ours
 * (1SA 21:1 is our 20:42, and the Hebrew 20:42 is too). Format 3 keeps a lexicon's verses in our numbering (lex.cddl), so
 * there the Hebrew one cannot be told again.
 */
const AMBIGUOUS_HEBREW: ReadonlySet<string> = (() => {
  const place = /^([1-3A-Z][A-Z]{2}) (\d+):(\d+)(?:-(\d+))?$/
  const forward = new Map<string, string>()
  for (const [ours, theirs] of Object.entries(hebrewNumbering.mapped as Record<string, string>)) {
    const a = place.exec(ours)
    const b = place.exec(theirs)
    if (!a || !b) continue
    for (let i = 0; i <= Number(a[4] ?? a[3]) - Number(a[3]); i++) forward.set(`${a[1]} ${a[2]}:${Number(a[3]) + i}`, `${b[1]} ${b[2]}:${Number(b[3]) + i}`)
  }
  const image = new Set(forward.values())
  const out = new Set<string>()
  for (const [ours, theirs] of forward) if (ours !== theirs && !image.has(ours)) out.add(ours).add(theirs)
  return out
})()

/** Differences allowed beside the chapters, each with its reason. */
const ALLOWED_BESIDE = {
  lexicon: {
    what: 'the verses of a Hebrew lexicon sense where the Hebrew Bible numbers two verses as one of ours',
    why:
      'Format 3 keeps a sense’s verses in our numbering (lex.cddl, `fromHebrewNumbering`); written back in the Hebrew one ' +
      '(`inHebrewNumbering`, what the screens look a verse up with) the two Hebrew verses of one of ours are one: 1SA 20:42 and ' +
      '21:1, 1KI 22:43 and 22:44, 1CH 12:4 and 12:5. A lookup in our numbering finds the same senses or more.',
    apply(lexicon: Record<string, LexiconFile>) {
      const copy = structuredClone(lexicon)
      for (const file of Object.values(copy))
        for (const entry of file.entries)
          for (const sense of entry.senses)
            for (const [book, packed] of Object.entries(sense.refs ?? {})) {
              const verses = new Set<string>()
              for (const part of packed.split(';')) {
                const [chapter, list = ''] = part.split(':')
                for (const v of list.split(',')) {
                  const [from, to = from] = v.split('-').map(Number)
                  for (let n = from; n <= to; n++) if (!AMBIGUOUS_HEBREW.has(`${book} ${chapter}:${n}`)) verses.add(`${chapter}:${n}`)
                }
              }
              sense.refs![book] = [...verses].sort().join(',')
            }
      return copy
    },
  },
  macula: {
    what: 'MACULA of a book bridged from an old pack',
    why:
      'bt-synergy’s `zipSource` skips the rows of a resource that is not kept by book when it is asked for a book’s rows, and ' +
      'MACULA’s subject (Original Language Syntax) is not one: so `extractOrig` finds no MACULA and the bridged `orig` has none. ' +
      'A published `orig` carries it; readBookV3 gives what the `orig` has.',
  },
}

/** Every path where two values differ (the first `limit`). */
function differences(a: unknown, b: unknown, path = '', out: string[] = [], limit = 200): string[] {
  if (out.length >= limit) return out
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) {
    out.push(`${path}: ${JSON.stringify(a)?.slice(0, 160)} ≠ ${JSON.stringify(b)?.slice(0, 160)}`)
  } else if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
    for (const k of keys) differences((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out, limit)
  } else if (typeof a === 'string' && typeof b === 'string' && a !== b) {
    // Where two texts part, with a little before.
    let at = 0
    while (a[at] === b[at]) at++
    out.push(`${path} at ${at}: ${JSON.stringify(a.slice(Math.max(0, at - 40), at + 80))} ≠ ${JSON.stringify(b.slice(Math.max(0, at - 40), at + 80))}`)
  } else if (a !== b) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 160)} ≠ ${JSON.stringify(b)?.slice(0, 160)}`)
  return out
}

/** The book as `library.ts` reads it today: `chapterData` for each chapter of its literal text, and its lexicon entries. */
async function rowsBook(stores: ResourceStores, language: string, book: string) {
  const found = availability(await deviceIndex(stores), language, book)
  expect(found.here).toBe(true)
  const sources = found.sources!
  const outline = (await booksOfText(stores, sources.literal)).find((b) => b.book === book)!
  const chapters: PrototypeData[] = []
  for (const { number } of outline.chapters) chapters.push(await chapterData(stores, sources, book, number, { sections: sectionStartsOf(book, number), today: TODAY }))
  const lexicon: Record<string, LexiconFile> = {}
  if (sources.lexicon)
    for (const w of chapters.flatMap((c) => c.texts.find((t) => t.original)?.words ?? []))
      for (const part of strongParts(w.strong)) {
        const entry = await readLexiconEntry(stores, sources.lexicon, part.number)
        if (entry) lexicon[`${part.kind}:${part.number}`] = entry
      }
  const macula = sources.macula ? await readMacula(stores, sources.macula, book) : { trees: null, referents: null }
  return { chapters, lexicon, macula }
}

/** The same book from format 3: the packs bridged on a device with no network. */
async function v3Book(packs: Uint8Array[], originals: Uint8Array, language: string, book: string) {
  const client = createClient({ store: memoryStore(), trust: { trustedKeys: {} } })
  const source = await zipSource(originals)
  for (const pack of packs) {
    const report = await client.importOldPack(pack, { originals: source, now: `${TODAY}T00:00:00Z` })
    expect(report.activated).toContain(`${language}/book:${book}`)
  }
  const reader = await client.open(language)
  const progress: Array<[number, number]> = []
  const read = await readBookV3(reader, language, book, { sections: (ch) => sectionStartsOf(book, ch), today: TODAY, onChapter: (done, total) => progress.push([done, total]) })
  expect(read).not.toBeNull()
  expect(progress).toEqual(read!.chapters.map((_, i) => [i + 1, read!.chapters.length]))
  return { ...read!, reader }
}

/**
 * Allowed difference between the two sides of a chapter: the alignment of a bridge word written with other capitals
 * elsewhere in its verse, where the rows' alignment of it is not format 3's.
 */
const CASE_SHIFT = {
  what: 'the alignment of a bridge word written with other capitals elsewhere in its verse, where the two sides differ, and the helps on it',
  why:
    'tc-study gives a word its alignment by its surface folded to lower case, counted through the verse ' +
    '(`attachAlignedOriginalWordIds`, `assignSurfaceOccurrences`): where a verse has the same word with different capitals the ' +
    'alignments can shift onto the wrong one (GST Titus 3:5 «Nos … nos … nos», 3:2 «deben … Deben»). Format 3 aligns each word by ' +
    'the milestones around it: the rows are the wrong ones. Only such words whose two alignments differ are left out (and the ' +
    'test checks that format 3 gives them exactly their `align`); a help standing on one loses that word on both sides.',
}

/**
 * Applies `CASE_SHIFT` to a chapter's two sides (copies already normalised): returns the words left out, as
 * `book chapter text place word`.
 */
async function maskCaseShifts(rows: PrototypeData, v3: PrototypeData, reader: PackReader): Promise<string[]> {
  const { book: { id: book }, chapter } = rows
  const model = (await reader.book(book))!
  const orig = textChapters((await reader.orig(book))!).read(chapter)!
  const place = new Map(orig.words.map((w, i) => [w.word, i]))
  const masked = new Map<string, Set<number>>()
  const out: string[] = []
  for (const text of rows.texts.filter((t) => t.toOriginal)) {
    const mine = v3.texts.find((t) => t.abbreviation === text.abbreviation)!
    const words = textChapters(model.texts.find((t) => t.res === text.key)!).read(chapter)!.words
    const set = new Set<number>()
    for (const lines of Object.values(text.lines)) {
      const byFolded = new Map<string, Array<{ at: number; text: string }>>()
      for (const p of lines.flatMap((l) => l.pieces)) if (p.word !== undefined) byFolded.set(p.text.toLowerCase(), [...(byFolded.get(p.text.toLowerCase()) ?? []), { at: p.word, text: p.text }])
      for (const same of byFolded.values()) {
        if (new Set(same.map((w) => w.text)).size < 2) continue
        for (const { at, text: word } of same) {
          if (JSON.stringify(text.toOriginal![at]) === JSON.stringify(mine.toOriginal![at])) continue
          // Format 3's is its own alignment, as the book has it.
          expect(mine.toOriginal![at]).toEqual(words[at].originals.map((p) => place.get(p)).filter((p) => p !== undefined))
          set.add(at)
          out.push(`${book} ${chapter} ${text.abbreviation} ${at} ${word}`)
        }
      }
    }
    masked.set(text.abbreviation, set)
  }
  if (!out.length) return out
  const original = rows.texts.find((t) => t.original)!.abbreviation
  const touched = new Set<string>()
  for (const side of [rows, v3])
    for (const v of side.verses)
      for (const help of [...v.notes, ...v.words]) if ([...masked].some(([abbr, set]) => help.places[abbr]?.some((at) => set.has(at)))) touched.add(help.id)
  for (const side of [rows, v3]) {
    for (const t of side.texts) for (const at of masked.get(t.abbreviation) ?? []) t.toOriginal![at] = []
    for (const v of side.verses)
      for (const help of [...v.notes, ...v.words]) {
        if (!touched.has(help.id)) continue
        const through = new Set<number>()
        for (const [abbr, set] of masked) {
          if (!help.places[abbr]) continue
          help.places[abbr] = help.places[abbr].filter((at) => !set.has(at))
          if ('glt' in help) help[abbr === 'TPL' ? 'glt' : 'gst'] = null
          for (const at of help.places[abbr]) for (const p of side.texts.find((t) => t.abbreviation === abbr)!.toOriginal![at] ?? []) through.add(p)
        }
        help.places[original] = [...through].sort((a, b) => a - b)
      }
  }
  return out
}

/** The differences beyond the allowed ones, and the words `CASE_SHIFT` left out. */
async function compareBooks(rows: PrototypeData[], v3: PrototypeData[], reader: PackReader): Promise<{ found: string[]; masked: string[] }> {
  const found: string[] = []
  const masked: string[] = []
  expect(v3.map((c) => c.chapter)).toEqual(rows.map((c) => c.chapter))
  for (const [i, c] of rows.entries()) {
    const [a, b] = [normal(v3[i]), normal(c)]
    masked.push(...(await maskCaseShifts(b, a, reader)))
    differences(a, b, `${c.book.id} ${c.chapter}`, found)
  }
  return { found, masked }
}

describe('a book read from format 3 is the same book on screen', () => {
  it('es-419 Titus of the spec fixtures: every chapter the same, but the allowed differences', async () => {
    const bookZip = file(DATA, 'es-419-tit.langpack.zip')
    const originalsZip = file(DATA, 'originals-tit.langpack.zip')

    const stores = openResourceStores({ cache: 'same-book-cache', catalog: 'same-book-catalog' })
    expect((await openPack(stores, originalsZip)).skippedResources).toEqual([])
    // The fixture's originals pack has no `catalog.json` (the real one has): its catalog row is written as the real
    // pack writes it, with the book's blob that the book pack's quotes and alignments were made against (g987ab2025a),
    // else the importer drops them (`droppedRows`) and today's path has no places to compare.
    await stores.catalog.set('unfoldingWord/el-x-koine/ugnt', {
      resourceKey: 'unfoldingWord/el-x-koine/ugnt',
      resourceId: 'ugnt',
      abbreviation: 'ugnt',
      owner: 'unfoldingWord',
      language: 'el-x-koine',
      title: 'unfoldingWord® Greek New Testament',
      subject: 'Greek New Testament',
      version: 'v0.34',
      type: 'scripture',
      format: 'usfm',
      release: { tag_name: 'v0.34', published_at: '2023-09-27T02:19:31Z' },
      contentMetadata: { books: ['tit'], bookBlobs: { tit: '987ab2025a' }, bookBlobsRef: 'v0.34' },
    } as never)
    const opened = await openPack(stores, bookZip)
    expect(opened.droppedRows).toEqual({})

    const rows = await rowsBook(stores, 'es-419', 'tit')
    const v3 = await v3Book([bookZip], originalsZip, 'es-419', 'tit')
    // Not empty comparisons: the notes stand on words in both.
    expect(rows.chapters[0].verses[0].notes.some((n) => n.places.TPL.length)).toBe(true)
    const { found, masked } = await compareBooks(rows.chapters, v3.chapters, v3.reader)
    expect(found).toEqual([])
    // CASE_SHIFT leaves out only the words cited: GST Titus 3:2 «Deben», 3:5 «Nos … nos … nos».
    expect(masked).toEqual(['tit 3 TPS 37 Deben', 'tit 3 TPS 157 Nos', 'tit 3 TPS 167 nos', 'tit 3 TPS 171 nos'])

    // What the changes view reads (B4): the same answer as `readVerseHelps` today.
    const places = [{ chapter: 1, verse: 1 }, { chapter: 2, verse: 11 }, { chapter: 3, verse: 5 }, { chapter: 3, verse: 99 }]
    const sources = availability(await deviceIndex(stores), 'es-419', 'tit').sources!
    const today = await readVerseHelps(stores, sources, 'tit', places)
    const mine = await verseHelpsV3(v3.reader, 'es-419', 'tit', places)
    const noteText = (h: VerseHelps[]) => h.map((v) => ({ ...v, notes: v.notes.map((n) => ({ ...n, note: markdownNormal(n.note) })) }))
    expect(today[0].notes.length).toBeGreaterThan(0)
    expect(noteText(mine)).toEqual(noteText(today))
  }, 120_000)
})

const folder = process.env.SERVOS_PAQUETES
const BOOKS = (process.env.SERVOS_V3_BOOKS ?? 'tit,jon').split(',')

describe.skipIf(!folder)('the same, with the real packs of es-419', () => {
  it(`${BOOKS.join(', ')}: every chapter, the lexicon and MACULA the same`, async () => {
    const originals = file(folder!, 'originals.langpack.zip')
    const language = file(folder!, 'es-419.langpack.zip')
    const stores = openResourceStores({ cache: 'same-real-cache', catalog: 'same-real-catalog' })
    for (const pack of [originals, language]) expect((await openPack(stores, pack)).skippedResources).toEqual([])
    const found: string[] = []
    const masked: string[] = []
    for (const book of BOOKS) {
      const rows = await rowsBook(stores, 'es-419', book)
      const v3 = await v3Book([language], originals, 'es-419', book)
      const compared = await compareBooks(rows.chapters, v3.chapters, v3.reader)
      const here = compared.found
      masked.push(...compared.masked)
      differences(ALLOWED_BESIDE.lexicon.apply(v3.lexicon), ALLOWED_BESIDE.lexicon.apply(rows.lexicon), `${book} lexicon`, here)
      // MACULA: the same when the bridged orig has it (see ALLOWED_BESIDE.macula).
      if (v3.macula.trees || v3.macula.referents) differences(v3.macula, rows.macula, `${book} macula`, here)
      const notes = rows.chapters.flatMap((c) => c.verses.flatMap((v) => v.notes))
      console.log(
        `\n${book}: ${rows.chapters.length} chapters, ${notes.length} notes (${notes.filter((n) => n.places.TPL.length).length} on words), ` +
          `${Object.keys(rows.lexicon).length} lexicon entries, MACULA ${rows.macula.trees ? 'yes' : 'no'}; ` +
          `${compared.masked.length} words left out (${CASE_SHIFT.what}: ${compared.masked.join('; ')}); ` +
          `${here.length} differences beyond the allowed ones\n${here.join('\n')}`
      )
      found.push(...here)
    }
    expect(found).toEqual([])
    // A few words, not every word with a capitalised twin in its verse.
    expect(masked.length).toBeLessThan(20)
  }, 900_000)
})
