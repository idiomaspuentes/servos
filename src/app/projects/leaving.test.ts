import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'

/**
 * A letter typed just before the page goes (a reload, the app closed) is not lost: the database write started as it
 * goes may not end, so the book is also copied at once into localStorage, and that copy wins the next time.
 */
const store = new Map<string, string>()
const listeners: Record<string, () => void> = {}
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
  globalThis.window = { setTimeout, addEventListener: (type: string, f: () => void) => (listeners[type] = f) } as unknown as Window & typeof globalThis
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' } as unknown as Document
})

/** A page of the app, opened fresh: its own copy of the modules, over the same database and localStorage. */
async function openPage() {
  vi.resetModules()
  const scope = await import('./scope')
  const door = await import('./bookText')
  scope.setProject('kichwa')
  await door.openBooks()
  return door
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

it('al irse la página, lo escrito queda también en localStorage, y la base de datos lo recibe', async () => {
  const door = await openPage()
  door.writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
  listeners.pagehide()
  expect(store.get('servos.saliendo.jon~kichwa')).toContain('Taytaku rimarqa')
  // The page lived on (a phone that only went to another app): once the database has it, the copy goes.
  await pause(50)
  expect(store.has('servos.saliendo.jon~kichwa')).toBe(false)
  expect((await openPage()).readDraft('jon', 1, 1)).toBe('Taytaku rimarqa')
})

it('si la base de datos no alcanzó a recibirlo, la copia gana la próxima vez y pasa a la base de datos', async () => {
  const first = await openPage()
  first.writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
  first.flushBooks()
  await pause(400)
  // A letter more, and the page dies with only its copy made (as if the database write had not ended).
  first.writeDraft('jon', 1, 1, 'Taytaku rimarqa Jonasman', 'Ana')
  listeners.pagehide()
  const copy = store.get('servos.saliendo.jon~kichwa')!
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('servos-libros', 1)
    req.onsuccess = () => resolve(req.result)
  })
  await pause(50)
  const older = JSON.parse(copy)
  older.working = older.state.usfm = older.working.replace('Taytaku rimarqa Jonasman', 'Taytaku rimarqa')
  await new Promise((resolve) => {
    const tx = db.transaction('libros', 'readwrite')
    tx.objectStore('libros').put(older, 'jon~kichwa')
    tx.oncomplete = resolve
  })
  store.set('servos.saliendo.jon~kichwa', copy)
  db.close()

  const next = await openPage()
  expect(next.readDraft('jon', 1, 1)).toBe('Taytaku rimarqa Jonasman')
  await pause(400)
  expect(store.has('servos.saliendo.jon~kichwa')).toBe(false)
  expect((await openPage()).readDraft('jon', 1, 1)).toBe('Taytaku rimarqa Jonasman')
})
