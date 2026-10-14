/**
 * Where Servos keeps translation resources: tc-study's IndexedDB stores, with tc-study's cache keys (design, section 7),
 * under Servos's own database names. A language pack opens straight into them.
 */

import { IndexedDBCacheAdapter } from '@bt-synergy/cache-adapter-indexeddb'
import { IndexedDBCatalogAdapter } from '@bt-synergy/catalog-adapter-indexeddb'
import { USJ_PROCESSING_VERSION } from '@bt-synergy/usj-processor'
import type { PackVersions } from '@bt-synergy/language-pack'
import { HELPS_ALIGN_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsAlignCache'
import { HELPS_TEXT_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsCacheKeys'
import { HELPS_QUOTE_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsQuoteCache'

export interface ResourceStores {
  cache: IndexedDBCacheAdapter
  catalog: IndexedDBCatalogAdapter
}

export function openResourceStores(names: { cache?: string; catalog?: string } = {}): ResourceStores {
  return {
    cache: new IndexedDBCacheAdapter({ dbName: names.cache ?? 'servos-recursos', storeName: 'cache-entries', version: 1 }),
    catalog: new IndexedDBCatalogAdapter({ dbName: names.catalog ?? 'servos-catalogo', storeName: 'catalog-entries' }),
  }
}

/** The processing versions of the code Servos reads with; a pack made with other source versions is refused. */
export const RESOURCE_VERSIONS: PackVersions = {
  sot: { usjProcessing: USJ_PROCESSING_VERSION },
  quote: { helpsQuote: HELPS_QUOTE_VERSION },
  align: { helpsAlign: HELPS_ALIGN_VERSION },
  text: { helpsText: HELPS_TEXT_VERSION },
}
