/// <reference types="node" />
/**
 * Writes the prototype's data, every chapter of Titus and Jonah in es-419, from the real packs:
 *
 *   SERVOS_PAQUETES=<folder> npx vitest run src/prototype/makeData.test.ts
 *
 * The folder holds what `bt-synergy/packages/resource-pipeline/cli/prepare-language.ts --lang es-419 --books all`
 * writes. Skipped without the variable. The content is es-419_gl's (CC BY-SA 4.0) and unfoldingWord's originals
 * (CC BY-SA 4.0), named in each file.
 */
import 'fake-indexeddb/auto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { unwrapVersioned } from '@bt-synergy/resource-pipeline/cache/versionedEnvelope'
import { openPack } from '../resources/packs'
import {
  alignedPlaces,
  booksOfText,
  introsOf,
  notesOfVerse,
  originalWordsOf,
  readChapter,
  readChapterWords,
  referenceCovers,
  type ChapterWords,
} from '../resources/reading'
import { openResourceStores, type ResourceStores } from '../resources/store'
import type { Places, PrototypeData } from './data'

const folder = process.env.SERVOS_PAQUETES
const ORG = 'es-419_gl/es-419'
const GLT = `${ORG}/glt`
const GST = `${ORG}/gst`
const TN = `${ORG}/tn`
const TQ = `${ORG}/tq`
const TWL = `${ORG}/twl`
const TW = `${ORG}/tw`
const TA = `${ORG}/ta`
const UGNT = 'unfoldingWord/el-x-koine/ugnt'
const UHB = 'unfoldingWord/hbo/uhb'

type Original = { key: string; abbreviation: string; dir: 'ltr' | 'rtl'; lang: string }

/**
 * Where each section begins, from the `\ts\*` markers of unfoldingWord's ULT (en_ult, master, read 2026-10-14): the
 * es-419 texts do not mark sections and the packs do not carry the ULT. Wired, a pack carries this table.
 */
const SECTION_STARTS: Record<string, number[]> = {
  'tit 1': [1, 4, 6, 8, 10, 12, 15],
  'tit 2': [1, 3, 6, 9, 11, 14, 15],
  'tit 3': [1, 3, 4, 6, 8, 9, 12, 14, 15],
  'jon 1': [1, 4, 6, 8, 11, 14, 17],
  'jon 2': [1, 3, 5, 7, 9],
  'jon 3': [1, 4, 6, 8, 10],
  'jon 4': [1, 4, 6, 8, 10],
}

