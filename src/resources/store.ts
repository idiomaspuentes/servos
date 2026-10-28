/**
 * Where Servos keeps translation resources: tc-study's IndexedDB stores, with tc-study's cache keys (design, section 7),
 * under Servos's own database names. A language pack opens straight into them.
 */

import { IndexedDBByteStore, IndexedDBCacheAdapter } from '@bt-synergy/cache-adapter-indexeddb'
import { IndexedDBCatalogAdapter } from '@bt-synergy/catalog-adapter-indexeddb'
import { USJ_PROCESSING_VERSION } from '@bt-synergy/usj-processor'
import { REGISTER_PREFIX, readRegister, stagingFrom, type PackVersions, type PartsStaging, type Register } from '@bt-synergy/language-pack'
import { HELPS_ALIGN_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsAlignCache'
import { HELPS_TEXT_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsCacheKeys'
import { HELPS_QUOTE_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsQuoteCache'
import { SCRIPTURE_PREPARE_VERSION } from '@bt-synergy/resource-pipeline/scripture/scripturePreparer'

export interface ResourceStores {
  cache: IndexedDBCacheAdapter
  catalog: IndexedDBCatalogAdapter
  /** The cache's database, for reading keys without their rows (`keysUnder`). */
  cacheName?: string
}

const CACHE_STORE = 'cache-entries'

export function openResourceStores(names: { cache?: string; catalog?: string } = {}): ResourceStores {
  const cacheName = names.cache ?? 'servos-recursos'
  return {
    cache: new IndexedDBCacheAdapter({ dbName: cacheName, storeName: CACHE_STORE, version: 1 }),
    catalog: new IndexedDBCatalogAdapter({ dbName: names.catalog ?? 'servos-catalogo', storeName: 'catalog-entries' }),
    cacheName,
  }
}

/**
 * Where downloaded parts wait, verified, until `applyParts` puts them into the stores: a database of their own, so
 * megabytes of waiting bytes never sit among the resource rows.
 */
export function openPartsStaging(name = 'servos-partes'): PartsStaging {
  return stagingFrom(new IndexedDBByteStore({ dbName: name }))
}

/** What the device holds of the parts lists: which part fills each slot (the register rows live among the resources). */
export async function readPartsRegister(stores: ResourceStores): Promise<Register> {
  return readRegister(await stores.cache.getByPrefix(REGISTER_PREFIX))
}

/**
 * The keys of the rows under a prefix, without reading the rows: which books a resource has is in its keys, and its
 * rows weigh megabytes (es-419's literal text is 6 MB). The adapter opens the database first, so it is never created
 * here without its store.
 */
export async function keysUnder(stores: ResourceStores, prefix: string, limit?: number): Promise<string[]> {
  if (!stores.cacheName) return (await stores.cache.getByPrefix(prefix)).map((r) => r.key)
  await stores.cache.hasRawKeys(['servos:abrir'])
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(stores.cacheName!)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const request = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).getAllKeys(IDBKeyRange.bound(prefix, `${prefix}\uffff`), limit)
      request.onsuccess = () => resolve(request.result as string[])
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/**
 * The processing versions of the code Servos reads with; a pack made with other source versions is refused. Servos
 * reads the prepared chapters without making them (tc-study can make them again from the source), so their version
 * counts too.
 */
export const RESOURCE_VERSIONS: PackVersions = {
  sot: { usjProcessing: USJ_PROCESSING_VERSION },
  prepared: { scripturePrepare: SCRIPTURE_PREPARE_VERSION },
  quote: { helpsQuote: HELPS_QUOTE_VERSION },
  align: { helpsAlign: HELPS_ALIGN_VERSION },
  text: { helpsText: HELPS_TEXT_VERSION },
}
