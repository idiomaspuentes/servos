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
 * caller that does not await it. What it read is that window's: two tabs of the web app (PWA) each keep their own
 * copy in memory and write the same rows, the last write winning; they are not coordinated (accepted, final review
 * M7).
 *
 * An open that does not settle (another tab holding the database, a broken browser store) must not hold the online
 * runs, which wait for the lists to be read and for their writes: reading gives up after `timeoutMs` (the lists then
 * last the session in memory), and from then on a write is handed to the open still pending and not waited for, so
 * it lands if the database opens at last.
 */

import type { KeptList } from './planLanguage'

export type KeptStore = {
  /** Every kept list, by language; rejects when the database cannot be opened in time. */
  all(): Promise<Record<string, KeptList>>
  put(language: string, kept: KeptList): Promise<void>
  delete(language: string): Promise<void>
}

const STORE = 'listas'

/** How long an open may take before the lists are kept in memory only. */
export const OPEN_TIMEOUT_MS = 5000

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Rejects after `ms` unless `work` settled first; `work` goes on either way. */
function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`IndexedDB did not answer within ${ms} ms`)), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

export function indexedDbKeptStore(
  name = 'servos-enlinea',
  options: { open?: (name: string) => Promise<IDBDatabase>; timeoutMs?: number } = {},
): KeptStore {
  const open = options.open ?? openDatabase
  const timeoutMs = options.timeoutMs ?? OPEN_TIMEOUT_MS
  let opening: Promise<IDBDatabase> | null = null
  let ready: IDBDatabase | null = null
  /** An open took too long: what comes next does not wait for it. */
  let slow = false

  const db = (): Promise<IDBDatabase> => {
    if (ready) return Promise.resolve(ready)
    opening ??= open(name).then(
      (db) => {
        ready = db
        slow = false
        return db
      },
      (error: unknown) => {
        // Opened again next time: a refused open now may work later.
        opening = null
        throw error
      },
    )
    return opening
  }

  const transact = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest | null, result: () => T): Promise<T> => {
    const tx = (await db()).transaction(STORE, mode)
    work(tx.objectStore(STORE))
    return new Promise<T>((resolve, reject) => {
      tx.oncomplete = () => resolve(result())
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  /** A write: waited for while the database answers; left to the pending open once it did not. */
  const write = (work: (store: IDBObjectStore) => IDBRequest): Promise<void> => {
    const done = transact('readwrite', work, () => undefined)
    if (ready) return done
    if (slow) {
      done.catch(() => {})
      return Promise.resolve()
    }
    return within(done, timeoutMs).catch((error: unknown) => {
      slow = true
      throw error
    })
  }

  return {
    async all() {
      const out: Record<string, KeptList> = {}
      const read = transact(
        'readonly',
        (store) => {
          const cursor = store.openCursor()
          cursor.onsuccess = () => {
            const c = cursor.result
            if (!c) return
            out[String(c.key)] = c.value as KeptList
            c.continue()
          }
          return null
        },
        () => out,
      )
      if (ready) return read
      read.catch(() => {})
      return within(read, timeoutMs).catch((error: unknown) => {
        slow = true
        throw error
      })
    },
    put: (language, kept) => write((store) => store.put(kept, language)),
    delete: (language) => write((store) => store.delete(language)),
  }
}
