/// <reference types="node" />
/**
 * Writes the prototype's data, Titus 1 in es-419, from the real packs:
 *
 *   SERVOS_PAQUETES=<folder> npx vitest run src/prototype/makeData.test.ts
 *
 * The folder holds what `bt-synergy/packages/resource-pipeline/cli/prepare-language.ts --lang es-419 --books all`
 * writes. Skipped without the variable. The content is es-419_gl's (CC BY-SA 4.0), named in the file.
 */
import 'fake-indexeddb/auto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { unwrapVersioned } from '@bt-synergy/resource-pipeline/cache/versionedEnvelope'
import { openPack } from '../resources/packs'
import { booksOfText, notesOfVerse, readChapter, referenceCovers } from '../resources/reading'
import { openResourceStores } from '../resources/store'
import type { PrototypeData } from './data'

const folder = process.env.SERVOS_PAQUETES
const ORG = 'es-419_gl/es-419'
const GLT = `${ORG}/glt`
const GST = `${ORG}/gst`
const TN = `${ORG}/tn`
const TQ = `${ORG}/tq`
const TWL = `${ORG}/twl`
const TW = `${ORG}/tw`
const TA = `${ORG}/ta`

describe.skipIf(!folder)('datos del prototipo', () => {
  it('escribe Tito 1 desde los paquetes reales', async () => {
    const stores = openResourceStores({ cache: 'proto-cache', catalog: 'proto-catalog' })
    for (const file of ['originals', 'es-419-base', 'es-419-tit']) {
      await openPack(stores, readFileSync(join(folder!, `${file}.langpack.zip`)))
    }
    const raw = async <T,>(key: string, version: number) => unwrapVersioned<T>(await stores.cache.get(key), version)
    const title = async (key: string) => String((await stores.catalog.get(key))?.title ?? key)

    const book = (await booksOfText(stores, GLT))[0]
    const chapter = 1
    const glt = (await readChapter(stores, GLT, 'tit', chapter))!
    const gst = (await readChapter(stores, GST, 'tit', chapter))!
    const verses = glt.flatMap((p) => (p.kind === 'paragraph' ? p.verses.map((v) => v.verse) : []))

    type Q = { id: string; reference: string; question: string; response: string }
    type L = { id: string; reference: string; origWords: string; articlePath: string; tags: string }
    const questions = (await raw<{ questions: Q[] }>(`prepared:questions:${TQ}:tit:${chapter}:light`, 1))?.questions ?? []
    const links = (await raw<{ links: L[] }>(`prepared:words-links:${TWL}:tit:${chapter}:light`, 1))?.links ?? []

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

    const notesByVerse: PrototypeData['verses'] = []
    const academy: PrototypeData['academy'] = {}
    for (const verse of verses) {
      const inGlt = await notesOfVerse(stores, { notesKey: TN, textKey: GLT, book: 'tit', chapter, verse })
      const inGst = await notesOfVerse(stores, { notesKey: TN, textKey: GST, book: 'tit', chapter, verse })
      for (const n of inGlt) {
        const path = n.supportReference.split('/ta/man/')[1]
        if (!path || academy[path]) continue
        const article = await stores.cache.get(`${TA}/${path}`)
        const markdown = typeof article === 'string' ? article : ''
        academy[path] = { title: markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path, markdown }
      }
      notesByVerse.push({
        verse,
        notes: inGlt.map((n) => ({
          id: n.id,
          quote: n.quote,
          glt: n.textQuote,
          gst: inGst.find((g) => g.id === n.id)?.textQuote ?? null,
          note: n.note,
          academy: n.supportReference.split('/ta/man/')[1] ?? null,
        })),
        questions: questions
          .filter((q) => referenceCovers(q.reference, chapter, verse))
          .map((q) => ({ id: q.id, question: q.question, response: q.response })),
        words: links
          .filter((l) => referenceCovers(l.reference, chapter, verse))
          .map((l) => ({ id: l.id, original: l.origWords, article: l.articlePath, keyTerm: l.tags.includes('keyterm') })),
      })
    }

    const data: PrototypeData = {
      source: `Recursos de ${ORG} en Door43 (CC BY-SA 4.0), sacados del paquete de idioma es-419 el ${new Date().toISOString().slice(0, 10)}.`,
      language: 'es-419',
      book: { id: 'tit', name: book.name, chapters: book.chapters.length },
      chapter,
      texts: [
        { key: GLT, abbreviation: 'TPL', title: await title(GLT), pieces: glt },
        { key: GST, abbreviation: 'TPS', title: await title(GST), pieces: gst },
      ],
      verses: notesByVerse,
      words,
      academy,
    }
    writeFileSync(join(__dirname, 'data', 'tito-1.json'), JSON.stringify(data, null, 1) + '\n')
  }, 120_000)
})
