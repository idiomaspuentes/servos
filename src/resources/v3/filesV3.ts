/**
 * Format 3 without a network (`packsFormat() === 3`): today's `.langpack.zip` files (SD card, USB, Bluetooth, the file
 * picker) become books through the client's `importOldPack`, and a book goes from one device to another as a transfer
 * file (`.tcpack`, `exportTransfer` / `importTransfer`). Here only the client calls and what their answers mean; the
 * lock and «qué cambió» are in `receiveHelps.ts`, the screen in `ReceivePack.tsx`.
 *
 * - A book pack is bridged with the rows of the originals: the originals pack inside the app for phones and computers,
 *   or else the last one the person received (kept in IndexedDB `servos-originales`, format 3 only). It is read only
 *   while a pack needs it and let go after: 23 MB is much for a 2 GB phone's WebView to hold all the time.
 * - An originals pack is only kept. Bridged by itself it makes an empty local catalog of the language it was made for
 *   (its manifest names one), which would only stand in the place of the published catalog's entry for nothing.
 * - Nothing is deleted: a failed import leaves what was here as it was (the client saves its state once, at the end).
 */

import type { ImportReport, LanguagePackClient } from '@bt-synergy/language-pack-client'
import { zipSource, type RowSource } from '@bt-synergy/language-pack-v3'
import { describePack } from '../packs'
import { packsV3 } from './client'

/** What receiving a file came to. */
export type FileOutcome =
  /** Imported: the books and whether articles became readable (none of either: the device had all of it already). */
  | { state: 'added'; language: string; books: string[]; articles: boolean }
  /** An originals pack, kept for the book packs that come after it. */
  | { state: 'originales' }
  /** A book pack and no originals on this device to build its books with: nothing was imported. */
  | { state: 'sinOriginales' }
  /** The device has a published (newer) catalog of the language: the old pack's texts are not used. */
  | { state: 'yaPublicado' }
  /** A transfer file whose catalog is not signed by a trusted key (a local one too): nothing was imported. */
  | { state: 'noConfiable' }
  /** The store would not take it: the state is the one before. */
  | { state: 'sinEspacio' }
  /** Not a pack, or one cut short so that nothing of it could be used. */
  | { state: 'noEsPaquete' }

export type FilesDeps = {
  client: () => Promise<LanguagePackClient>
  /** The rows of the originals, read now; null when this device has none. */
  originals: () => Promise<RowSource | null>
  /** Keeps a received originals pack (the newest one only). */
  keepOriginals: (bytes: Uint8Array, createdAt: string) => Promise<void>
}

const REAL: FilesDeps = {
  client: () => packsV3(),
  originals: () => originalsSource(),
  keepOriginals: (bytes, createdAt) => keepOriginals(bytes, createdAt),
}

// --- The originals ---

/** The packs inside the app (`packsInside` in vite.config.ts), as its index lists them. */
type Inside = { file: string; id: string }

/** The originals pack inside the app for phones and computers; null in the web app, or when it brings none. */
async function bundledOriginals(): Promise<Uint8Array | null> {
  const mode = import.meta.env.MODE
  if (mode !== 'telefono' && mode !== 'escritorio') return null
  const inside = ((await (await fetch('./paquetes/index.json')).json()) as { packs?: Inside[] }).packs ?? []
  const pack = inside.find((p) => p.file.startsWith('originals'))
  if (!pack) return null
  return new Uint8Array(await (await fetch(`./paquetes/${pack.file}`)).arrayBuffer())
}

const DB = 'servos-originales'
const STORE = 'paquete'
/** The pack's bytes and its `createdAt`, under two keys: whether one is here is asked without reading 23 MB. */
const BYTES = 'bytes'
const MADE = 'hecho'

function openKept(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function ask<T>(db: IDBDatabase, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = fn(db.transaction(STORE, 'readonly').objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withKept<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openKept()
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}

/** The originals pack received before, or null. */
export async function keptOriginals(): Promise<Uint8Array | null> {
  const bytes = await withKept((db) => ask<unknown>(db, (s) => s.get(BYTES)))
  return bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null
}

/**
 * Keeps a received originals pack for the book packs that come later, unless the one kept is as new or newer (by its
 * `createdAt`): only one is kept. Rejects when the device has no room for it.
 */
export async function keepOriginals(bytes: Uint8Array, createdAt: string): Promise<void> {
  await withKept(async (db) => {
    const made = await ask<unknown>(db, (s) => s.get(MADE))
    if (typeof made === 'string' && made >= createdAt) return
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(bytes, BYTES)
      tx.objectStore(STORE).put(createdAt, MADE)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('aborted'))
    })
  })
}

/** Whether this device has an originals pack to build books with, without reading it. */
export async function hasOriginals(): Promise<boolean> {
  const mode = import.meta.env.MODE
  if (mode === 'telefono' || mode === 'escritorio') {
    try {
      const inside = ((await (await fetch('./paquetes/index.json')).json()) as { packs?: Inside[] }).packs ?? []
      if (inside.some((p) => p.file.startsWith('originals'))) return true
    } catch {
      /* none inside: the kept one is asked */
    }
  }
  try {
    return (await withKept((db) => ask(db, (s) => s.count(MADE)))) > 0
  } catch {
    return false
  }
}

