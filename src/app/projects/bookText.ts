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
 * Gathering another copy of a book is the merge of `src/core` (`mergeBook`): what two people changed apart from the
 * same text waits as a conflict (a version to choose, or a stretch joined otherwise), and the choice is a decision in
 * the journal, not asked again wherever the book goes.
 */

import {
  alignmentPlaceId,
  changesBetween,
  decide,
  decideAlignment,
  emptyAlignmentLayer,
  mergeAlignments,
  recordAlignment,
  mergeInto,
  seenUpTo,
  personKey,
  placesOf,
  producerOf,
  recordEdits,
  startBook,
  textKey,
  usfmOfRange,
  type AlignmentLayer,
  type AlignmentPlace,
  type AlignmentReport,
  type BookState,
  type Conflict,
  type Entry,
  type MergeReport,
  type Person,
  type Place,
} from '../../core'
import { chapterOf, chaptersOf, type PrototypeData } from '../../prototype/data'
import { samePlace } from '../../core/book'
import { scoped } from './scope'
import { applyVerseEdits, listVerseSpans, normalizeVerseText, verseLinesText, type VerseSlotEdit } from '../../usfm/usfmEdit'
import { bookUsfm } from './usfmExport'

const KEY = 'servos.prototipo'
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

/** `….borrador.jon.1.2` → [1, 2]. */
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
  /** Alignments made since the journal last took a change, by `alignmentPlaceId`. */
  alignPending?: Record<string, { place: AlignmentPlace; on: string; groups: unknown }>
}

