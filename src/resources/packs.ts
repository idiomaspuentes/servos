/**
 * Opening a translation-resource package (a `@bt-synergy/language-pack` zip) into Servos's stores. The app first shows
 * what a pack brings (design, section 7: "al importar, la app dice qué trae"), then opens it.
 */

import {
  importLanguagePack,
  packTargetFrom,
  readPackManifest,
  type ImportPackResult,
  type PackManifest,
} from '@bt-synergy/language-pack'
import { RESOURCE_VERSIONS, type ResourceStores } from './store'

export interface PackSummary {
  kind: NonNullable<PackManifest['kind']>
  language: string
  books: string[]
  resources: Array<{ key: string; title: string; isOriginal: boolean; books: string[] }>
  /** Originals the pack's quotes were built against. */
  needs: Array<{ key: string; stamp: string }>
  createdAt: string
}

/** What a pack brings, without opening its rows. Throws with a message for people when the file is not a pack. */
export async function describePack(bytes: Uint8Array | ArrayBuffer): Promise<PackSummary> {
  const manifest = await readPackManifest(bytes)
  return {
    kind: manifest.kind ?? 'language',
    language: manifest.language,
    books: manifest.books ?? [],
    resources: manifest.resources.map((r) => ({
      key: r.key,
      title: r.title ?? r.key,
      isOriginal: r.role === 'original',
      books: r.books ?? [],
    })),
    needs: manifest.requires ?? [],
    createdAt: manifest.createdAt,
  }
}

/** Opens a pack: catalog rows, then each resource's rows, receipts last. What the device has stays unless replaced. */
export async function openPack(stores: ResourceStores, bytes: Uint8Array | ArrayBuffer): Promise<ImportPackResult> {
  return importLanguagePack({
    bytes,
    target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
    versions: RESOURCE_VERSIONS,
  })
}
