/**
 * The team's password of each project kept to its team (`Privacy`), as this device keeps it: work shared from such a
 * project is sealed with it («Share»), and work that comes sealed with it opens without asking again («Receive»).
 *
 * The password itself is kept nowhere. What is kept is the key drawn from it (`lockedCopy.ts`), unable to leave the
 * device, with the salt it was drawn with: one chosen here when the project is first shared, and one more for each
 * file received that opened with a password typed here (two phones that chose the same password apart draw it with
 * different salts). The first is the one this device shares with. Forgotten, the next file asks for the password.
 */

import { keyFrom, lockedKind, openWith, saltOf, type CopyKey } from './lockedCopy'

/** Where the keys are kept: the device's own database, which can hold a key object that cannot be read out. */
export interface KeyShelf {
  get(projectId: string): Promise<CopyKey[]>
  put(projectId: string, keys: CopyKey[]): Promise<void>
  /** Every project's keys, to open a file before knowing its project. */
  all(): Promise<Array<[string, CopyKey[]]>>
}

const DB = 'servos-equipo'
const STORE = 'llaves'

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
}

async function inStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | void, read?: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await database()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const store = tx.objectStore(STORE)
      run(store)
      const asked = read?.(store)
      tx.oncomplete = () => resolve(asked?.result)
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

const indexedShelf: KeyShelf = {
  get: async (id) => ((await inStore<CopyKey[]>('readonly', () => {}, (s) => s.get(id))) ?? []),
  put: async (id, keys) => {
    await inStore('readwrite', (s) => (keys.length ? s.put(keys, id) : s.delete(id)))
  },
  all: async () => {
    const ids = (await inStore<IDBValidKey[]>('readonly', () => {}, (s) => s.getAllKeys())) ?? []
    return Promise.all(ids.map(async (id) => [String(id), await indexedShelf.get(String(id))] as [string, CopyKey[]]))
  },
}

let shelf: KeyShelf = indexedShelf
/** For the tests: keys kept in memory. */
export const useShelf = (other: KeyShelf) => void (shelf = other)

const sameSalt = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

/** The key this device shares the project's work with, if the team's password was chosen or typed here. */
export async function teamKey(projectId: string): Promise<CopyKey | null> {
  return (await shelf.get(projectId).catch(() => []))[0] ?? null
}

/** Chooses the team's password for a project on this device: from now on its work is shared sealed with it. */
export async function chooseTeamPassword(projectId: string, password: string, rounds?: number): Promise<CopyKey> {
  const key = await keyFrom(password, undefined, rounds)
  const kept = await shelf.get(projectId).catch(() => [])
  await shelf.put(projectId, [key, ...kept])
  return key
}

/** Keeps a key that opened a file received into a project, so the next file sealed with it opens without asking. */
export async function keepTeamKey(projectId: string, key: CopyKey): Promise<void> {
  const kept = await shelf.get(projectId).catch(() => [])
  if (kept.some((k) => sameSalt(k.salt, key.salt))) return
  await shelf.put(projectId, [...kept, key])
}

/** Forgets the project's password on this device: the next file shared or received asks for it. */
export async function forgetTeamKeys(projectId: string): Promise<void> {
  await shelf.put(projectId, [])
}

/** Opens work shared sealed with a key kept here (any project's): its text, or null when none of them is its key. */
export async function openWithTeamKeys(text: string): Promise<string | null> {
  const salt = lockedKind(text) === 'compartido' ? saltOf(text) : null
  if (!salt) return null
  for (const [, keys] of await shelf.all().catch(() => [])) {
    for (const k of keys) {
      if (!sameSalt(k.salt, salt)) continue
      const open = await openWith(text, k.key)
      if (open !== null) return open
    }
  }
  return null
}