/** The books kept, each by its key: the book's code with its project (`jon~biblia-kichwa`, `scope.ts`). */
interface Shelf {
  get(key: string): Shelved | null
  put(key: string, rec: Shelved): void
  remove(key: string): void
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
  put(key, rec) {
    const raw = JSON.stringify(rec)
    write(BOOK + key, raw)
    localMemo.set(key, { raw, rec })
  },
  remove(key) {
    write(BOOK + key, null)
    localMemo.delete(key)
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
    put(code, rec) {
      books.set(code, rec)
      if (waiting.has(code)) clearTimeout(waiting.get(code))
      waiting.set(code, window.setTimeout(() => save(code), 300))
    },
    remove(code) {
      books.delete(code)
      if (waiting.has(code)) clearTimeout(waiting.get(code))
      waiting.delete(code)
      try {
        db.transaction(STORE, 'readwrite').objectStore(STORE).delete(code)
      } catch {
        /* gone from memory; the database keeps it until next time */
      }
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
  moveLegacyWaiting()
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

/**
 * A book's USFM parted at its chapters: what comes before the first, and each chapter's text from its `\c`. A letter
 * typed changes one chapter: only that one is written again and read again (a book the size of Psalms read whole at
 * each letter took a fifth of a second on a computer, a second on a phone).
 */
interface Parts {
  head: string
  chapters: Map<number, string>
}

function splitBook(usfm: string): Parts {
  const marks = [...usfm.matchAll(/\\c\s+(\d+)/g)]
  const chapters = new Map<number, string>()
  marks.forEach((m, i) => {
    const text = usfm.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : usfm.length)
    const n = Number(m[1])
    chapters.set(n, (chapters.get(n) ?? '') + text)
  })
  return { head: marks.length ? usfm.slice(0, marks[0].index) : usfm, chapters }
}

/** The book again from its parts, its chapters in order. */
const joinBook = (parts: Parts) =>
  parts.head +
  [...parts.chapters]
    .sort((a, b) => a[0] - b[0])
    .map(([, text]) => text)
    .join('')

const partsMemo = new Map<string, Array<{ usfm: string; parts: Parts }>>()

/** A book's USFM in its parts, parted once (the last few kept: the text as it is now, as the journal took it). */
function partsOf(code: string, usfm: string): Parts {
  const hit = partsMemo.get(code)?.find((x) => x.usfm === usfm)
  if (hit) return hit.parts
  const parts = splitBook(usfm)
  remember(code, usfm, parts)
  return parts
}

function remember(code: string, usfm: string, parts: Parts) {
  const list = (partsMemo.get(code) ?? []).filter((x) => x.usfm !== usfm)
  partsMemo.set(code, [{ usfm, parts }, ...list].slice(0, 3))
}

const slotsMemo = new Map<string, Map<number, { text: string; slots: Map<number, Slot> }>>()

/** The verses of a chapter by the number of their first verse, read once for each text of the chapter. */
function chapterSlots(code: string, chapter: number): Map<number, Slot> {
  const rec = shelf.get(scoped(code))
  const text = rec ? partsOf(code, rec.working).chapters.get(chapter) : undefined
  if (text === undefined) return new Map()
  let byChapter = slotsMemo.get(code)
  if (!byChapter) slotsMemo.set(code, (byChapter = new Map()))
  const memo = byChapter.get(chapter)
  if (memo && memo.text === text) return memo.slots
  const keys = new Map(placesOf(text).map((p) => [p.from, p.key]))
  const slots = new Map<number, Slot>()
  for (const span of listVerseSpans(text)) {
    if (span.chapter !== chapter || slots.has(span.verse)) continue
    const lines = verseLinesText(text, span)
    slots.set(span.verse, { chapter, from: span.verse, to: Math.max(span.verse, span.verseTo), lines, key: keys.get(span.verse) ?? textKey(normalizeVerseText(lines)) })
  }
  byChapter.set(chapter, { text, slots })
  return slots
}

/** The verse as written: its lines parted by `\n`, or empty. */
export const readDraft = (book: string, chapter: number, verse: number): string => chapterSlots(book, chapter).get(verse)?.lines ?? ''

/**
 * Verses joined: when a language says two verses (or more) in one sentence, as USFM's `\v 1-2`. The text of them all
 * is said by the first; the others are part of it.
 */
export function joinedTo(book: string, chapter: number, verse: number): number | null {
  const slot = chapterSlots(book, chapter).get(verse)
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
  const slot = chapterSlots(book, chapter).get(at)
  const rec = shelf.get(scoped(book))
  if (!slot || !rec || !slot.lines.trim()) return null
  if (rec.pendingBy !== null && rec.pendingAt.includes(`${chapter}:${at}`)) return rec.pendingBy || null
  // The last who wrote this text here: a choice between two versions is the chooser's entry, not a writing.
  const place = { chapter, from: at, to: slot.to }
  const wrote = [...rec.state.journal].reverse().find((e) => e.kind === 'edit' && e.key === slot.key && samePlace(e.place, place))
  const made = wrote ?? producerOf(rec.state, place, slot.key)
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
  const rec = shelf.get(scoped(book))
  for (const chapter of rec ? partsOf(book, rec.working).chapters.keys() : []) {
    for (const slot of chapterSlots(book, chapter).values()) {
      if (!slot.lines.trim() && slot.to === slot.from) continue
      out.push({ chapter: slot.chapter, verse: slot.from, text: slot.lines, by: authorOf(book, slot.chapter, slot.from), ...(slot.to > slot.from ? { joinedTo: slot.to } : {}) })
    }
  }
  return out.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/** The book's state for the merge and the work package: the journal brought up to the text as it is now. */
export function bookStateOf(book: string): BookState | null {
  const rec = shelf.get(scoped(book))
  if (!rec) return null
  const now = commit(rec)
  if (now !== rec) shelf.put(scoped(book), now)
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

/**
 * The journal takes the change being written, if there is one. Only the chapters written in are compared, when the
 * rest of the book is as the journal last took it; else the whole book.
 */
function commit(rec: Shelved): Shelved {
  if (rec.pendingBy === null && rec.working === rec.state.usfm && !Object.keys(rec.alignPending ?? {}).length) return rec
  const person = personOf(rec.pendingBy ?? '')
  const at = new Date().toISOString()
  const code = rec.state.book
  // Only alignments were made: the text is as the journal took it, nothing of it to compare.
  if (rec.working === rec.state.usfm) return { state: withAlignments(rec.state, rec, person, at), working: rec.working, pendingBy: null, pendingAt: [] }
  const written = [...new Set(rec.pendingAt.map((x) => Number(x.split(':')[0])))]
  const was = partsOf(code, rec.state.usfm)
  const now = partsOf(code, rec.working)
  const onlyThose =
    written.length > 0 &&
    was.head === now.head &&
    was.chapters.size === now.chapters.size &&
    [...now.chapters].every(([c, text]) => written.includes(c) || was.chapters.get(c) === text)
  if (!onlyThose) {
    const state = withAlignments(recordEdits(rec.state, person, rec.working, at), rec, person, at)
    return { state, working: state.usfm, pendingBy: null, pendingAt: [] }
  }
  let seq = seenUpTo(rec.state, personKey(person)) + 1
  const entries: Entry[] = []
  for (const c of written.sort((a, b) => a - b)) {
    const made = changesBetween(was.chapters.get(c) ?? '', now.chapters.get(c) ?? '', person, seq, at)
    seq += made.length
    entries.push(...made)
  }
  const state = withAlignments({ ...rec.state, usfm: rec.working, journal: [...rec.state.journal, ...entries] }, rec, person, at)
  return { state, working: rec.working, pendingBy: null, pendingAt: [] }
}

/** The alignments made since the journal last took a change, each a line of the alignment's diary. */
function withAlignments(state: BookState, rec: Shelved, person: Person, at: string): BookState {
  const made = Object.values(rec.alignPending ?? {})
  if (!made.length) return state
  let layer = state.alignment ?? emptyAlignmentLayer()
  for (const a of made) layer = recordAlignment(layer, person, a.place, a.on, a.groups, at)
  return { ...state, alignment: layer }
}

const timers = new Map<string, number>()

/** A moment after the last letter, the journal takes the change (in the app; the tests ask for it when they need it). */
function commitSoon(key: string) {
  if (typeof window === 'undefined') return
  if (timers.has(key)) clearTimeout(timers.get(key))
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key)
      const rec = shelf.get(key)
      if (rec && rec.pendingBy !== null) shelf.put(key, commit(rec))
    }, 1500)
  )
}