async function chapterData(stores: ResourceStores, bookId: string, chapter: number, original: Original): Promise<PrototypeData> {
  const raw = async <T,>(key: string, version: number) => unwrapVersioned<T>(await stores.cache.get(key), version)
  const title = async (key: string) => String((await stores.catalog.get(key))?.title ?? key)

  const book = (await booksOfText(stores, GLT)).find((b) => b.book === bookId)!
  const glt = (await readChapter(stores, GLT, bookId, chapter))!
  const gst = (await readChapter(stores, GST, bookId, chapter))!
  const verses = glt.flatMap((p) => (p.kind === 'paragraph' ? p.verses.map((v) => v.verse) : []))

  type Q = { id: string; reference: string; question: string; response: string }
  type L = { id: string; reference: string; origWords: string; articlePath: string; tags: string }
  const questions = (await raw<{ questions: Q[] }>(`prepared:questions:${TQ}:${bookId}:${chapter}:light`, 1))?.questions ?? []
  const links = (await raw<{ links: L[] }>(`prepared:words-links:${TWL}:${bookId}:${chapter}:light`, 1))?.links ?? []

  // Where each note and word link stands in each text: aligned places in TPL and TPS, and the original's words those
  // places translate (a touched Hebrew word finds its notes through them).
  const words3 = {
    TPL: (await readChapterWords(stores, GLT, bookId, chapter))!,
    TPS: (await readChapterWords(stores, GST, bookId, chapter))!,
    [original.abbreviation]: (await readChapterWords(stores, original.key, bookId, chapter))!,
  } as Record<string, ChapterWords>
  const aligned = {
    tn: { TPL: await alignedPlaces(stores, TN, GLT, bookId, chapter), TPS: await alignedPlaces(stores, TN, GST, bookId, chapter) },
    twl: { TPL: await alignedPlaces(stores, TWL, GLT, bookId, chapter), TPS: await alignedPlaces(stores, TWL, GST, bookId, chapter) },
  }
  const originalPlace = new Map(words3[original.abbreviation].words.map((w, i) => [w.own, i]))
  const toOriginal = (abbr: 'TPL' | 'TPS') =>
    words3[abbr].words.map((w) => w.originals.map((key) => originalPlace.get(key)).filter((p): p is number => p !== undefined))
  const placesOf = (helps: 'tn' | 'twl', id: string): Places => {
    const tpl = aligned[helps].TPL[id] ?? []
    const tps = aligned[helps].TPS[id] ?? []
    const originals = new Set<number>()
    for (const [abbr, places] of [['TPL', tpl], ['TPS', tps]] as const) {
      for (const at of places) for (const key of words3[abbr].words[at]?.originals ?? []) {
        const place = originalPlace.get(key)
        if (place !== undefined) originals.add(place)
      }
    }
    return { TPL: tpl, TPS: tps, [original.abbreviation]: [...originals].sort((a, b) => a - b) }
  }

  const twStamp = resourceContentStamp(await stores.catalog.get(TW))
  const words: PrototypeData['words'] = {}
  for (const link of links) {
    if (words[link.articlePath]) continue
    const entry = link.articlePath.replace(/^bible\//, '')
    const titleRow = await stores.cache.get(`helps-text:tw-title:${TW}@${twStamp}:${entry}`)
    const article = await stores.cache.get(`${TW}/${link.articlePath}`)
    words[link.articlePath] = {
      title: unwrapVersioned<string>(titleRow, 1) ?? entry.split('/').pop()!,
      markdown: typeof article === 'string' ? article : '',
    }
  }

  const byVerse: PrototypeData['verses'] = []
  const academy: PrototypeData['academy'] = {}
  for (const verse of verses) {
    const inGlt = await notesOfVerse(stores, { notesKey: TN, textKey: GLT, book: bookId, chapter, verse })
    const inGst = await notesOfVerse(stores, { notesKey: TN, textKey: GST, book: bookId, chapter, verse })
    for (const n of inGlt) {
      const path = n.supportReference.split('/ta/man/')[1]
      if (!path || academy[path]) continue
      const article = await stores.cache.get(`${TA}/${path}`)
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
        .map((l) => ({ id: l.id, original: l.origWords, article: l.articlePath, keyTerm: l.tags.includes('keyterm'), places: placesOf('twl', l.id) })),
    })
  }

  const intros = await introsOf(stores, TN, bookId, chapter)

  return {
    ...(intros.chapter ? { intro: intros.chapter } : {}),
    ...(intros.book ? { bookIntro: intros.book } : {}),
    source: `Recursos de ${ORG} y originales de unfoldingWord en Door43 (CC BY-SA 4.0), sacados de los paquetes de idioma el ${new Date().toISOString().slice(0, 10)}.`,
    language: 'es-419',
    book: { id: bookId, name: book.name, chapters: book.chapters.length },
    chapter,
    texts: [
      { key: GLT, abbreviation: 'TPL', title: await title(GLT), pieces: glt, lines: words3.TPL.lines, toOriginal: toOriginal('TPL') },
      { key: GST, abbreviation: 'TPS', title: await title(GST), pieces: gst, lines: words3.TPS.lines, toOriginal: toOriginal('TPS') },
      {
        key: original.key,
        abbreviation: original.abbreviation,
        title: await title(original.key),
        pieces: (await readChapter(stores, original.key, bookId, chapter))!,
        lines: words3[original.abbreviation].lines,
        words: (await originalWordsOf(stores, original.key, bookId, chapter)) ?? undefined,
        original: true,
        dir: original.dir,
        lang: original.lang,
      },
    ],
    sections: SECTION_STARTS[`${bookId} ${chapter}`].map((start, i, starts) => verses.filter((v) => v >= start && v < (starts[i + 1] ?? Infinity))),
    verses: byVerse,
    words,
    academy,
  }
}

describe.skipIf(!folder)('datos del prototipo', () => {
  it('escribe todos los capítulos de Tito y Jonás desde los paquetes reales', async () => {
    const stores = openResourceStores({ cache: 'proto-cache', catalog: 'proto-catalog' })
    for (const file of ['originals', 'es-419']) {
      await openPack(stores, readFileSync(join(folder!, `${file}.langpack.zip`)))
    }
    // One file a chapter, `{book}-{chapter}.json`, without spaces: seven chapters go into the one-page prototype.
    const write = (data: PrototypeData) => writeFileSync(join(__dirname, 'data', `${data.book.id}-${data.chapter}.json`), JSON.stringify(data) + '\n')
    const greek: Original = { key: UGNT, abbreviation: 'Griego', dir: 'ltr', lang: 'grc' }
    const hebrew: Original = { key: UHB, abbreviation: 'Hebreo', dir: 'rtl', lang: 'hbo' }
    for (const chapter of [1, 2, 3]) write(await chapterData(stores, 'tit', chapter, greek))
    // Jonah 2 is a poem (Jonah's prayer): the editor's lines are tried on it.
    for (const chapter of [1, 2, 3, 4]) write(await chapterData(stores, 'jon', chapter, hebrew))
  }, 600_000)
})
