/**
 * Opening a translation-resource package (a `@bt-synergy/language-pack` zip) into Servos's stores. The app first shows
 * what a pack brings (design, section 7: "al importar, la app dice qué trae"), then opens it.
 */

import {
  REGISTER_PREFIX,
  importLanguagePack,
  packTargetFrom,
  readPackManifest,
  type ImportPackResult,
  type PackManifest,
} from '@bt-synergy/language-pack'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { holdsOnlineLock, whileOnlineIdle, type HeldLock } from './online/onlineLock'
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
   * Its texts were processed by another version of the code than this app reads with. It agrees with
   * `importLanguagePack` on which layers differ, and Servos refuses the pack where the importer would throw (`sot`)
   * or drop the layer (`prepared`, `quote`, `align`, `text`): a pack with unreadable layers is worse than none. So it
   * is said before, in the app's words.
   */
  otherVersion: boolean
}

/**
 * Whether a pack was made by another version of the code than Servos reads with, in any of its layers (source,
 * prepared chapters, quotes, aligned helps, helps' text). It agrees with `importLanguagePack` on which layers
 * differ (the importer throws on `sot` and drops `prepared`, `quote`, `align` and `text`; Servos refuses the pack in
 * both cases, since a pack with unreadable layers is worse than none): each field this app knows is compared by
 * `String()`, and a layer or field the pack does not say is not other. The one exception is the prepared chapters'
 * version: a pack that does not say it was made before packs said it, so it counts as other.
 */
