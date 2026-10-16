/**
 * The one door to a book's text: each verse as written, who wrote it, the verses joined, the versions waiting for a
 * choice, and the stretches whose joins two copies disagree on. Nothing else reads or writes them (a test checks it),
 * so what keeps them can change behind this door without the screens knowing.
 *
 * Behind it, each book is one USFM file and its journal (`src/core`, design, section 6): laid out as the bridge text
 * is (its paragraphs, a poem's lines, every verse, joined ones as `\v 1-2`), and every change a person makes is an
 * entry of the journal, with the text it was made on. Who wrote a verse is read from the journal.
 *
 * What is read is always the text as it is now. The journal takes a change when the person stops writing for a
 * moment, when someone else writes, or when the app is left: a verse typed letter by letter is one change, not one
 * per letter. Books are kept in IndexedDB (a phone's localStorage fills up), or in localStorage where IndexedDB
 * cannot be had.
 *
 * Still kept verse by verse here, until gathering work uses the merge of `src/core` (wiring, step 4): the versions
 * waiting for a choice and the structure conflicts.
 */

import { placesOf, producerOf, recordEdits, startBook, textKey, type BookState, type Person } from '../../core'
import { chapterOf, chaptersOf, type PrototypeData } from '../../prototype/data'
import { applyVerseEdits, listVerseSpans, normalizeVerseText, verseLinesText, type VerseSlotEdit } from '../../usfm/usfmEdit'
import { bookUsfm } from './usfmExport'

const KEY = 'servos.prototipo'
const otherKey = (book: string, chapter: number, verse: number) => `${KEY}.otra.${book}.${chapter}.${verse}`
const structureKey = (book: string, chapter: number, from: number) => `${KEY}.estructura.${book}.${chapter}.${from}`
/** Where the prototype kept the text verse by verse before the book was one USFM: read once, to move it in. */
const legacy = {
  draft: (book: string, chapter: number, verse: number) => `${KEY}.borrador.${book}.${chapter}.${verse}`,
  author: (book: string, chapter: number, verse: number) => `${KEY}.autor.${book}.${chapter}.${verse}`,
  join: (book: string, chapter: number, verse: number) => `${KEY}.union.${book}.${chapter}.${verse}`,
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* kept on screen for this visit */
  }
}

/** The keys under a prefix. */
function keysUnder(prefix: string): string[] {
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) out.push(k)
    }
  } catch {
    /* nothing to read */
  }
  return out
}

/** `….otra.jon.1.2` → [1, 2]. */
const placeIn = (key: string) => key.split('.').slice(-2).map(Number) as [number, number]

// ——— The book on this device ———————————————————————————————————————————————————————————————————————————————————

/**
 * A book as it is kept: its state (the USFM as the journal last took it, the journal), the USFM as it is now, and,
 * while someone is writing, who and where (the change the journal has not taken yet).
 */
interface Shelved {
  state: BookState
  working: string
  pendingBy: string | null
  /** `chapter:verse` of the verses written since the journal last took a change. */
  pendingAt: string[]
}

interface Shelf {
  get(code: string): Shelved | null
  put(rec: Shelved): void
  codes(): string[]
}

/** Books in localStorage, one key each: where IndexedDB cannot be had (and in the tests). */
const BOOK = 'servos.libro.'
const localMemo = new Map<string, { raw: string; rec: Shelved }>()
const localShelf: Shelf = {
  get(code) {
    const raw = read(BOOK + code)
    if (raw === null) {
      localMemo.delete(code)
      return null
    }
    const memo = localMemo.get(code)
    if (memo && memo.raw === raw) return memo.rec
    try {
      const rec = JSON.parse(raw) as Shelved
      localMemo.set(code, { raw, rec })
      return rec
    } catch {
      return null
    }
  },
  put(rec) {
    const raw = JSON.stringify(rec)
    write(BOOK + rec.state.book, raw)
    localMemo.set(rec.state.book, { raw, rec })
  },
  codes: () => keysUnder(BOOK).map((k) => k.slice(BOOK.length)),
}

let shelf: Shelf = localShelf