/** The journal takes every change being written (leaving the app, before a book is shared). */
export function flushBooks() {
  for (const key of shelf.codes()) {
    const rec = shelf.get(key)
    if (rec && rec.pendingBy !== null) shelf.put(key, commit(rec))
  }
}

/**
 * Writes verses of a chapter: `by` wrote them. Someone else's change still being written is taken by the journal
 * first; `now` has the journal take this one at once (a join, a choice: not typed letter by letter).
 */
function change(book: string, by: string, chapter: number, edits: VerseSlotEdit[], now = false) {
  const key = scoped(book)
  let rec = shelf.get(key) ?? emptyBook(book)
  if (rec.pendingBy !== null && rec.pendingBy !== by) rec = commit(rec)
  // The chapter alone is written again, when the book has it; the book, when the chapter is to be made.
  const parts = partsOf(book, rec.working)
  const before = parts.chapters.get(chapter)
  let working = rec.working
  if (before !== undefined) {
    const after = applyVerseEdits(before, chapter, edits)
    if (after !== before) {
      const next: Parts = { head: parts.head, chapters: new Map(parts.chapters).set(chapter, after) }
      working = joinBook(next)
      remember(book, working, next)
    }
  } else working = applyVerseEdits(rec.working, chapter, edits)
  if (working === rec.working) {
    if (!shelf.get(key)) shelf.put(key, rec)
    return
  }
  rec = { ...rec, working, pendingBy: by, pendingAt: [...new Set([...rec.pendingAt, ...edits.map((e) => `${chapter}:${e.from}`)])] }
  if (now) rec = commit(rec)
  shelf.put(key, rec)
  if (!now) commitSoon(key)
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
    shelf.put(code, emptyBook(code))
    for (const x of verses)
      change(code, x.by ?? '', x.chapter, [{ from: x.verse, to: x.to, text: x.text, leads: x.to === x.verse ? leadsOf(code, x.chapter, x.verse) : [] }], true)
  }
}

/**
 * A book kept by its code alone (before each project kept its own) goes to each project that has it, as it is, once;
 * then it is forgotten, so a project that adds the book later begins it new.
 */
export function moveBooksToProjects(projects: Array<{ id: string; books: Array<{ code: string }> }>) {
  for (const key of shelf.codes()) {
    if (key.includes('~')) continue
    const rec = shelf.get(key)
    if (!rec) continue
    for (const p of projects.filter((x) => x.books.some((b) => b.code === key))) {
      const theirs = `${key}~${p.id}`
      if (!shelf.get(theirs)) shelf.put(theirs, commit(rec))
    }
    shelf.remove(key)
  }
}

/** Only for the tests: forgets what was read, as another device would not have it. */
export function forgetBooks() {
  localMemo.clear()
  slotsMemo.clear()
  partsMemo.clear()
}

