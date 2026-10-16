/**
 * Translating aloud (design, section 10): a verse can have, besides its text, recordings of it said in the team's
 * language. Each recording (a «take») keeps who said it, when, and how long it is; none is thrown away (the work is
 * not lost), and the last one is the one that counts unless the person chooses another.
 *
 * The sound itself is kept in IndexedDB (a phone's browser does not keep sound in localStorage); what is said about
 * each take, by verse, in localStorage, as the rest of the prototype's work. A work package («Share») carries every
 * take with its sound; publishing to Door43 uploads the take that counts for each place, as `audio/JON/001/001-003.webm`.
 * Wired, a take is a file of the place in the book's journal.
 */

export interface Take {
  id: string
  by: string
  at: string
  /** How long it is, in milliseconds. */
  ms: number
  mime: string
  /** The last verse it says, when it says a passage (a section) begun at its verse; without it, its verse alone. */
  to?: number
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

/**
 * The take that says a verse: its own, or one of a passage begun at an earlier verse of the chapter that reaches it.
 * (A section is seldom longer than 40 verses: no further back is looked.)
 */
export function takeCovering(book: string, chapter: number, verse: number): Take | null {
  const own = chosenTake(book, chapter, verse)
  if (own) return own
  for (let v = verse - 1; v >= Math.max(1, verse - 40); v--) {
    const take = chosenTake(book, chapter, v)
    if (take && (take.to ?? v) >= verse) return take
  }
  return null
}

/** A place of a book with recordings: all its takes, and which counts (null: the last). */
export interface PlaceTakes {
  chapter: number
  verse: number
  takes: Take[]
  chosen: string | null
}

/** Every place of a book that has recordings, in order. */
export function recordedPlaces(book: string): PlaceTakes[] {
  const prefix = `${KEY}.${book}.`
  const out: PlaceTakes[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(prefix)) continue
      const [chapter, verse] = k.slice(prefix.length).split('.').map(Number)
      const m = readMeta(book, chapter, verse)
      if (m.takes.length) out.push({ chapter, verse, ...m })
    }
  } catch {
    /* nothing to read */
  }
  return out.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/**
 * Gathers takes received for a place (another phone's): those not here come in, none is lost; the one that counts
 * here stays so, and where there was none, the one that counted there does. Gives back the takes that came in.
 */
export function gatherTakes(book: string, chapter: number, verse: number, received: { takes: Take[]; chosen: string | null }): Take[] {
  const m = readMeta(book, chapter, verse)
  const fresh = received.takes.filter((x) => !m.takes.some((y) => y.id === x.id))
  if (!fresh.length) return []
  const here = m.chosen ?? m.takes[m.takes.length - 1]?.id ?? null
  const there = received.chosen ?? received.takes[received.takes.length - 1]?.id ?? null
  writeMeta(book, chapter, verse, { takes: [...m.takes, ...fresh], chosen: here ?? there })
  return fresh
}

/** Where a take goes in the repository: by book, chapter and verse (or the passage it says), with its sound's ending. */
export function audioFileOf(book: string, chapter: number, verse: number, take: Take): string {
  const n = (x: number) => String(x).padStart(3, '0')
  const m = take.mime.toLowerCase()
  const ending = m.includes('webm') ? 'webm' : m.includes('ogg') ? 'ogg' : /mp4|aac|m4a/.test(m) ? 'm4a' : m.includes('mpeg') ? 'mp3' : m.includes('wav') ? 'wav' : 'audio'
  const to = take.to && take.to !== verse ? `-${n(take.to)}` : ''
  return `audio/${book.toUpperCase()}/${n(chapter)}/${n(verse)}${to}.${ending}`
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

/** A take's sound as base64, to travel in a package or to Door43; null if it is not on this phone. */
export async function soundBase64(id: string): Promise<string | null> {
  const blob = await soundOf(id).catch(() => null)
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** A sound received as base64, as the blob kept. */
export function blobOf(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** «0:07»: how long a take is, as a clock says it. */
export const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
