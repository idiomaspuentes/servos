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
  type TrustPolicy,
  type VerifiedCatalog,
  type Want,
} from '@bt-synergy/language-pack-client'
import { V3_ORIGINS } from '../online/packsServer'
import { trustedKeys } from './keys'

/** The format 3 database. The format 2.0 ones (`servos-recursos`, `servos-catalogo`, ...) are never opened from here. */
export const STORE_NAME_V3 = 'servos-paquetes-v3'

export type ClientDeps = {
  /** Tests inject a `fetch`; the app uses the browser's. */
  fetch?: typeof fetch
  store?: BlobStore
  base?: string
  trustedKeys?: Record<string, Uint8Array>
}

/** A client for format 3 packs. `packsV3` is the one the app uses; this takes its parts so a test can give its own. */
export async function createPacksV3(deps: ClientDeps = {}): Promise<LanguagePackClient> {
  const store = deps.store ?? (await indexedDbStore({ name: STORE_NAME_V3 }))
  const source = httpSource({ base: deps.base ?? V3_ORIGINS.staging, ...(deps.fetch ? { fetch: deps.fetch } : {}) })
  const trust = { trustedKeys: deps.trustedKeys ?? trustedKeys() }
  // `index` (the search index) arrives with the search task; until then the reader builds one in memory.
  const made = createClient({ store, source, trust })
  parts.set(made, { store, trust })
  return made
}

/** Each client's store and trust: the catalogs' resources (titles, licenses) are read from the stored catalog files. */
const parts = new WeakMap<LanguagePackClient, { store: BlobStore; trust: TrustPolicy }>()

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
 * segments not in the store, with what the units need (`planInstall`, as `install` plans it). `want` may be made from
 * the keys of every unit the catalogs list (also returned as `units`). Null when no catalog of the language is kept.
 */
export async function planV3(
  client: LanguagePackClient,
  lang: string,
  want: Want | ((units: string[]) => Want),
): Promise<{ bytes: number; unknown: string[]; units: string[] } | null> {
  const own = parts.get(client)
  const state = (await own?.store.getState()) as InstalledState | undefined
  const entry = state?.published[state.aliases?.[lang] ?? lang]
  if (!own || !state || !entry) return null
  const catalogs = await catalogsFrom(own, entry.id)
  if (!catalogs.length) return null
  const units = catalogs.flatMap((cat) => cat.catalog.units.map((u) => `${cat.name}/${u.id}`))
  const plan = planInstall(catalogs, state, typeof want === 'function' ? want(units) : want, new Set(await own.store.ids()))
  return { bytes: plan.bytes, unknown: plan.unknown, units }
}

/** Drops the cached readers; call it after any install or import. */
export function forgetReadersV3(): void {
  readers.clear()
}

/** For tests: forgets the client and the readers, as a new app run would. */
export function resetPacksV3(): void {
  client = null
  readers.clear()
}
