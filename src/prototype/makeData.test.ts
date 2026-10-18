/// <reference types="node" />
/**
 * Writes the prototype's data, every chapter of Titus and Jonah in es-419, from the real packs:
 *
 *   SERVOS_PAQUETES=<folder> npx vitest run src/prototype/makeData.test.ts
 *
 * The folder holds what `bt-synergy/packages/resource-pipeline/cli/prepare-language.ts --lang es-419 --books all`
 * writes. Skipped without the variable. The content is es-419_gl's (CC BY-SA 4.0) and unfoldingWord's originals
 * (CC BY-SA 4.0), named in each file. The conversion is the app's own (`src/resources/screenData.ts`).
 */
import 'fake-indexeddb/auto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { openPack } from '../resources/packs'
import { chapterData, GREEK, HEBREW, type BookSources } from '../resources/screenData'
import { openResourceStores } from '../resources/store'
import type { PrototypeData } from './data'

const folder = process.env.SERVOS_PAQUETES
const ORG = 'es-419_gl/es-419'

/**
 * Where each section begins, from the `\ts\*` markers of unfoldingWord's ULT (en_ult, master, read 2026-10-14): the
 * es-419 texts do not mark sections and the packs do not carry the ULT.
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

const sources = (original: BookSources['original']): BookSources => ({
  language: 'es-419',
  owner: ORG,
  literal: `${ORG}/glt`,
  simple: `${ORG}/gst`,
  notes: `${ORG}/tn`,
  questions: `${ORG}/tq`,
  wordLinks: `${ORG}/twl`,
  words: `${ORG}/tw`,
  academy: `${ORG}/ta`,
  original,
})

describe.skipIf(!folder)('datos del prototipo', () => {
  it('escribe todos los capítulos de Tito y Jonás desde los paquetes reales', async () => {
    const stores = openResourceStores({ cache: 'proto-cache', catalog: 'proto-catalog' })
    for (const file of ['originals', 'es-419']) {
      await openPack(stores, readFileSync(join(folder!, `${file}.langpack.zip`)))
    }
    // One file a chapter, `{book}-{chapter}.json`, without spaces: seven chapters go into the one-page prototype.
    const write = (data: PrototypeData) => writeFileSync(join(__dirname, 'data', `${data.book.id}-${data.chapter}.json`), JSON.stringify(data) + '\n')
    for (const chapter of [1, 2, 3]) write(await chapterData(stores, sources(GREEK), 'tit', chapter, { sections: SECTION_STARTS[`tit ${chapter}`] }))
    // Jonah 2 is a poem (Jonah's prayer): the editor's lines are tried on it.
    for (const chapter of [1, 2, 3, 4]) write(await chapterData(stores, sources(HEBREW), 'jon', chapter, { sections: SECTION_STARTS[`jon ${chapter}`] }))
  }, 600_000)
})