// ——— Gathering another copy: the merge of `src/core` ————————————————————————————————————————————————————————————

/**
 * Brings another copy of a book in (`mergeInto`): what does not clash comes in by itself, a change already seen here
 * or older stays out, a decision already taken is applied, and what two people changed apart from the same text
 * waits as a conflict for a person. `by` is who gathers it.
 */
export function mergeBook(book: string, other: BookState, by: string): MergeReport & { alignment: AlignmentReport } {
  const rec = commit(shelf.get(scoped(book)) ?? emptyBook(book))
  const at = new Date().toISOString()
  const { state, report } = mergeInto(rec.state, { ...other, book, pending: [] }, personOf(by), at)
  shelf.put(scoped(book), { state, working: state.usfm, pendingBy: null, pendingAt: [] })
  // The alignment follows its text: what each was made on is weighed against the verse as it now stands here.
  const theirs = other.alignment ? { ...other.alignment, pending: [] } : emptyAlignmentLayer()
  const merged = mergeAlignments(state.alignment ?? emptyAlignmentLayer(), theirs, (p) => alignedText(book, p.chapter, p.verse), personOf(by), at)
  shelf.put(scoped(book), { state: { ...state, alignment: merged.layer }, working: state.usfm, pendingBy: null, pendingAt: [] })
  return { ...withDecidedTaken(rec.state.usfm, state.usfm, report), alignment: merged.report }
}

/**
 * A choice already made, applied again, brings the other copy's text only where that was the choice: those places
 * are counted as taken; where this copy's text was kept, nothing came in.
 */
function withDecidedTaken(before: string, after: string, report: MergeReport): MergeReport {
  const was = new Map(placesOf(before).map((p) => [`${p.chapter}:${p.from}-${p.to}`, p.key]))
  const now = new Map(placesOf(after).map((p) => [`${p.chapter}:${p.from}-${p.to}`, p.key]))
  const id = (p: Place) => `${p.chapter}:${p.from}-${p.to}`
  const changed = report.decided.filter((p) => was.get(id(p)) !== now.get(id(p)))
  return { ...report, taken: [...report.taken, ...changed] }
}

/** What gathering another copy would do, before anything is done. */
export function mergePreview(book: string, other: BookState, by: string): MergeReport & { same: number } {
  const rec = commit(shelf.get(scoped(book)) ?? emptyBook(book))
  const merged = mergeInto(rec.state, { ...other, book, pending: [] }, personOf(by), new Date().toISOString())
  const report = withDecidedTaken(rec.state.usfm, merged.state.usfm, merged.report)
  // Verses the other copy brings that this one already says: the same text, or one it took in and went past (a place
  // the other copy leaves empty is not counted: it brings nothing there).
  const mine = new Map(placesOf(rec.state.usfm).map((p) => [`${p.chapter}:${p.from}-${p.to}`, p.key]))
  const theirs = placesOf(other.usfm).filter((p) => p.text)
  const same = theirs.filter((p) => mine.get(`${p.chapter}:${p.from}-${p.to}`) === p.key).length
  const past = report.kept.filter((k) => theirs.some((p) => p.chapter === k.chapter && p.from === k.from && p.to === k.to)).length
  return { ...report, same: same + past }
}

/**
 * A copy of a book from loose verses (a work file of the first kind, a USFM file read in, work from another
 * computer): laid out as this book is, each verse a change of its writer. `origin` tells these writers apart from the
 * same names on this device (`Bea@origin`), and is the same each time the same file is read, so reading it again
 * brings nothing new.
 */
