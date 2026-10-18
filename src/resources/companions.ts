/**
 * What Servos reads beside tc-study's resources, as the packs carry it (bt-synergy's prepare-language CLI,
 * `companions.ts`): the lexicons of a language, one entry a Strong number (`{key}/content/{number}.json`), and what
 * MACULA says of the originals, one file a book (`{key}/trees/{BOOK}`, `{key}/referents/{BOOK}`).
 */

import { normalizeLexiconFile, type LexiconFile } from '../lexicon/lexicon'
import { normalizeReferentFile, type ReferentFile } from '../original/referents'
import { normalizeTreeFile, type TreeFile } from '../original/syntaxTree'
import type { ResourceStores } from './store'

/** The subjects the packs give the lexicons, by the original they explain. */
export const LEXICON_SUBJECTS = { hebrew: 'Hebrew Lexicon', greek: 'Greek Lexicon' } as const

/** MACULA's resources, by the original they explain. */
export const MACULA = { hebrew: 'Biblica/hbo/macula', greek: 'Biblica/el-x-koine/macula' } as const

/** A lexicon's entry for a Strong number (`H7121` → 7121), or null when this device does not have it. */
export async function readLexiconEntry(stores: ResourceStores, lexiconKey: string, number: number): Promise<LexiconFile | null> {
  return normalizeLexiconFile(await stores.cache.get(`${lexiconKey}/content/${number}.json`))
}

/** What MACULA says of a book: its sentences and its referents, each null when this device does not have it. */
export async function readMacula(stores: ResourceStores, maculaKey: string, book: string): Promise<{ trees: TreeFile | null; referents: ReferentFile | null }> {
  const code = book.toUpperCase()
  return {
    trees: normalizeTreeFile(await stores.cache.get(`${maculaKey}/trees/${code}`)),
    referents: normalizeReferentFile(await stores.cache.get(`${maculaKey}/referents/${code}`)),
  }
}
