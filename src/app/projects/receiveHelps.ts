/**
 * Receiving a pack of texts and helps, with what it changed in the verses already translated (design §7, «Qué cambió
 * en lo ya traducido»): what they read is read before the pack writes over it, the pack opened, the library read
 * again, and what changed kept. All four hold the lock against Servos online's applies (`onlineLock.ts`), so no
 * downloaded parts land between the reading before and the opening, and none is counted as the pack's change.
 */

import type { ImportPackResult } from '@bt-synergy/language-pack'
import { whileOnlineIdle } from '../../resources/online/onlineLock'
import { openPack as realOpenPack } from '../../resources/packs'
import type { ResourceStores } from '../../resources/store'
import { importOldPackV3 as realImportOldPackV3, importTransferV3 as realImportTransferV3, type FileOutcome } from '../../resources/v3/filesV3'
import {
  keepHelpsChanges as realKeepHelpsChanges,
  keepHelpsChangesV3 as realKeepHelpsChangesV3,
  watchHelps as realWatchHelps,
  watchHelpsV3 as realWatchHelpsV3,
  type BookChanges,
  type Watched,
} from './helpsWatch'
import { refreshLibrary as realRefreshLibrary } from './library'
import { loadProjects } from './model'

export type ReceiveDeps = {
  watchHelps: typeof realWatchHelps
  openPack: typeof realOpenPack
  refreshLibrary: typeof realRefreshLibrary
  keepHelpsChanges: typeof realKeepHelpsChanges
}

const REAL: ReceiveDeps = {
  watchHelps: realWatchHelps,
  openPack: realOpenPack,
  refreshLibrary: realRefreshLibrary,
  keepHelpsChanges: realKeepHelpsChanges,
}

/**
 * Opens a received pack and says what it changed. `replace` names what it takes the place of (`packAgainstDevice`);
 * with nothing replaced nothing translated changes, and nothing is read before. Given as a function, it is decided
 * inside the section, from the device as an online apply that landed while the summary was open left it. Throws
 * what opening the pack throws.
 */
export function openPackSeeingChanges(
  stores: ResourceStores,
  bytes: Uint8Array | ArrayBuffer,
  pack: {
    language: string
    books: string[]
    replace: readonly string[] | (() => readonly string[])
    file?: string
    onProgress?: (done: number, total: number) => void
  },
  deps: ReceiveDeps = REAL,
): Promise<{ result: ImportPackResult; changed: BookChanges[] }> {
  return whileOnlineIdle(async (held) => {
    const replace = typeof pack.replace === 'function' ? pack.replace() : pack.replace
    const watched = replace.length ? await deps.watchHelps(stores, pack.language, pack.books).catch(() => []) : []
    const result = await deps.openPack(stores, bytes, { replace, file: pack.file, onProgress: pack.onProgress, held })
    await deps.refreshLibrary()
    const changed = watched.length ? await deps.keepHelpsChanges(stores, pack.language, watched).catch((): BookChanges[] => []) : []
    return { result, changed }
  })
}

export type ReceiveV3Deps = {
  watchHelpsV3: typeof realWatchHelpsV3
  importOldPackV3: (bytes: Uint8Array) => Promise<FileOutcome>
  importTransferV3: (bytes: Uint8Array) => Promise<FileOutcome>
  refreshLibrary: typeof realRefreshLibrary
  keepHelpsChangesV3: typeof realKeepHelpsChangesV3
}

const REAL_V3: ReceiveV3Deps = {
  watchHelpsV3: realWatchHelpsV3,
  importOldPackV3: (bytes) => realImportOldPackV3(bytes),
  importTransferV3: (bytes) => realImportTransferV3(bytes),
  refreshLibrary: realRefreshLibrary,
  keepHelpsChangesV3: realKeepHelpsChangesV3,
}

/** Every project's helps language with its books: what a transfer file may bring is known only once it is imported. */
function everyProjectBook(): { language: string; books: string[] }[] {
  const by = new Map<string, Set<string>>()
  for (const p of loadProjects()) {
    if (!p.helpsLanguage) continue
    const books = by.get(p.helpsLanguage) ?? new Set<string>()
    for (const b of p.books) books.add(b.code)
    by.set(p.helpsLanguage, books)
  }
  return [...by].map(([language, books]) => ({ language, books: [...books] }))
}

/**
 * Format 3: receives a file and says what it changed in the verses already translated. `.langpack.zip` (`oldPack`)
 * goes through `importOldPack`, a `.tcpack` through `importTransfer`. As with a pack of format 2.0, the helps are read
 * before, the file imported, the library read again and what changed kept, all under the lock against Servos online
 * (format 3 installs are applies too, `onlineResources.ts`), so a download landing in between is not counted as the
 * file's change. `watch` names the language and books an old pack brings; a transfer file watches every project's.
 */
export function receiveFileV3(
  bytes: Uint8Array,
  file: { kind: 'oldPack'; language: string; books: readonly string[] } | { kind: 'transfer' },
  deps: ReceiveV3Deps = REAL_V3,
): Promise<{ outcome: FileOutcome; changed: BookChanges[] }> {
  return whileOnlineIdle(async () => {
    const watch = file.kind === 'oldPack' ? [{ language: file.language, books: [...file.books] }] : everyProjectBook()
    const watched: { language: string; watched: Watched[] }[] = []
    for (const w of watch) {
      if (!w.books.length) continue
      const seen = await deps.watchHelpsV3(w.language, w.books).catch((): Watched[] => [])
      if (seen.length) watched.push({ language: w.language, watched: seen })
    }
    const outcome = file.kind === 'oldPack' ? await deps.importOldPackV3(bytes) : await deps.importTransferV3(bytes)
    if (outcome.state !== 'added') return { outcome, changed: [] }
    await deps.refreshLibrary()
    const changed: BookChanges[] = []
    for (const w of watched) changed.push(...(await deps.keepHelpsChangesV3(w.language, w.watched).catch((): BookChanges[] => [])))
    return { outcome, changed }
  })
}
