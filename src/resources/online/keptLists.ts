/**
 * Where the languages' parts lists are kept on the device (for a 304, and for planning without internet): IndexedDB,
 * one row per language, in a small database of Servos online's own (`servos-enlinea`).
 *
 * Not localStorage: a list weighs about 250 KB (es-419 on staging, with its originals list 60 KB more), and
 * localStorage's few megabytes are shared with the team's work, whose write errors pass in silence. Not beside the
 * staged parts either: `servos-partes` is opened by bt-synergy's byte store at its own schema version, and a store
 * added there would have to be kept in step with it.
 *
 * `onlineResources.ts` reads every row once when it starts and writes each change through; nothing here throws to a
 * caller that does not await it.
 */

import type { KeptList } from './planLanguage'

export type KeptStore = {
  /** Every kept list, by language. */
  all(): Promise<Record<string, KeptList>>
  put(language: string, kept: KeptList): Promise<void>
  delete(language: string): Promise<void>
}

const STORE = 'listas'

export function indexedDbKeptStore(name = 'servos-enlinea'): KeptStore {
  let opened: Promise<IDBDatabase> | null = null
  const db = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch((error: unknown) => {
      // Opened again next time: a blocked open now may work later.
      opened = null
      throw error
    }))

  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest | null, result?: () => T): Promise<T> => {
    const tx = (await db()).transaction(STORE, mode)
    const request = work(tx.objectStore(STORE))
    return new Promise<T>((resolve, reject) => {
      tx.oncomplete = () => resolve(result ? result() : (request?.result as T))
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  return {
    async all() {
      const out: Record<string, KeptList> = {}
      await run('readonly', (store) => {
        const cursor = store.openCursor()
        cursor.onsuccess = () => {
          const c = cursor.result
          if (!c) return
          out[String(c.key)] = c.value as KeptList
          c.continue()
        }
        return null
      })
      return out
    },
    put: (language, kept) => run('readwrite', (store) => store.put(kept, language), () => undefined),
    delete: (language) => run('readwrite', (store) => store.delete(language), () => undefined),
  }
}
