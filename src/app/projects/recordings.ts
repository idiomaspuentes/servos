/**
 * Translating aloud (design, section 10): a verse can have, besides its text, recordings of it said in the team's
 * language. Each recording (a «take») keeps who said it, when, and how long it is; none is thrown away (the work is
 * not lost), and the last one is the one that counts unless the person chooses another.
 *
 * The sound itself is kept in IndexedDB (a phone's browser does not keep sound in localStorage); what is said about
 * each take, by verse, in localStorage, as the rest of the prototype's work. Wired, a take is a file of the place in
 * the book's journal, and a package carries it.
 */

export interface Take {
  id: string
  by: string
  at: string
  /** How long it is, in milliseconds. */
  ms: number
  mime: string
}

interface VerseTakes {
  takes: Take[]
  /** The take that counts; the last one, unless another was chosen. */
  chosen: string | null
}

const KEY = 'servos.prototipo.grabacion'
const metaKey = (book: string, chapter: number, verse: number) => `${KEY}.${book}.${chapter}.${verse}`
const readMeta = (book: string, chapter: number, verse: number): VerseTakes => {
  try {
    return (JSON.parse(localStorage.getItem(metaKey(book, chapter, verse)) ?? 'null') as VerseTakes | null) ?? { takes: [], chosen: null }
  } catch {
    return { takes: [], chosen: null }
  }
}
const writeMeta = (book: string, chapter: number, verse: number, v: VerseTakes) => {
  try {
    localStorage.setItem(metaKey(book, chapter, verse), JSON.stringify(v))
  } catch {
    /* kept on screen for this visit */
  }
}

export const takesOf = (book: string, chapter: number, verse: number): Take[] => readMeta(book, chapter, verse).takes

/** The take that counts for a verse, if it has any. */
export function chosenTake(book: string, chapter: number, verse: number): Take | null {
  const m = readMeta(book, chapter, verse)
  return m.takes.find((x) => x.id === m.chosen) ?? m.takes[m.takes.length - 1] ?? null
}

export function chooseTake(book: string, chapter: number, verse: number, id: string) {
  const m = readMeta(book, chapter, verse)
  if (m.takes.some((x) => x.id === id)) writeMeta(book, chapter, verse, { ...m, chosen: id })
}

/** Notes a new take of a verse: it becomes the one that counts. Its sound is kept apart (`keepSound`). */
export function addTake(book: string, chapter: number, verse: number, take: Omit<Take, 'id'>, id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`): Take {
  const m = readMeta(book, chapter, verse)
  const made = { ...take, id }
  writeMeta(book, chapter, verse, { takes: [...m.takes, made], chosen: id })
  return made
}

// The sound, in IndexedDB.
const DB = 'servos-grabaciones'
const STORE = 'sonido'
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function keepSound(id: string, blob: Blob): Promise<void> {
  const d = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function soundOf(id: string): Promise<Blob | null> {
  const d = await db()
  return new Promise((resolve) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => resolve(null)
  })
}

/** «0:07»: how long a take is, as a clock says it. */
export const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
