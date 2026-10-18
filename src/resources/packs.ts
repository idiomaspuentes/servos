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
  resources: Array<{ key: string; title: string; subject: string; isOriginal: boolean; books: string[] }>
  /** Originals the pack's quotes were built against. */
  needs: Array<{ key: string; stamp: string }>
  createdAt: string
  /**
   * Its texts were processed by another version of the code than this app reads with: opening it is refused
   * (`importLanguagePack`), so it is said before, in the app's words.
   */
  otherVersion: boolean
}

/**
 * Whether a pack's texts were made by another version of the code than Servos reads with: its source, its prepared
 * chapters (a pack that does not say their version was made before packs said it), or its aligned helps.
 */
function madeForOtherVersion(versions: PackManifest['versions']): boolean {
  const usj = versions?.sot?.usjProcessing
  const align = versions?.align?.helpsAlign
  return (
    Boolean(usj && usj !== RESOURCE_VERSIONS.sot?.usjProcessing) ||
    versions?.prepared?.scripturePrepare !== RESOURCE_VERSIONS.prepared?.scripturePrepare ||
    Boolean(align && align !== RESOURCE_VERSIONS.align?.helpsAlign)
  )
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
      subject: r.subject ?? '',
      isOriginal: r.role === 'original',
      books: r.books ?? [],
    })),
    needs: manifest.requires ?? [],
    createdAt: manifest.createdAt,
    otherVersion: madeForOtherVersion(manifest.versions),
  }
}

/**
 * Opens a pack: catalog rows, then each resource's rows, receipts last. What the device has stays unless replaced:
 * `replace` when the device's copy was made for an earlier version of the app (`ResourceHere.stale`). Its rows have
 * the same keys as the pack's, and kept they would stay unreadable.
 */
export async function openPack(stores: ResourceStores, bytes: Uint8Array | ArrayBuffer, options: { replace?: boolean } = {}): Promise<ImportPackResult> {
  return importLanguagePack({
    bytes,
    target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
    versions: RESOURCE_VERSIONS,
    overwrite: options.replace ?? false,
  })
}
