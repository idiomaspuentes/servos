/**
 * What MACULA (Biblica, CC BY 4.0) says of the original, as Taller serves it (`public/trees`, `public/referents`,
 * built by its `scripts/build-trees.mts` and `scripts/build-referents.mts`): one small file a book. From this device
 * first (the originals' pack carries it, read when a book opens, `src/resources/library.ts`), else the example's
 * Jonah and Titus, bundled in the app.
 */

import { normalizeReferentFile, type ReferentFile } from '../original/referents'
import { normalizeTreeFile, type TreeFile } from '../original/syntaxTree'

const trees = import.meta.glob<unknown>('./original/trees/*.json', { eager: true, import: 'default' })
const referents = import.meta.glob<unknown>('./original/referents/*.json', { eager: true, import: 'default' })

const cache = new Map<string, TreeFile | ReferentFile | null>()
/** Read from this device, by book: they are read before the example's. */
const device = new Map<string, { trees: TreeFile | null; referents: ReferentFile | null }>()

/** Keeps what MACULA says of a book, read from this device. */
export function keepMacula(book: string, found: { trees: TreeFile | null; referents: ReferentFile | null }) {
  device.set(book.toUpperCase(), found)
}

/** The sentences of a book as syntax trees, or null when neither this device nor the example has them. */
export function treesOf(book: string): TreeFile | null {
  const code = book.toUpperCase()
  const here = device.get(code)?.trees
  if (here) return here
  const key = `trees:${code}`
  if (!cache.has(key)) cache.set(key, normalizeTreeFile(trees[`./original/trees/${code}.json`]))
  return cache.get(key) as TreeFile | null
}

/** Whom the words of a book point to, or null when neither this device nor the example has it. */
export function referentFileOf(book: string): ReferentFile | null {
  const code = book.toUpperCase()
  const here = device.get(code)?.referents
  if (here) return here
  const key = `referents:${code}`
  if (!cache.has(key)) cache.set(key, normalizeReferentFile(referents[`./original/referents/${code}.json`]))
  return cache.get(key) as ReferentFile | null
}
