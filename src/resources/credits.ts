/**
 * Who the texts and helps on this device are by, and under what license, for «Acerca de Servos»: CC BY-SA asks to
 * name the title, the author, the work it was made from and the license. Read from each resource's catalog row, which
 * its pack brought: `license` (every Door43 release has it) and, in packs made since bt-synergy keeps it,
 * `attribution` (its manifest's `dublin_core`: publisher, creator, sources). An older pack has no author: its owner
 * in the catalog is said instead, never a name the app made up (philosophy, principle 8).
 *
 * Format 3 packs keep no rows: their catalogs list the resources (title, subject, license, and for some `rights` and
 * `attribution`, a credit sentence said as it came). They are read too (`creditsOnDevice`'s `v3`), each key once: a
 * resource that also has a row is credited from its row, which says more.
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
  /** What a format 3 catalog says besides (its `rights` and `attribution`), as it came: the credit some sources ask for. */
  notes: string[]
  keys: string[]
}

type Row = Record<string, unknown>
/** A title the app gives a resource instead of its release's (a lexicon is titled by its language alone). */
export type TitleOf = (key: string, row: Row) => string | undefined

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** A license as people read it: format 3 catalogs say `CC-BY-SA-4.0`, format 2.0 rows `CC BY-SA 4.0`. */
const licenseText = (id: string): string => /^CC-([A-Z]+(?:-[A-Z]+)*)-(\d+(?:\.\d+)?)$/i.exec(id)?.slice(1).reduce((cc, p) => `${cc} ${p}`, 'CC') ?? id

/** A resource a format 3 catalog lists (`CatalogResource` of `language-pack-v3`, what credits read of it). */
export type ResourceV3 = { key: string; title: string; subject: string; license: string; rights?: string; attribution?: string }

/** A format 3 resource as a row: its owner is its key's first part; its credit sentence is kept apart (`credit`). */
const rowOfV3 = (r: ResourceV3): Row => ({
  owner: r.key.split('/')[0],
  title: r.title,
  subject: r.subject,
  license: { id: r.license },
  ...(r.rights !== undefined ? { rights: r.rights } : {}),
  ...(r.attribution !== undefined ? { credit: r.attribution } : {}),
})

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
  const id = text((row.license as { id?: unknown } | undefined)?.id) ?? text(attribution.rights)
  const license = id === undefined ? null : licenseText(id)
  const rights = text(row.rights)
  const notes = [rights !== undefined && licenseText(rights) !== license ? rights : undefined, text(row.credit)].filter((n): n is string => n !== undefined)
  return { title: titleOf?.(key, row) ?? text(row.title) ?? key, by, basedOn: [...new Set(basedOn)], license, notes }
}

/** The credits of the given catalog rows (`[key, row]`), the resources with the same author and license together. */
export function creditsOf(rows: Array<[string, Row]>, titleOf?: TitleOf): Credit[] {
  const out: Credit[] = []
  for (const [key, row] of rows) {
    const { title, ...credit } = creditOf(key, row, titleOf)
    const same = out.find(
      (c) => c.by === credit.by && c.license === credit.license && c.basedOn.join('|') === credit.basedOn.join('|') && c.notes.join('|') === credit.notes.join('|'),
    )
    if (same) {
      if (!same.titles.includes(title)) same.titles.push(title)
      same.keys.push(key)
    } else out.push({ ...credit, titles: [title], keys: [key] })
  }
  return out
}

/** The originals' languages: what is read beside them (MACULA) goes with them, after the language's own resources. */
const ORIGINAL_LANGUAGES = new Set(['hbo', 'el-x-koine'])

/**
 * The credits of every resource on this device: the languages' own first, then the originals', each in key order.
 * `v3`: the resources of the format 3 catalogs installed here; a key that has a row too is credited once, from the row.
 */
export async function creditsOnDevice(stores: ResourceStores, titleOf?: TitleOf, v3: readonly ResourceV3[] = []): Promise<Credit[]> {
  const rows = new Map<string, Row>()
  for (const key of await stores.catalog.getAll()) {
    const row = await stores.catalog.get(key)
    if (row) rows.set(key, row)
  }
  for (const r of v3) if (!rows.has(r.key)) rows.set(r.key, rowOfV3(r))
  const original = (key: string) => (ORIGINAL_LANGUAGES.has(key.split('/')[1] ?? '') ? 1 : 0)
  const keys = [...rows.keys()].sort((a, b) => original(a) - original(b) || a.localeCompare(b))
  return creditsOf(
    keys.map((key) => [key, rows.get(key)!]),
    titleOf,
  )
}
