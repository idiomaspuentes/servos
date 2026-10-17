import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'

/**
 * A letter typed just before the page goes (a reload, the app closed) is not lost: the database write started as it
 * goes may not end, so the book is also copied at once into localStorage, and that copy wins the next time.
 */
const store = new Map<string, string>()
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
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' } as unknown as Document
})

/**
 * A page of the app, opened fresh: its own copy of the modules, over the same database and localStorage, and its own
 * way of going (`leave`), so a page still opening cannot take another's.
 */
async function openPage() {
  const own: Record<string, () => void> = {}
  globalThis.window = { setTimeout, addEventListener: (type: string, f: () => void) => (own[type] = f) } as unknown as Window & typeof globalThis
  vi.resetModules()
  const scope = await import('./scope')
  const door = await import('./bookText')
  scope.setProject('kichwa')
  await door.openBooks()
  return { ...door, leave: () => own.pagehide() }
}
// Each page reads the prototype's data again: slow when every test file runs at once.
const SLOW = 30000
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const LEFT = 'servos.saliendo.jon~kichwa'
/** Waits for something the database does in its own time (slower when every test file runs at once). */
async function until(done: () => boolean, ms = 10000) {
  for (const end = Date.now() + ms; !done(); await pause(20)) if (Date.now() > end) throw new Error('no llegó a pasar')
}

it('al irse la página, lo escrito queda también en localStorage, y la base de datos lo recibe', async () => {
  const door = await openPage()
  door.writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
  door.leave()
  expect(store.get('servos.saliendo.jon~kichwa')).toContain('Taytaku rimarqa')
  // The page lived on (a phone that only went to another app): once the database has it, the copy goes.
  await until(() => !store.has(LEFT))
  expect((await openPage()).readDraft('jon', 1, 1)).toBe('Taytaku rimarqa')
}, SLOW)

it('si la base de datos no alcanzó a recibirlo, la copia gana la próxima vez y pasa a la base de datos', async () => {
  const first = await openPage()
  first.writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
  first.flushBooks()
  await pause(400)
  // A letter more, and the page dies with only its copy made (as if the database write had not ended).
  first.writeDraft('jon', 1, 1, 'Taytaku rimarqa Jonasman', 'Ana')
  first.leave()
  const copy = store.get('servos.saliendo.jon~kichwa')!
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('servos-libros', 1)
    req.onsuccess = () => resolve(req.result)
  })
  // Its database write ends (and drops the copy) before the copy is put back, as if that write had never ended.
  await until(() => !store.has(LEFT))
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
  await until(() => !store.has(LEFT))
  expect((await openPage()).readDraft('jon', 1, 1)).toBe('Taytaku rimarqa Jonasman')
}, SLOW)
