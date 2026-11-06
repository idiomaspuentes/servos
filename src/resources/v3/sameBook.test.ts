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
import { createClient, memoryStore } from '@bt-synergy/language-pack-client'
import { zipSource } from '@bt-synergy/language-pack-v3'
import { btSynergyRoot } from '../../../scripts/btSynergy'
import hebrewNumbering from '../../lexicon/hebrewNumbering.json'
import { strongParts, type LexiconFile } from '../../lexicon/lexicon'
import type { PrototypeData } from '../../prototype/data'
import { readLexiconEntry, readMacula } from '../companions'
import { openPack } from '../packs'
import { booksOfText } from '../reading'
import { chapterData } from '../screenData'
import { sectionStartsOf } from '../sections'
import { availability, deviceIndex } from '../sources'
import { openResourceStores, type ResourceStores } from '../store'
import { readBookV3 } from './bookV3'

const DATA = join(btSynergyRoot(join(__dirname, '..', '..', '..')), 'packages', 'language-pack-v3', 'spec', 'tests', 'data')
const file = (folder: string, name: string) => new Uint8Array(readFileSync(join(folder, name)))
const TODAY = '2026-11-06'

/**
 * The differences format 3 is allowed, each with its reason. Each is a normalisation applied to both sides before they
 * are compared; nothing else may differ.
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
      'articles are written back as `rc://*/…`, a verse stays `[text](ref:tit 2:3)`; the rows keep `\\n` as two characters, ' +
      '`rc://es-419/…`, and a verse as `rc://*/tn/help/tit/02/03` or `../02/03.md`. The screens read both alike: Markdown ' +
      'breaks lines on both, articleOf reads either language, and a link that is no article is shown as its text.',
    apply: (c) => {
      const fix = (s: string) =>
        s
          .replace(/\\n|<br>/g, '\n')
          .replace(/rc:\/\/[^/\]\s]+\//g, 'rc://*/')
          .replace(/\]\((?:rc:\/\/\*\/tn\/help\/[^)]*|\.\.\/\d+\/\d+\.md|ref:[^)]*)\)/g, '](verse)')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      if (c.intro) c.intro = fix(c.intro)
      if (c.bookIntro) c.bookIntro = fix(c.bookIntro)
      for (const v of c.verses) {
        for (const n of v.notes) n.note = fix(n.note)
        for (const q of v.questions) {
          q.question = fix(q.question)
          q.response = fix(q.response)
        }
      }
      for (const a of [...Object.values(c.words), ...Object.values(c.academy)]) a.markdown = fix(a.markdown)
    },
  },
  {
    what: 'the alignment of a bridge word written with other capitals elsewhere in its verse, and the helps on it',
    why:
      'tc-study gives a word its alignment by its surface folded to lower case, counted through the verse ' +
      '(`attachAlignedOriginalWordIds`, `assignSurfaceOccurrences`): where a verse has the same word with different capitals the ' +
      'alignments shift onto the wrong one (GST Titus 3:5 «Nos … nos … nos», 3:2 «deben … Deben»). Format 3 aligns each word by the ' +
      'milestones around it, as the text has it: the rows are the wrong ones. Those words are left out of the places on both sides.',
    apply: (c) => {
      const original = c.texts.find((t) => t.original)!
      const twinsOf = new Map<string, Set<number>>()
      for (const t of c.texts.filter((x) => x.toOriginal)) {
        const twins = new Set<number>()
        for (const lines of Object.values(t.lines)) {
          const byFolded = new Map<string, Array<{ at: number; text: string }>>()
          for (const p of lines.flatMap((l) => l.pieces)) if (p.word !== undefined) byFolded.set(p.text.toLowerCase(), [...(byFolded.get(p.text.toLowerCase()) ?? []), { at: p.word, text: p.text }])
          for (const same of byFolded.values()) if (new Set(same.map((w) => w.text)).size > 1) same.forEach((w) => twins.add(w.at))
        }
        twins.forEach((at) => (t.toOriginal![at] = []))
        twinsOf.set(t.abbreviation, twins)
      }
      for (const v of c.verses)
        for (const help of [...v.notes, ...v.words]) {
          let touched = false
          for (const [abbr, twins] of twinsOf) {
            const places = help.places[abbr]
            if (!places?.some((at) => twins.has(at))) continue
            touched = true
            help.places[abbr] = places.filter((at) => !twins.has(at))
            if ('glt' in help) help[abbr === 'TPL' ? 'glt' : 'gst'] = null
          }
          if (!touched) continue
          const through = new Set<number>()
          for (const [abbr] of twinsOf) for (const at of help.places[abbr] ?? []) for (const p of c.texts.find((t) => t.abbreviation === abbr)!.toOriginal![at] ?? []) through.add(p)
          help.places[original.abbreviation] = [...through].sort((a, b) => a - b)
        }
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
  const read = await readBookV3(await client.open(language), language, book, { sections: (ch) => sectionStartsOf(book, ch), today: TODAY })
  expect(read).not.toBeNull()
  return read!
}

function compareBooks(rows: PrototypeData[], v3: PrototypeData[]): string[] {
  const found: string[] = []
  expect(v3.map((c) => c.chapter)).toEqual(rows.map((c) => c.chapter))
  rows.forEach((c, i) => differences(normal(v3[i]), normal(c), `${c.book.id} ${c.chapter}`, found))
  return found
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
    expect(compareBooks(rows.chapters, v3.chapters)).toEqual([])
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
    for (const book of BOOKS) {
      const rows = await rowsBook(stores, 'es-419', book)
      const v3 = await v3Book([language], originals, 'es-419', book)
      const here = compareBooks(rows.chapters, v3.chapters)
      differences(ALLOWED_BESIDE.lexicon.apply(v3.lexicon), ALLOWED_BESIDE.lexicon.apply(rows.lexicon), `${book} lexicon`, here)
      // MACULA: the same when the bridged orig has it (see ALLOWED_BESIDE.macula).
      if (v3.macula.trees || v3.macula.referents) differences(v3.macula, rows.macula, `${book} macula`, here)
      const notes = rows.chapters.flatMap((c) => c.verses.flatMap((v) => v.notes))
      console.log(
        `\n${book}: ${rows.chapters.length} chapters, ${notes.length} notes (${notes.filter((n) => n.places.TPL.length).length} on words), ` +
          `${Object.keys(rows.lexicon).length} lexicon entries, MACULA ${rows.macula.trees ? 'yes' : 'no'}; ` +
          `${here.length} differences beyond the allowed ones\n${here.join('\n')}`
      )
      found.push(...here)
    }
    expect(found).toEqual([])
  }, 900_000)
})
