/// <reference types="node" />
/**
 * With real packs: SERVOS_PAQUETES=<folder> npx vitest run src/resources/realPacks.test.ts
 *
 * The folder holds what `bt-synergy/packages/resource-pipeline/cli/prepare-language.ts --lang es-419 --books all`
 * writes. Skipped when the variable is not set, so the usual test run needs no packs and no network.
 */
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openPack } from './packs'
import { booksOfText, notesOfVerse, readChapter, resourcesOnDevice } from './reading'
import { openResourceStores } from './store'

const folder = process.env.SERVOS_PAQUETES
const GLT = 'es-419_gl/es-419/glt'
const TN = 'es-419_gl/es-419/tn'

describe.skipIf(!folder)('paquetes reales de es-419', () => {
  it('con el paquete base y el de Tito se lee Tito 1 con sus notas, sin internet', async () => {
    const stores = openResourceStores({ cache: 'real-cache', catalog: 'real-catalog' })
    for (const file of ['originals', 'es-419-base', 'es-419-tit']) {
      const result = await openPack(stores, readFileSync(join(folder!, `${file}.langpack.zip`)))
      expect(result.skippedResources).toEqual([])
    }

    const resources = await resourcesOnDevice(stores)
    const glt = resources.find((r) => r.key === GLT)!
    expect(glt.books).toEqual(['tit'])

    const books = await booksOfText(stores, GLT)
    expect(books.map((b) => b.book)).toEqual(['tit'])

    const chapter = (await readChapter(stores, GLT, 'tit', 1))!
    const verses = chapter.flatMap((p) => (p.kind === 'paragraph' ? p.verses : []))
    expect(verses[0].verse).toBe(1)
    expect(verses[0].text).toMatch(/^Pablo/)

    const notes = await notesOfVerse(stores, { notesKey: TN, textKey: GLT, book: 'tit', chapter: 1, verse: 1 })
    expect(notes.length).toBeGreaterThan(0)
    const withText = notes.filter((n) => n.textQuote)
    expect(withText.length).toBeGreaterThan(0)

    console.log(`\nTito 1:1 (${glt.title}): ${verses[0].text}\n`)
    for (const n of notes) console.log(`  · ${n.textQuote ?? `(${n.quote})`}: ${n.note.split('\n')[0].slice(0, 110)}`)
  }, 120_000)
})