export function bookFrom(
  book: string,
  verses: Array<{ chapter: number; verse: number; to?: number; text: string; by: string | null }>,
  origin: string,
  at = new Date().toISOString()
): BookState {
  const parts = splitBook(emptyBook(book).state.usfm)
  const journal: Entry[] = []
  const seqs = new Map<string, number>()
  const byChapter = new Map<number, typeof verses>()
  for (const v of verses) if (v.text.trim()) byChapter.set(v.chapter, [...(byChapter.get(v.chapter) ?? []), v])
  for (const [chapter, list] of [...byChapter].sort((x, y) => x[0] - y[0])) {
    let text = parts.chapters.get(chapter) ?? `\\c ${chapter}\n\\p\n`
    const writers = new Map<string, typeof verses>()
    for (const v of list) writers.set(v.by ?? '', [...(writers.get(v.by ?? '') ?? []), v])
    for (const [name, mine] of writers) {
      const edits = mine.map((v) => {
        const to = v.to ?? v.verse
        return { from: v.verse, to, text: v.text, leads: to === v.verse ? leadsOf(book, chapter, v.verse) : [] }
      })
      const after = applyVerseEdits(text, chapter, edits)
      const person = { name, device: origin }
      const key = personKey(person)
      const made = changesBetween(text, after, person, (seqs.get(key) ?? 0) + 1, at)
      seqs.set(key, (seqs.get(key) ?? 0) + made.length)
      journal.push(...made)
      text = after
    }
    parts.chapters.set(chapter, text)
  }
  return { book, usfm: joinBook(parts), journal, pending: [] }
}

// ——— The alignment: a layer of the book, with its own diary (`src/core/alignment.ts`) ——————————————————————————

/** A verse's text as the aligner reads it: the text that says it (joined verses by their first), one line. */
const alignedText = (book: string, chapter: number, verse: number) => textOf(book, chapter, verse).replace(/\n/g, ' ').trim()

/** The alignment that counts for a verse with a text: its links, the verse's text they were made on, who made them. */
export function alignmentAt(book: string, chapter: number, verse: number, source: string): { groups: unknown; on: string; by: string; at: string } | null {
  const rec = shelf.get(scoped(book))
  if (!rec) return null
  const id = alignmentPlaceId({ chapter, verse, source })
  const making = rec.alignPending?.[id]
  if (making) return { groups: making.groups, on: making.on, by: rec.pendingBy ?? '', at: '' }
  const e = rec.state.alignment?.current[id]
  return e ? { groups: e.groups, on: e.on, by: nameOf(e.by), at: e.at } : null
}

/** `by` aligned a verse with a text: kept at once, taken by the journal a moment after (as the text is). */
export function setAlignment(book: string, chapter: number, verse: number, source: string, on: string, groups: unknown, by: string) {
  const key = scoped(book)
  let rec = shelf.get(key) ?? emptyBook(book)
  if (rec.pendingBy !== null && rec.pendingBy !== by) rec = commit(rec)
  const place = { chapter, verse, source }
  rec = { ...rec, pendingBy: by, alignPending: { ...rec.alignPending, [alignmentPlaceId(place)]: { place, on, groups } } }
  shelf.put(key, rec)
  commitSoon(key)
}

/** Two alignments of a verse's same text, made apart by two people: which each is, and who made it. */
export function alignmentConflictAt(book: string, chapter: number, verse: number, source: string) {
  const c = shelf.get(scoped(book))?.state.alignment?.pending.find((x) => alignmentPlaceId(x.place) === alignmentPlaceId({ chapter, verse, source }))
  return c ? { id: c.id, mine: { groups: c.mine.groups, by: nameOf(c.mine.by) }, theirs: { groups: c.theirs.groups, by: nameOf(c.theirs.by) } } : null
}

/** Every alignment of a book waiting for a person to choose. */
export const alignmentConflictsOf = (book: string): AlignmentPlace[] => (shelf.get(scoped(book))?.state.alignment?.pending ?? []).map((c) => c.place)

/** Chooses between two alignments of a verse (`decideAlignment`): the choice is in the diary, not asked again. */
export function chooseAlignment(book: string, chapter: number, verse: number, source: string, keepTheirs: boolean, by: string) {
  const key = scoped(book)
  const rec = commit(shelf.get(key) ?? emptyBook(book))
  const c = rec.state.alignment?.pending.find((x) => alignmentPlaceId(x.place) === alignmentPlaceId({ chapter, verse, source }))
  if (!c || !rec.state.alignment) return
  const alignment = decideAlignment(rec.state.alignment, c.id, keepTheirs ? 'theirs' : 'mine', personOf(by), new Date().toISOString())
  shelf.put(key, { ...rec, state: { ...rec.state, alignment } })
}

/** An alignment layer made of loose alignments (a file of the first kind): each its maker's, from `origin`. */
export function alignmentFrom(list: Array<{ chapter: number; verse: number; source: string; groups: unknown; text: string; by?: string; at?: string }>, origin: string): AlignmentLayer {
  let layer = emptyAlignmentLayer()
  for (const a of list) layer = recordAlignment(layer, { name: a.by ?? '', device: origin }, { chapter: a.chapter, verse: a.verse, source: a.source }, a.text, a.groups, a.at ?? '')
  return layer
}