// IndexedDB: the books in memory, each written to the database a moment after it changes.
const DB = 'servos-libros'
const STORE = 'libros'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function dbShelf(db: IDBDatabase, books: Map<string, Shelved>): Shelf & { flush(): void } {
  const waiting = new Map<string, number>()
  const save = (code: string) => {
    waiting.delete(code)
    const rec = books.get(code)
    if (!rec) return
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec, code)
    } catch {
      /* kept in memory for this visit */
    }
  }
  return {
    get: (code) => books.get(code) ?? null,
    put(rec) {
      const code = rec.state.book
      books.set(code, rec)
      if (waiting.has(code)) clearTimeout(waiting.get(code))
      waiting.set(code, window.setTimeout(() => save(code), 300))
    },
    codes: () => [...books.keys()],
    flush() {
      for (const [code, timer] of waiting) {
        clearTimeout(timer)
        save(code)
      }
    },
  }
}

/**
 * Opens the books kept on this device, before anything is shown: from IndexedDB (with any a fallback had kept in
 * localStorage), and moves in the text the prototype kept verse by verse, once.
 */
export async function openBooks(): Promise<void> {
  try {
    const db = await openDb()
    const books = new Map<string, Shelved>()
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return resolve()
        books.set(String(cursor.key), cursor.value as Shelved)
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
    for (const code of localShelf.codes()) if (!books.has(code)) books.set(code, localShelf.get(code)!)
    const kept = dbShelf(db, books)
    shelf = kept
    const leave = () => {
      flushBooks()
      kept.flush()
    }
    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && leave())
  } catch {
    /* stays in localStorage */
  }
  moveLegacyText()
}

// ——— Who writes ———————————————————————————————————————————————————————————————————————————————————————————————————

/** This device, as the journal tells it apart: two people of one name on two devices are two people. */
export function deviceId(): string {
  const k = 'servos.dispositivo'
  let id = read(k)
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
    write(k, id)
  }
  return id
}

/** Who wrote, for the journal; a verse whose writer was never known keeps an empty name, and says no one. */
const personOf = (name: string): Person => ({ name, device: deviceId() })
const nameOf = (key: string) => (key.includes('@') ? key.slice(0, key.lastIndexOf('@')) : key)

// ——— Reading ——————————————————————————————————————————————————————————————————————————————————————————————————————

/** A verse of the USFM as it is now: the last verse it reaches (itself, or a join's end), its lines, its text's key. */
interface Slot {
  chapter: number
  from: number
  to: number
  lines: string
  key: string
}

const slotsMemo = new Map<string, { usfm: string; slots: Map<string, Slot> }>()

/** The verses of a book by `chapter:verse` of their first verse, read once for each USFM. */
function slotsOf(code: string): Map<string, Slot> {
  const rec = shelf.get(code)
  if (!rec) return new Map()
  const memo = slotsMemo.get(code)
  if (memo && memo.usfm === rec.working) return memo.slots
  const keys = new Map(placesOf(rec.working).map((p) => [`${p.chapter}:${p.from}`, p.key]))
  const slots = new Map<string, Slot>()
  for (const span of listVerseSpans(rec.working)) {
    const id = `${span.chapter}:${span.verse}`
    if (slots.has(id)) continue
    const lines = verseLinesText(rec.working, span)
    slots.set(id, { chapter: span.chapter, from: span.verse, to: Math.max(span.verse, span.verseTo), lines, key: keys.get(id) ?? textKey(normalizeVerseText(lines)) })
  }
  slotsMemo.set(code, { usfm: rec.working, slots })
  return slots
}

/** The verse as written: its lines parted by `\n`, or empty. */
export const readDraft = (book: string, chapter: number, verse: number): string => slotsOf(book).get(`${chapter}:${verse}`)?.lines ?? ''

/**
 * Verses joined: when a language says two verses (or more) in one sentence, as USFM's `\v 1-2`. The text of them all
 * is said by the first; the others are part of it.
 */
export function joinedTo(book: string, chapter: number, verse: number): number | null {
  const slot = slotsOf(book).get(`${chapter}:${verse}`)
  return slot && slot.to > verse ? slot.to : null
}

/** The verse whose text says this one: the first of the verses it is joined with, or itself. */
export function joinStartOf(book: string, chapter: number, verse: number): number {
  for (let start = verse - 1; start >= Math.max(1, verse - 30); start--) {
    const end = joinedTo(book, chapter, start)
    if (end !== null) return end >= verse ? start : verse
  }
  return verse
}

