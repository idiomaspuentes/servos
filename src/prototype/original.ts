/**
 * What MACULA (Biblica, CC BY 4.0) says of the original, as Taller serves it (`public/trees`, `public/referents`,
 * built by its `scripts/build-trees.mts` and `scripts/build-referents.mts`): one small file a book. The prototype has
 * Jonah's and Titus's. Wired, the language pack of the originals carries them.
 */

import { normalizeReferentFile, type ReferentFile } from '../original/referents'
import { normalizeTreeFile, type TreeFile } from '../original/syntaxTree'

const trees = import.meta.glob<unknown>('./original/trees/*.json', { eager: true, import: 'default' })
const referents = import.meta.glob<unknown>('./original/referents/*.json', { eager: true, import: 'default' })

const cache = new Map<string, TreeFile | ReferentFile | null>()

/** The sentences of a book as syntax trees, or null when the prototype has none for it. */
export function treesOf(book: string): TreeFile | null {
  const key = `trees:${book.toUpperCase()}`
  if (!cache.has(key)) cache.set(key, normalizeTreeFile(trees[`./original/trees/${book.toUpperCase()}.json`]))
  return cache.get(key) as TreeFile | null
}

/** Whom the words of a book point to, or null when the prototype has none for it. */
export function referentFileOf(book: string): ReferentFile | null {
  const key = `referents:${book.toUpperCase()}`
  if (!cache.has(key)) cache.set(key, normalizeReferentFile(referents[`./original/referents/${book.toUpperCase()}.json`]))
  return cache.get(key) as ReferentFile | null
}