/**
 * The rows of the originals: the pack inside the app (phones and computers), else the originals pack the person
 * received before, else null. Read anew at each call; the caller lets it go once the pack is imported.
 */
export async function originalsSource(): Promise<RowSource | null> {
  const bytes = (await bundledOriginals().catch(() => null)) ?? (await keptOriginals().catch(() => null))
  return bytes ? zipSource(bytes) : null
}

// --- Importing and exporting ---

const codeOf = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined

/**
 * What an error of an import means. `E_SIGNATURE` and the file's own errors (`E_MAGIC`, `E_TRUNCATED`...) are
 * `FormatError`s of `language-pack-v3`; `E_ARG` is an old pack that is not one; a quota error is space. Anything else
 * (a bug) is thrown, and the screen says it as it says any error.
 */
function failed(e: unknown): FileOutcome {
  const code = codeOf(e)
  if (code === 'E_SIGNATURE') return { state: 'noConfiable' }
  if (code === 'E_STORE' || (e instanceof Error && e.name === 'QuotaExceededError')) return { state: 'sinEspacio' }
  if (code === 'E_DOWNGRADE') return { state: 'yaPublicado' }
  if (code?.startsWith('E_')) return { state: 'noEsPaquete' }
  throw e
}

/** The book a unit key names (`es-419/book:tit` → `tit`), or null. */
const bookOf = (key: string): string | null => /\/book:([^/]+)$/.exec(key)?.[1] ?? null

/**
 * An import's report, said: the books and articles that became readable. A cut file still gives its complete units
 * (the rest waits for a whole file); one of which no book or article could be used is said as no pack.
 */
function addedBy(report: ImportReport, language?: string): FileOutcome {
  const books = [...new Set(report.activated.flatMap((k) => bookOf(k) ?? []))]
  const articles = report.activated.some((k) => /\/art:/.test(k))
  if ((report.missing.length || report.rejected.length) && !books.length && !articles) return { state: 'noEsPaquete' }
  return { state: 'added', language: language ?? report.catalogs.find((c) => c.name !== 'common')?.name ?? '', books, articles }
}

/**
 * Imports a `.langpack.zip` of today's format. An originals pack is kept for later; a pack with books needs the
 * originals here (`sinOriginales` otherwise, and nothing is imported); a published catalog of its language here
 * wins (`yaPublicado`).
 */
export async function importOldPackV3(bytes: Uint8Array, deps: FilesDeps = REAL): Promise<FileOutcome> {
  let summary: Awaited<ReturnType<typeof describePack>>
  try {
    summary = await describePack(bytes)
  } catch {
    return { state: 'noEsPaquete' }
  }
  if (summary.kind === 'originals') {
    try {
      await deps.keepOriginals(bytes, summary.createdAt)
    } catch {
      return { state: 'sinEspacio' }
    }
    return { state: 'originales' }
  }
  // A book or language pack quotes the originals: without their rows its books are not built (only its map would be).
  const needsOriginals = summary.kind === 'book' || summary.needs.length > 0
  let originals: RowSource | null = null
  if (needsOriginals) {
    originals = await deps.originals().catch(() => null)
    if (!originals) return { state: 'sinOriginales' }
  }
  try {
    const report = await (await deps.client()).importOldPack(bytes, originals ? { originals } : {})
    if (report.skipped) return { state: 'yaPublicado' }
    return addedBy(report, summary.language)
  } catch (e) {
    return failed(e)
  }
}

/** Imports a transfer file (`.tcpack`). */
export async function importTransferV3(bytes: Uint8Array, deps: Pick<FilesDeps, 'client'> = REAL): Promise<FileOutcome> {
  try {
    return addedBy(await (await deps.client()).importTransfer(bytes))
  } catch (e) {
    return failed(e)
  }
}

/** A book with what it needs, as a transfer file (saved as `<lang>-<book>.tcpack`). */
export async function exportBookV3(lang: string, book: string, deps: Pick<FilesDeps, 'client'> = REAL): Promise<Uint8Array> {
  return (await deps.client()).exportTransfer({ lang, mode: 'full', books: [book.toLowerCase()] })
}

/** The name a book's transfer file is saved under. */
export const transferName = (lang: string, book: string) => `${lang}-${book.toLowerCase()}.tcpack`

/**
 * Whether a book can be passed as a transfer file: installed from a published catalog. A book made here from an old
 * pack is local (`status().units[].local`), which another device refuses (its signature cannot be checked) and an export
 * leaves out, so it is not offered, even when the language has a published catalog for its other books.
 */
export async function exportableV3(lang: string, book: string, deps: Pick<FilesDeps, 'client'> = REAL): Promise<boolean> {
  const status = await (await deps.client()).status(lang)
  if (status.published === undefined) return false
  return status.units.some((u) => u.installed && !u.local && u.key.endsWith(`/book:${book.toLowerCase()}`))
}
