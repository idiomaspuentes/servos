import {
  createClient,
  httpSource,
  indexedDbStore,
  planInstall,
  verifyCatalogFile,
  type BlobStore,
  type CatalogResource,
  type InstalledState,
  type LanguagePackClient,
  type PackReader,
  type SearchIndex,
  type TrustPolicy,
  type VerifiedCatalog,
  type Want,
} from '@bt-synergy/language-pack-client'
import { V3_ORIGINS } from '../online/packsServer'
import { trustedKeys } from './keys'
import { searchIndexV3 } from './search/searchIndex'

/** The format 3 database. The format 2.0 ones (`servos-recursos`, `servos-catalogo`, ...) are never opened from here. */
export const STORE_NAME_V3 = 'servos-paquetes-v3'

export type ClientDeps = {
  /** Tests inject a `fetch`; the app uses the browser's. */
  fetch?: typeof fetch
  store?: BlobStore
  base?: string
  trustedKeys?: Record<string, Uint8Array>
  /** The search index; `null` for none (the reader's memory index). Absent: the platform's (`searchIndexV3`). */
  index?: SearchIndex | null
}

/** A client for format 3 packs. `packsV3` is the one the app uses; this takes its parts so a test can give its own. */
export async function createPacksV3(deps: ClientDeps = {}): Promise<LanguagePackClient> {
  const store = deps.store ?? (await indexedDbStore({ name: STORE_NAME_V3 }))
  const source = httpSource({ base: deps.base ?? V3_ORIGINS.staging, ...(deps.fetch ? { fetch: deps.fetch } : {}) })
  const trust = { trustedKeys: deps.trustedKeys ?? trustedKeys() }
  // The full-text index the client keeps up to date on installs and imports (SQLite in the apps); none on the web,
  // where the reader builds one in memory on the first search.
  const index = deps.index === undefined ? searchIndexV3() : (deps.index ?? undefined)
  const made = createClient({ store, source, trust, ...(index ? { index } : {}) })
  parts.set(made, { store, trust, ...(index ? { index } : {}) })
  return made
}

/** Each client's store and trust: the catalogs' resources (titles, licenses) are read from the stored catalog files. */
const parts = new WeakMap<LanguagePackClient, { store: BlobStore; trust: TrustPolicy; index?: SearchIndex }>()

let client: Promise<LanguagePackClient> | null = null
const readers = new Map<string, Promise<PackReader | null>>()

/** The one format 3 client of this app run. `deps` only matter on the first call (tests). */
export function packsV3(deps?: ClientDeps): Promise<LanguagePackClient> {
  client ??= createPacksV3(deps).catch((e) => {
    client = null // a store that could not open is tried again next time
    throw e
  })
  return client
}

/**
 * The reader of a language, kept until `forgetReadersV3` (a reader is a snapshot of one `open()`). `null` when nothing
 * of the language is installed in format 3, so a caller can fall back to what it had.
 */
export function readerV3(lang: string): Promise<PackReader | null> {
  let reader = readers.get(lang)
  if (!reader) {
    reader = packsV3()
      .then(async (c) => {
        const st = await c.status(lang)
        return st.active ? c.open(lang) : null
      })
      .catch((e) => {
        readers.delete(lang) // not remembered: the next call tries again
        throw e
      })
    readers.set(lang, reader)
  }
  return reader
}

/** The languages with units active in format 3 on this device (not `common`, the originals' catalog). */
export async function languagesV3(): Promise<string[]> {
  const own = parts.get(await packsV3())
  const state = (await own?.store.getState()) as InstalledState | undefined
  return Object.keys(state?.active ?? {}).filter((name) => name !== 'common')
}

