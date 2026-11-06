import {
  createClient,
  httpSource,
  indexedDbStore,
  type BlobStore,
  type LanguagePackClient,
  type PackReader,
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
  // `index` (the search index) arrives with the search task; until then the reader builds one in memory.
  return createClient({ store, source, trust: { trustedKeys: deps.trustedKeys ?? trustedKeys() } })
}

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

/** Drops the cached readers; call it after any install or import. */
export function forgetReadersV3(): void {
  readers.clear()
}

/** For tests: forgets the client and the readers, as a new app run would. */
export function resetPacksV3(): void {
  client = null
  readers.clear()
}
