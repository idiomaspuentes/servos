/**
 * Who the texts and helps on this device are by, and under what license, for «Acerca de Servos»: CC BY-SA asks to
 * name the title, the author, the work it was made from and the license. Read from each resource's catalog row, which
 * its pack brought: `license` (every Door43 release has it) and, in packs made since bt-synergy keeps it,
 * `attribution` (its manifest's `dublin_core`: publisher, creator, sources). An older pack has no author: its owner
 * in the catalog is said instead, never a name the app made up (philosophy, principle 8).
 */

import type { ResourceStores } from './store'

/** One line of the credits: the resources with the same author, sources and license, in the order they came. */
export interface Credit {
  /** Their titles, as their releases name them («Texto Puente Literal»). */
  titles: string[]
  /** Who publishes them («Idiomas Puentes»), or their owner in the catalog (`es-419_gl`) when the pack does not say. */
  by: string
  /** Whose work they were made from, besides `by` («unfoldingWord», «United Bible Societies»). */
  basedOn: string[]
  /** «CC BY-SA 4.0», or null when the pack does not say. */
  license: string | null
  keys: string[]
}

type Row = Record<string, unknown>
/** A title the app gives a resource instead of its release's (a lexicon is titled by its language alone). */
export type TitleOf = (key: string, row: Row) => string | undefined

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** The credit of one catalog row, before rows that say the same are put together. */
function creditOf(key: string, row: Row, titleOf?: TitleOf): Omit<Credit, 'titles' | 'keys'> & { title: string } {
  const attribution = (row.attribution ?? {}) as { publisher?: unknown; creator?: unknown; rights?: unknown; sources?: Array<{ owner?: unknown }> }
  const owner = text(row.owner) ?? key.split('/')[0]
  const publisher = text(attribution.publisher)
  const by = publisher ?? owner
  const basedOn = [
    ...(attribution.sources ?? []).map((s) => text(s.owner)),
    // The creator is who made the work, when it is not who publishes it (the lexicons: the United Bible Societies).
    text(attribution.creator),
  ].filter((name): name is string => Boolean(name) && name !== by)
  const license = text((row.license as { id?: unknown } | undefined)?.id) ?? text(attribution.rights) ?? null
  return { title: titleOf?.(key, row) ?? text(row.title) ?? key, by, basedOn: [...new Set(basedOn)], license }
}

/** The credits of the given catalog rows (`[key, row]`), the resources with the same author and license together. */
export function creditsOf(rows: Array<[string, Row]>, titleOf?: TitleOf): Credit[] {
  const out: Credit[] = []
  for (const [key, row] of rows) {
    const { title, ...credit } = creditOf(key, row, titleOf)
    const same = out.find((c) => c.by === credit.by && c.license === credit.license && c.basedOn.join('|') === credit.basedOn.join('|'))
    if (same) {
      if (!same.titles.includes(title)) same.titles.push(title)
      same.keys.push(key)
    } else out.push({ ...credit, titles: [title], keys: [key] })
  }
  return out
}

/** The originals' languages: what is read beside them (MACULA) goes with them, after the language's own resources. */
const ORIGINAL_LANGUAGES = new Set(['hbo', 'el-x-koine'])

/** The credits of every resource on this device: the languages' own first, then the originals', each in key order. */
export async function creditsOnDevice(stores: ResourceStores, titleOf?: TitleOf): Promise<Credit[]> {
  const rows: Array<[string, Row]> = []
  const original = (key: string) => (ORIGINAL_LANGUAGES.has(key.split('/')[1] ?? '') ? 1 : 0)
  for (const key of (await stores.catalog.getAll()).sort((a, b) => original(a) - original(b) || a.localeCompare(b))) {
    const row = await stores.catalog.get(key)
    if (row) rows.push([key, row])
  }
  return creditsOf(rows, titleOf)
}
