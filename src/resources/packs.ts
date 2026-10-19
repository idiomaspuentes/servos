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
  /** Its resources, with their release (`stamp`) and the books their release has. */
  resources: Array<{ key: string; title: string; subject: string; isOriginal: boolean; stamp: string; books: string[] }>
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
      stamp: r.stamp,
      books: r.books ?? [],
    })),
    needs: manifest.requires ?? [],
    createdAt: manifest.createdAt,
    otherVersion: madeForOtherVersion(manifest.versions),
  }
}

const OPENING = 'servos.paquete.abriendo'

/** The packs whose opening did not end (the app closed, the phone went off), and their resources. */
export interface Opening {
  files: string[]
  keys: string[]
}

export function openingLeft(): Opening | null {
  try {
    const raw = localStorage.getItem(OPENING)
    return raw ? (JSON.parse(raw) as Opening) : null
  } catch {
    return null
  }
}

function keepOpening(opening: Opening | null) {
  try {
    if (opening && opening.keys.length) localStorage.setItem(OPENING, JSON.stringify(opening))
    else localStorage.removeItem(OPENING)
  } catch {
    /* without storage, an interrupted opening is not told */
  }
}

/**
 * Opens a pack: catalog rows, then each resource's rows, receipts last. What the device has stays unless replaced:
 * `replace` names the resources whose copy here the pack's takes the place of (`packAgainstDevice`): a newer release,
 * or a copy made for an earlier version of the app (`ResourceHere.stale`), whose rows have the same keys as the
 * pack's and kept would stay unreadable. A resource the device has in another release and not named stays as it is.
 *
 * Before writing, the pack and its resources are noted (`openingLeft`); when it ends they are crossed out. If the
 * app closes or the phone goes off halfway, the note stays: a resource whose receipt (written last) is not there is
 * then known as interrupted, and opening the same pack again fills what is missing.
 */
export async function openPack(
  stores: ResourceStores,
  bytes: Uint8Array | ArrayBuffer,
  options: { replace?: readonly string[]; file?: string; onProgress?: (done: number, total: number) => void } = {}
): Promise<ImportPackResult> {
  const keys = (await readPackManifest(bytes)).resources.map((r) => r.key)
  const before = openingLeft()
  keepOpening({
    files: [...new Set([...(before?.files ?? []), options.file ?? ''])].filter(Boolean),
    keys: [...new Set([...(before?.keys ?? []), ...keys])],
  })
  const result = await importLanguagePack({
    bytes,
    target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
    versions: RESOURCE_VERSIONS,
    overwrite: options.replace ?? false,
    onProgress: options.onProgress,
  })
  const now = openingLeft()
  const left = (now?.keys ?? []).filter((k) => !keys.includes(k))
  keepOpening(left.length ? { files: (now?.files ?? []).filter((f) => f !== options.file), keys: left } : null)
  return result
}