/** A catalog file of the store, checked again, and the catalogs it requires (by id); empty when it is not there. */
async function catalogsFrom(own: { store: BlobStore; trust: TrustPolicy }, id: string): Promise<VerifiedCatalog[]> {
  const read = async (at: string) => {
    const bytes = await own.store.get(at)
    return bytes ? verifyCatalogFile(bytes, own.trust, { from: 'store', expectedId: at }) : undefined
  }
  const first = await read(id)
  if (!first) return []
  const out = [first]
  for (const [, , rid] of first.catalog.requires ?? []) {
    const found = await read(Array.from(rid, (b) => b.toString(16).padStart(2, '0')).join(''))
    if (found) out.push(found)
  }
  return out
}

/**
 * The resources the active catalog of a language lists, and those of the catalogs it requires (the originals'), with
 * their titles and licenses. The reader does not give them. Empty when nothing of the language is active.
 */
export async function catalogResourcesV3(lang: string): Promise<CatalogResource[]> {
  const c = await packsV3()
  const own = parts.get(c)
  const active = (await c.status(lang)).active
  if (!own || !active) return []
  return (await catalogsFrom(own, active.id)).flatMap((cat) => cat.catalog.resources)
}

/**
 * What installing `want` from the newest catalog of a language (the one `refresh` kept) would fetch: the bytes of the
 * segments not in the store, with what the units need (`planInstall`, as `install` plans it). `units` are the keys of
 * every unit the catalogs list. Null when no catalog of the language is kept.
 */
export async function planV3(
  client: LanguagePackClient,
  lang: string,
  want: Want,
): Promise<{ bytes: number; unknown: string[]; units: string[] } | null> {
  const own = parts.get(client)
  const state = (await own?.store.getState()) as InstalledState | undefined
  const entry = state?.published[state.aliases?.[lang] ?? lang]
  if (!own || !state || !entry) return null
  const catalogs = await catalogsFrom(own, entry.id)
  if (!catalogs.length) return null
  const units = catalogs.flatMap((cat) => cat.catalog.units.map((u) => `${cat.name}/${u.id}`))
  const plan = planInstall(catalogs, state, want, new Set(await own.store.ids()))
  return { bytes: plan.bytes, unknown: plan.unknown, units }
}

/**
 * The books of a language that a search looks in (`searchable`): those active in format 3 and, when the client keeps a
 * SQL index, indexed in it. `notIndexed`: active, but not in the index (its indexing failed, or is still going on).
 * Without a SQL index (the web app) the reader's memory index takes every active book. Lowercase codes, in no order.
 */
export async function searchableBooksV3(lang: string): Promise<{ searchable: string[]; notIndexed: string[] }> {
  const out = { searchable: [] as string[], notIndexed: [] as string[] }
  const c = await packsV3()
  const own = parts.get(c)
  const state = (await own?.store.getState()) as InstalledState | undefined
  if (!own || !state) return out
  const name = state.aliases?.[lang] ?? lang
  for (const [key, unit] of Object.entries(state.units)) {
    if (!key.startsWith(`${name}/book:`)) continue
    const book = key.slice(`${name}/book:`.length)
    const segments = (unit as { segments?: string[] }).segments ?? []
    let indexed = !own.index || segments.length > 0
    if (own.index) for (const seg of segments) indexed &&= await own.index.has(seg).catch(() => false)
    out[indexed ? 'searchable' : 'notIndexed'].push(book)
  }
  return out
}

/** Drops the cached readers; call it after any install or import. */
export function forgetReadersV3(): void {
  readers.clear()
  readersChanged()
}

/**
 * The readers' generation: one more each time they are forgotten (an install, a refresh, a pack received). What asks
 * the readers (the lookups, search's books) follows it rather than the library's version, which moves at every chapter
 * read while a download is applied.
 */
let generation = 0
const readerListeners = new Set<() => void>()
function readersChanged() {
  generation++
  readerListeners.forEach((fn) => fn())
}
export const readersGenerationV3 = () => generation
/** For `useSyncExternalStore`. */
export function subscribeReadersV3(fn: () => void): () => void {
  readerListeners.add(fn)
  return () => void readerListeners.delete(fn)
}

/** For tests: forgets the client and the readers, as a new app run would. */
export function resetPacksV3(): void {
  client = null
  readers.clear()
  readersChanged()
}