/**
 * The alignments the prototype kept verse by verse (by book and project), moved into each book's layer once: each
 * as its maker's alignment, made when it was.
 */
export function moveAlignmentsIn() {
  const prefix = `${KEY}.alineacion.`
  for (const k of keysUnder(prefix)) {
    if (k.startsWith(`${prefix}fuente.`)) continue
    const [id, source, chapter, verse] = k.slice(prefix.length).split('.')
    let kept: { groups: unknown; text: string; by?: string; at?: string } | null = null
    try {
      kept = JSON.parse(read(k) ?? 'null')
    } catch {
      /* a broken one is dropped */
    }
    if (kept && id && source) {
      const code = id.split('~')[0]
      const rec = commit(shelf.get(id) ?? emptyBook(code))
      const layer = recordAlignment(rec.state.alignment ?? emptyAlignmentLayer(), personOf(kept.by ?? ''), { chapter: Number(chapter), verse: Number(verse), source }, kept.text, kept.groups, kept.at ?? new Date().toISOString())
      shelf.put(id, { ...rec, state: { ...rec.state, alignment: layer } })
    }
    write(k, null)
  }
}

// ——— What waits for a person: the merge's pending conflicts ——————————————————————————————————————————————————————

const pendingOf = (book: string): Conflict[] => shelf.get(scoped(book))?.state.pending ?? []

/** A verse's lines in a piece of USFM (a conflict's other version keeps them, as a poem's). */
function linesIn(usfm: string, chapter: number, verse: number): string {
  const span = listVerseSpans(usfm).find((s) => s.chapter === chapter && s.verse === verse)
  return span ? verseLinesText(usfm, span) : ''
}

/** Another version of a verse, received from someone while this computer had its own: kept until someone chooses. */
export interface OtherVersion {
  text: string
  by: string
}

/** The other version waiting at a verse: the merge's conflict over its text, as received. */
export function otherVersion(book: string, chapter: number, verse: number): OtherVersion | null {
  const c = pendingOf(book).find((x) => x.kind === 'texto' && x.place.chapter === chapter && x.place.from === verse)
  return c ? { text: linesIn(c.theirs.usfm, chapter, verse) || c.theirs.text, by: c.theirs.by ? nameOf(c.theirs.by) : '' } : null
}