function madeForOtherVersion(versions: PackManifest['versions']): boolean {
  if (versions?.prepared?.scripturePrepare === undefined) return true
  for (const layer of Object.keys(RESOURCE_VERSIONS) as Array<keyof typeof RESOURCE_VERSIONS>) {
    const mine = RESOURCE_VERSIONS[layer]
    const theirs = versions?.[layer]
    if (!mine || !theirs) continue
    for (const field of Object.keys(mine)) {
      if (field in theirs && String(theirs[field]) !== String(mine[field])) return true
    }
  }
  return false
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
 * The slot kinds whose id names a book right after the resource (`kind:resource:book`, B's `slotId` in
 * `parts/partSlots.ts`): B's book kinds, and MACULA, whose parts go by book though its unit is shared. Every other
 * kind is shared: what follows its resource is a group.
 */
const BOOK_SLOT_KINDS = new Set(['book', 'alignments', 'original', 'macula'])

/** What a pack writes of each resource it brings: its books (null: all it has) and whether its shared rows too. */
type Brought = Map<string, { books: Set<string> | null; shared: boolean }>

/**
 * The resources a pack writes rows of, but those named in `left` (the importer leaves them as they are). A `book`
 * pack brings the books it names and no shared rows; any other brings each resource's books (its manifest says them
 * for a book-scoped resource of the language). When the manifest does not say the books (an original, which comes
 * whole, or a book pack that does not name them), all of them count. A resource with no rows in the pack (a `base`
 * pack's books) brings nothing.
 */
function broughtBy(manifest: PackManifest, left: ReadonlySet<string>): Brought {
  const brought: Brought = new Map()
  const bookPack = manifest.kind === 'book'
  for (const r of manifest.resources) {
    if (left.has(r.key) || !Object.values(r.rows).some((count) => (count ?? 0) > 0)) continue
    const books = bookPack ? manifest.books : r.books
    brought.set(r.key, { books: books ? new Set(books.map((b) => b.toLowerCase())) : null, shared: !bookPack })
  }
  return brought
}

/** Whether a slot holds rows of what the pack brings: a book it brings of its resource, or its resource's shared rows. */
function broughtSlot(slot: string, brought: Brought): boolean {
  const kind = slot.slice(0, slot.indexOf(':'))
  for (const [key, what] of brought) {
    const head = `${kind}:${key}`
    if (slot !== head && !slot.startsWith(`${head}:`)) continue
    if (!BOOK_SLOT_KINDS.has(kind)) return what.shared
    const book = slot.slice(head.length + 1).split(':')[0].toLowerCase()
    return !what.books || what.books.has(book)
  }
  return false
}

/**
 * Spec §3, «Paquetes de archivo y partes juntos»: the register forgets the slots of what a pack brings, in one
 * transaction. The next check sees them as missing and, online and with something different, downloads them again: it
 * costs bytes, but the device never believes it holds what it no longer holds.
 */
async function forgetSlots(stores: ResourceStores, brought: Brought): Promise<void> {
  if (!brought.size) return
  await stores.cache.transactRaw({ keys: [], prefixes: [REGISTER_PREFIX] }, (found) => ({
    puts: [],
    deletes: (found.prefixKeys.get(REGISTER_PREFIX) ?? []).filter((key) => broughtSlot(key.slice(REGISTER_PREFIX.length), brought)),
  }))
}

/**
 * The resources the importer will leave as they are: the device has them in another release and the pack is not told
 * to replace them (`importLanguagePack`'s own rule, read before it runs).
 */
async function keptByDevice(stores: ResourceStores, manifest: PackManifest, replace: readonly string[]): Promise<Set<string>> {
  const kept = new Set<string>()
  for (const r of manifest.resources) {
    if (replace.includes(r.key)) continue
    const mine = await stores.catalog.get(r.key)
    if (mine && resourceContentStamp(mine) !== r.stamp) kept.add(r.key)
  }
  return kept
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
 *
 * The parts register forgets the slots of the resources and books the pack writes (`forgetSlots`) before the first
 * row is written, so an opening cut halfway never leaves a slot claiming rows the pack wrote over; at worst the slot
 * is downloaded again. It forgets them once more when the import ends: a resource the importer took after all is the
 * pack's too, and so would be parts applied meanwhile. Servos online applies none then: the opening waits for an apply
 * in flight and holds new applies back (`whileOnlineIdle`), here, where every caller (ReceivePack, the packs inside
 * the app, a card or USB) goes through; a download goes on beside it. The second pass stays for a mispredicted skip,
 * and costs one read.
 *
 * A caller that already holds the lock for more than the opening (ReceivePack, around what changed) passes `held`:
 * the opening then runs inside that section instead of waiting for it to end.
 */
export async function openPack(
  stores: ResourceStores,
  bytes: Uint8Array | ArrayBuffer,
  options: { replace?: readonly string[]; file?: string; onProgress?: (done: number, total: number) => void; held?: HeldLock } = {}
): Promise<ImportPackResult> {
  if (holdsOnlineLock(options.held)) return openPackAlone(stores, bytes, options)
  return whileOnlineIdle(() => openPackAlone(stores, bytes, options))
}

async function openPackAlone(
  stores: ResourceStores,
  bytes: Uint8Array | ArrayBuffer,
  options: { replace?: readonly string[]; file?: string; onProgress?: (done: number, total: number) => void }
): Promise<ImportPackResult> {
  const manifest = await readPackManifest(bytes)
  const keys = manifest.resources.map((r) => r.key)
  const before = openingLeft()
  keepOpening({
    files: [...new Set([...(before?.files ?? []), options.file ?? ''])].filter(Boolean),
    keys: [...new Set([...(before?.keys ?? []), ...keys])],
  })
  await forgetSlots(stores, broughtBy(manifest, await keptByDevice(stores, manifest, options.replace ?? [])))
  const result = await importLanguagePack({
    bytes,
    target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
    versions: RESOURCE_VERSIONS,
    overwrite: options.replace ?? false,
    onProgress: options.onProgress,
  })
  await forgetSlots(stores, broughtBy(manifest, new Set(result.skippedResources.map((s) => s.key))))
  const now = openingLeft()
  const left = (now?.keys ?? []).filter((k) => !keys.includes(k))
  keepOpening(left.length ? { files: (now?.files ?? []).filter((f) => f !== options.file), keys: left } : null)
  return result
}