/** The verses said together with this one, in order: itself alone when it is not joined. */
export function joinedVerses(book: string, chapter: number, verse: number): number[] {
  const start = joinStartOf(book, chapter, verse)
  const end = joinedTo(book, chapter, start) ?? start
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/** What translates a verse: its own text, or that of the verses it is joined with. */
export const textOf = (book: string, chapter: number, verse: number): string => readDraft(book, chapter, joinStartOf(book, chapter, verse))

/** Who wrote the verse last, or null when nobody has; of a verse joined to the one before, who wrote them together. */
export function authorOf(book: string, chapter: number, verse: number): string | null {
  const at = joinStartOf(book, chapter, verse)
  const slot = slotsOf(book).get(`${chapter}:${at}`)
  const rec = shelf.get(book)
  if (!slot || !rec || !slot.lines.trim()) return null
  if (rec.pendingBy !== null && rec.pendingAt.includes(`${chapter}:${at}`)) return rec.pendingBy || null
  const made = producerOf(rec.state, { chapter, from: at, to: slot.to }, slot.key)
  return made ? nameOf(made.by) || null : null
}

/** A verse of the book as it stands: its text, who wrote it, and the last verse joined to it when it starts a join. */
export interface WrittenVerse {
  chapter: number
  verse: number
  text: string
  by: string | null
  joinedTo?: number
}

/** Every verse of a book that has text or starts a join, in order. */
export function writtenVerses(book: string): WrittenVerse[] {
  const out: WrittenVerse[] = []
  for (const slot of slotsOf(book).values()) {
    if (!slot.lines.trim() && slot.to === slot.from) continue
    out.push({ chapter: slot.chapter, verse: slot.from, text: slot.lines, by: authorOf(book, slot.chapter, slot.from), ...(slot.to > slot.from ? { joinedTo: slot.to } : {}) })
  }
  return out.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/** The book's state for the merge and the work package: the journal brought up to the text as it is now. */
export function bookStateOf(book: string): BookState | null {
  const rec = shelf.get(book)
  if (!rec) return null
  const now = commit(rec)
  if (now !== rec) shelf.put(now)
  return now.state
}

// ——— Writing —————————————————————————————————————————————————————————————————————————————————————————————————————

const isPoem = (marker: string) => /^q\d?$|^qm\d?$/.test(marker)

/**
 * The marks a verse's lines begin with in the bridge text, when it is a poem: what a line the verse lacks begins with.
 * The first line's mark stands before the verse's number, on the line the number begins (`\q \v 3 …`): it is the line
 * the verse is written on, not one to begin (as Taller's `verseLeads` reads it, `['', '\q2']`).
 */
function leadsOf(book: string, chapter: number, verse: number): string[] {
  const data = chapterOf(book, chapter)
  const text = data?.texts.find((x) => x.abbreviation === 'TPL') ?? data?.texts.find((x) => !x.original)
  const markers = (text?.lines[verse] ?? []).map((l) => l.marker)
  return markers.some(isPoem) ? ['', ...markers.slice(1).map((m) => `\\${m}`)] : []
}

/** A book not begun yet: laid out as its bridge text is, every verse there and empty. */
function emptyBook(code: string): Shelved {
  const chapters = chaptersOf(code)
    .map((c) => chapterOf(code, c))
    .filter((d): d is PrototypeData => Boolean(d))
  const usfm = chapters.length
    ? bookUsfm(code, '', chapters, 'TPL', undefined, false, { readDraft: () => '', joinedTo: () => null })
    : `\\id ${code.toUpperCase()}\n\\usfm 3.0\n`
  const state = startBook({ book: code, usfm, person: personOf(''), at: new Date().toISOString() })
  return { state, working: usfm, pendingBy: null, pendingAt: [] }
}

/** The journal takes the change being written, if there is one. */
function commit(rec: Shelved): Shelved {
  if (rec.pendingBy === null && rec.working === rec.state.usfm) return rec
  const state = recordEdits(rec.state, personOf(rec.pendingBy ?? ''), rec.working, new Date().toISOString())
  return { state, working: state.usfm, pendingBy: null, pendingAt: [] }
}

const timers = new Map<string, number>()

/** A moment after the last letter, the journal takes the change (in the app; the tests ask for it when they need it). */
function commitSoon(code: string) {
  if (typeof window === 'undefined') return
  if (timers.has(code)) clearTimeout(timers.get(code))
  timers.set(
    code,
    window.setTimeout(() => {
      timers.delete(code)
      const rec = shelf.get(code)
      if (rec && rec.pendingBy !== null) shelf.put(commit(rec))
    }, 1500)
  )
}

/** The journal takes every change being written (leaving the app, before a book is shared). */
export function flushBooks() {
  for (const code of shelf.codes()) {
    const rec = shelf.get(code)
    if (rec && rec.pendingBy !== null) shelf.put(commit(rec))
  }
}

/**
 * Writes verses of a chapter: `by` wrote them. Someone else's change still being written is taken by the journal
 * first; `now` has the journal take this one at once (a join, a choice: not typed letter by letter).
 */
function change(book: string, by: string, chapter: number, edits: VerseSlotEdit[], now = false) {
  let rec = shelf.get(book) ?? emptyBook(book)
  if (rec.pendingBy !== null && rec.pendingBy !== by) rec = commit(rec)
  const working = applyVerseEdits(rec.working, chapter, edits)
  if (working === rec.working) {
    if (!shelf.get(book)) shelf.put(rec)
    return
  }
  rec = { ...rec, working, pendingBy: by, pendingAt: [...new Set([...rec.pendingAt, ...edits.map((e) => `${chapter}:${e.from}`)])] }
  if (now) rec = commit(rec)
  shelf.put(rec)
  if (!now) commitSoon(book)
}

export function writeDraft(book: string, chapter: number, verse: number, text: string, by: string) {
  if (text === readDraft(book, chapter, verse)) return
  const to = joinedTo(book, chapter, verse) ?? verse
  change(book, by, chapter, [{ from: verse, to, text, leads: to === verse ? leadsOf(book, chapter, verse) : [] }])
}

/**
 * Joins the verses this one is in with the next verse (and with those that one is joined with): their texts follow
 * one another, said by the first.
 */
export function joinWithNext(book: string, chapter: number, verse: number, by: string) {
  const start = joinStartOf(book, chapter, verse)
  const next = (joinedTo(book, chapter, start) ?? start) + 1
  const end = joinedTo(book, chapter, next) ?? next
  const text = [readDraft(book, chapter, start), readDraft(book, chapter, next)]
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
  change(book, by, chapter, [{ from: start, to: end, text }], true)
}

/** Separates the verses this one is joined with: the text stays in the first, for the person to share out. */
export function separateJoined(book: string, chapter: number, verse: number, by?: string) {
  const start = joinStartOf(book, chapter, verse)
  const end = joinedTo(book, chapter, start)
  if (end === null) return
  const edits: VerseSlotEdit[] = [{ from: start, to: start, text: readDraft(book, chapter, start), leads: leadsOf(book, chapter, start) }]
  for (let v = start + 1; v <= end; v++) edits.push({ from: v, to: v, text: '', leads: leadsOf(book, chapter, v) })
  change(book, by ?? authorOf(book, chapter, start) ?? '', chapter, edits, true)
}

/**
 * A stretch of a chapter takes these verses, each alone or a join, with their texts and writers: what the stretch held
 * goes (its texts and joins; and, with `others`, the versions waiting in it).
 */
export function replaceStretch(
  book: string,
  chapter: number,
  from: number,
  to: number,
  units: Array<{ from: number; to: number; text: string; by: string | null }>,
  { others = false }: { others?: boolean } = {}
) {
  if (others) for (let v = from; v <= to; v++) write(otherKey(book, chapter, v), null)
  // The stretch emptied, verse by verse (taken as the first writer's change), then each verse written by its writer.
  const empty: VerseSlotEdit[] = []
  for (let v = from; v <= to; v++) empty.push({ from: v, to: v, text: '', leads: leadsOf(book, chapter, v) })
  change(book, units[0]?.by ?? '', chapter, empty, true)
  for (const u of units)
    change(book, u.by ?? '', chapter, [{ from: u.from, to: u.to, text: u.text, leads: u.to === u.from ? leadsOf(book, chapter, u.from) : [] }], true)
}

/** The text the prototype kept verse by verse, moved into the book once: each verse as its writer's change. */
function moveLegacyText() {
  const codes = new Set(keysUnder(`${KEY}.borrador.`).map((k) => k.split('.')[3]))
  for (const code of codes) {
    if (!code || shelf.get(code)) continue
    const verses = keysUnder(`${KEY}.borrador.${code}.`)
      .map((k) => {
        const [chapter, verse] = placeIn(k)
        const end = Number(read(legacy.join(code, chapter, verse)))
        return { chapter, verse, to: Number.isFinite(end) && end > verse ? end : verse, text: read(k) ?? '', by: read(legacy.author(code, chapter, verse)) }
      })
      .filter((x) => x.text.trim() || x.to > x.verse)
      .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
    shelf.put(emptyBook(code))
    for (const x of verses)
      change(code, x.by ?? '', x.chapter, [{ from: x.verse, to: x.to, text: x.text, leads: x.to === x.verse ? leadsOf(code, x.chapter, x.verse) : [] }], true)
  }
}

/** Only for the tests: forgets what was read, as another device would not have it. */
export function forgetBooks() {
  localMemo.clear()
  slotsMemo.clear()
}

// ——— Versions waiting for a choice, and stretches whose joins disagree (until step 4) ————————————————————————————

/** Another version of a verse, received from someone while this computer had its own: kept until someone chooses. */
export interface OtherVersion {
  text: string
  by: string
}

export function otherVersion(book: string, chapter: number, verse: number): OtherVersion | null {
  const raw = read(otherKey(book, chapter, verse))
  if (!raw) return null
  try {
    return JSON.parse(raw) as OtherVersion
  } catch {
    return null
  }
}

/** Keeps a version received as waiting for a choice at a verse (replacing one that waited there). */
export const keepOtherVersion = (book: string, chapter: number, verse: number, other: OtherVersion) =>
  write(otherKey(book, chapter, verse), JSON.stringify(other))

/** Every version of a book waiting for a choice, in order. */
export function otherVersionsOf(book: string): Array<{ chapter: number; verse: number } & OtherVersion> {
  return keysUnder(`${KEY}.otra.${book}.`)
    .flatMap((k) => {
      const [chapter, verse] = placeIn(k)
      const o = otherVersion(book, chapter, verse)
      return o ? [{ chapter, verse, ...o }] : []
    })
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/** Keeps the other version (it replaces the verse) or this one; either way the choice is made. */
export function chooseVersion(book: string, chapter: number, verse: number, keepOther: boolean) {
  const other = otherVersion(book, chapter, verse)
  if (other && keepOther) {
    const to = joinedTo(book, chapter, verse) ?? verse
    change(book, other.by, chapter, [{ from: verse, to, text: other.text, leads: to === verse ? leadsOf(book, chapter, verse) : [] }], true)
  }
  write(otherKey(book, chapter, verse), null)
}

/**
 * Verses joined on one side and not on the other (design 6.2, «choque de estructura»): this phone says 1 and 2 apart
 * and the other said them as one (1–2), or the other way round, with text on both sides. Not to be decided verse by
 * verse: the person chooses which way stays for the whole stretch. Kept by its first verse, with what was received.
 */
export interface StructureConflict {
  chapter: number
  /** The stretch the two ways cover together. */
  from: number
  to: number
  /** The way received: its verses, each one or a join, with its text. */
  received: Array<{ from: number; to: number; text: string; by: string }>
}

export function structureConflictsOf(book: string, chapter?: number): StructureConflict[] {
  const out: StructureConflict[] = []
  for (const k of keysUnder(`${KEY}.estructura.${book}.${chapter === undefined ? '' : `${chapter}.`}`)) {
    try {
      const c = JSON.parse(read(k) ?? 'null') as StructureConflict | null
      if (c) out.push(c)
    } catch {
      /* a broken one is skipped */
    }
  }
  return out.sort((a, b) => a.chapter - b.chapter || a.from - b.from)
}

export const structureConflictAt = (book: string, chapter: number, verse: number) =>
  structureConflictsOf(book, chapter).find((c) => c.from <= verse && verse <= c.to) ?? null

/** Keeps a way received that does not fit this phone's: with one already waiting there, the two are one stretch. */
export function keepStructureConflict(book: string, c: StructureConflict) {
  const there = structureConflictsOf(book, c.chapter).find((x) => x.from <= c.to && c.from <= x.to)
  const merged: StructureConflict = there
    ? {
        chapter: c.chapter,
        from: Math.min(there.from, c.from),
        to: Math.max(there.to, c.to),
        received: [...there.received, ...c.received.filter((r) => !there.received.some((x) => x.from === r.from))].sort((a, b) => a.from - b.from),
      }
    : c
  if (there && there.from !== merged.from) write(structureKey(book, c.chapter, there.from), null)
  write(structureKey(book, c.chapter, merged.from), JSON.stringify(merged))
}

/**
 * Chooses the way a stretch stays: this phone's (nothing changes), or the one received: the stretch's verses take its
 * joins and its texts, each with who wrote it.
 */
export function chooseStructure(book: string, chapter: number, from: number, keepReceived: boolean) {
  const c = structureConflictsOf(book, chapter).find((x) => x.from === from)
  if (!c) return
  if (keepReceived) replaceStretch(book, chapter, c.from, c.to, c.received, { others: true })
  write(structureKey(book, chapter, from), null)
}