/** Every version of a book waiting for a choice, in order. */
export function otherVersionsOf(book: string): Array<{ chapter: number; verse: number } & OtherVersion> {
  return pendingOf(book)
    .filter((x) => x.kind === 'texto')
    .map((x) => ({ chapter: x.place.chapter, verse: x.place.from, ...otherVersion(book, x.place.chapter, x.place.from)! }))
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/** A person decides a conflict (`decide`): the choice goes into the journal and is not asked again anywhere. */
function settle(book: string, conflict: Conflict, keepTheirs: boolean, by: string) {
  const rec = commit(shelf.get(scoped(book)) ?? emptyBook(book))
  const state = decide(rec.state, conflict.id, { keep: keepTheirs ? 'theirs' : 'mine' }, personOf(by), new Date().toISOString())
  shelf.put(scoped(book), { state, working: state.usfm, pendingBy: null, pendingAt: [] })
}

/** Keeps the other version (it replaces the verse) or this one; either way the choice is made, by `by`. */
export function chooseVersion(book: string, chapter: number, verse: number, keepOther: boolean, by: string) {
  const c = pendingOf(book).find((x) => x.kind === 'texto' && x.place.chapter === chapter && x.place.from === verse)
  if (c) settle(book, c, keepOther, by)
}

/**
 * Verses joined on one side and not on the other (design 6.2, «choque de estructura»): this phone says 1 and 2 apart
 * and the other said them as one (1–2), or the other way round, with text on both sides. Not to be decided verse by
 * verse: the person chooses which way stays for the whole stretch.
 */
export interface StructureConflict {
  chapter: number
  /** The stretch the two ways cover together. */
  from: number
  to: number
  /** The way received: its verses, each one or a join, with its text. */
  received: Array<{ from: number; to: number; text: string; by: string }>
}

const asStretch = (c: Conflict): StructureConflict => ({
  chapter: c.place.chapter,
  from: c.place.from,
  to: c.place.to,
  received: listVerseSpans(c.theirs.usfm)
    .filter((s) => s.chapter === c.place.chapter)
    .map((s) => ({ from: s.verse, to: Math.max(s.verse, s.verseTo), text: verseLinesText(c.theirs.usfm, s), by: c.theirs.by ? nameOf(c.theirs.by) : '' })),
})

export function structureConflictsOf(book: string, chapter?: number): StructureConflict[] {
  return pendingOf(book)
    .filter((x) => x.kind === 'estructura' && (chapter === undefined || x.place.chapter === chapter))
    .map(asStretch)
    .sort((a, b) => a.chapter - b.chapter || a.from - b.from)
}

export const structureConflictAt = (book: string, chapter: number, verse: number) =>
  structureConflictsOf(book, chapter).find((c) => c.from <= verse && verse <= c.to) ?? null

/** Chooses the way a stretch stays: this phone's, or the one received (its joins and its texts), by `by`. */
export function chooseStructure(book: string, chapter: number, from: number, keepReceived: boolean, by: string) {
  const c = pendingOf(book).find((x) => x.kind === 'estructura' && x.place.chapter === chapter && x.place.from === from)
  if (c) settle(book, c, keepReceived, by)
}

/**
 * Versions the prototype kept waiting verse by verse, before the merge: each becomes the merge's conflict, the version
 * received set where it goes in a copy of the book, so choosing it puts it in as it was received.
 */
function moveLegacyWaiting() {
  for (const k of keysUnder(`${KEY}.otra.`)) {
    const [, , , code] = k.split('.')
    const [chapter, verse] = placeIn(k)
    let other: { text: string; by: string } | null = null
    try {
      other = JSON.parse(read(k) ?? 'null')
    } catch {
      /* a broken one is dropped */
    }
    if (code && other?.text) {
      const to = joinedTo(code, chapter, verse) ?? verse
      waitAt(code, { chapter, from: verse, to }, 'texto', [{ from: verse, to, text: other.text }], other.by)
    }
    write(k, null)
  }
  for (const k of keysUnder(`${KEY}.estructura.`)) {
    const code = k.split('.')[3]
    let c: StructureConflict | null = null
    try {
      c = JSON.parse(read(k) ?? 'null')
    } catch {
      /* a broken one is dropped */
    }
    if (code && c?.received.length) waitAt(code, { chapter: c.chapter, from: c.from, to: c.to }, 'estructura', c.received, c.received[0].by)
    write(k, null)
  }
}

/** Leaves a conflict waiting in a book: what is here against these verses, received from `by`. */
function waitAt(book: string, place: Place, kind: Conflict['kind'], verses: Array<{ from: number; to: number; text: string }>, by: string) {
  const rec = commit(shelf.get(scoped(book)) ?? emptyBook(book))
  const empty: VerseSlotEdit[] = []
  for (let v = place.from; v <= place.to; v++) empty.push({ from: v, to: v, text: '' })
  const theirsBook = applyVerseEdits(applyVerseEdits(rec.state.usfm, place.chapter, empty), place.chapter, verses)
  const usfm = usfmOfRange(theirsBook, place)
  const inRange = (u: string) => placesOf(u).filter((p) => p.chapter === place.chapter && p.from <= place.to && p.to >= place.from && p.text)
  const said = (ps: ReturnType<typeof placesOf>) => ps.map((p) => p.text).join(' ')
  const mine = inRange(rec.state.usfm)
  const theirs = inRange(theirsBook)
  const conflict: Conflict = {
    id: `${place.chapter}:${place.from}-${place.to}:${kind}:${theirs.map((p) => p.key).join('+')}`,
    place,
    kind,
    mine: { text: said(mine), key: mine.map((p) => p.key).join('+') },
    theirs: { text: said(theirs), key: theirs.map((p) => p.key).join('+'), by: `${by}@prototipo`, usfm },
    foundAt: new Date().toISOString(),
    foundBy: personKey(personOf('')),
  }
  if (!rec.state.pending.some((x) => x.id === conflict.id)) shelf.put(scoped(book), { ...rec, state: { ...rec.state, pending: [...rec.state.pending, conflict] } })
}
