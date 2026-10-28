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
import { keepHelpsChanges as realKeepHelpsChanges, watchHelps as realWatchHelps, type BookChanges } from './helpsWatch'
import { refreshLibrary as realRefreshLibrary } from './library'

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
