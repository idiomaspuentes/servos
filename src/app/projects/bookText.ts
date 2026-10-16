/**
 * The one door to a book's text: each verse as written, who wrote it, the verses joined, the versions waiting for a
 * choice, and the stretches whose joins two copies disagree on. Nothing else reads or writes them (a test checks it),
 * so what keeps them can change behind this door without the screens knowing.
 *
 * In the prototype they live in this browser (localStorage), verse by verse. Wired (design, section 12, stage 1), the
 * door keeps the book as one USFM file and its journal (`src/core`): each change an entry of the journal, gathering a
 * merge of journals, a verse two people wrote differently a conflict until someone chooses.
 */

const KEY = 'servos.prototipo'
const draftKey = (book: string, chapter: number, verse: number) => `${KEY}.borrador.${book}.${chapter}.${verse}`
const authorKey = (book: string, chapter: number, verse: number) => `${KEY}.autor.${book}.${chapter}.${verse}`
const otherKey = (book: string, chapter: number, verse: number) => `${KEY}.otra.${book}.${chapter}.${verse}`
const joinKey = (book: string, chapter: number, verse: number) => `${KEY}.union.${book}.${chapter}.${verse}`
const structureKey = (book: string, chapter: number, from: number) => `${KEY}.estructura.${book}.${chapter}.${from}`

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

/** The keys under a prefix: a book's verses, its versions waiting, its conflicts. */
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

/** The verse as written: its lines parted by `\n`, or empty. */
export const readDraft = (book: string, chapter: number, verse: number): string => read(draftKey(book, chapter, verse)) ?? ''

export function writeDraft(book: string, chapter: number, verse: number, text: string, by: string) {
  write(draftKey(book, chapter, verse), text)
  write(authorKey(book, chapter, verse), text.trim() ? by : null)
}

/** Who wrote the verse last, or null when nobody has; of a verse joined to the one before, who wrote them together. */
export const authorOf = (book: string, chapter: number, verse: number): string | null => {
  const at = joinStartOf(book, chapter, verse)
  return readDraft(book, chapter, at).trim() ? read(authorKey(book, chapter, at)) : null
}

/**
 * Verses joined: when a language says two verses (or more) in one sentence, as USFM's `\v 1-2`. The join is kept on the
 * first verse (the last one it reaches), and so is the text of them all; the others stay empty while joined.
 */
export function joinedTo(book: string, chapter: number, verse: number): number | null {
  const end = Number(read(joinKey(book, chapter, verse)))
  return Number.isFinite(end) && end > verse ? end : null
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

/**
 * Joins the verses this one is in with the next verse (and with those that one is joined with): their texts follow
 * one another in the first verse, and the next stays empty while joined.
 */
export function joinWithNext(book: string, chapter: number, verse: number, by: string) {
  const start = joinStartOf(book, chapter, verse)
  const next = (joinedTo(book, chapter, start) ?? start) + 1
  const end = joinedTo(book, chapter, next) ?? next
  const text = [readDraft(book, chapter, start), ...Array.from({ length: end - next + 1 }, (_, i) => readDraft(book, chapter, next + i))]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' ')
  writeDraft(book, chapter, start, text, by)
  for (let v = next; v <= end; v++) {
    write(draftKey(book, chapter, v), null)
    write(authorKey(book, chapter, v), null)
  }
  write(joinKey(book, chapter, next), null)
  write(joinKey(book, chapter, start), String(end))
}

/** Separates the verses this one is joined with: the text stays in the first, for the person to share out. */
export function separateJoined(book: string, chapter: number, verse: number) {
  write(joinKey(book, chapter, joinStartOf(book, chapter, verse)), null)
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
  for (const k of keysUnder(`${KEY}.borrador.${book}.`)) {
    const [chapter, verse] = placeIn(k)
    const text = read(k) ?? ''
    const end = joinedTo(book, chapter, verse)
    if (!text.trim() && end === null) continue
    out.push({ chapter, verse, text, by: read(authorKey(book, chapter, verse)), ...(end !== null ? { joinedTo: end } : {}) })
  }
  return out.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/**
 * A stretch of a chapter takes these verses, each alone or a join, with their texts and writers: what the stretch held
 * goes (its texts, writers and joins; and, with `others`, the versions waiting in it).
 */
export function replaceStretch(
  book: string,
  chapter: number,
  from: number,
  to: number,
  units: Array<{ from: number; to: number; text: string; by: string | null }>,
  { others = false }: { others?: boolean } = {}
) {
  for (let v = from; v <= to; v++) {
    write(draftKey(book, chapter, v), null)
    write(authorKey(book, chapter, v), null)
    write(joinKey(book, chapter, v), null)
    if (others) write(otherKey(book, chapter, v), null)
  }
  for (const u of units) {
    write(draftKey(book, chapter, u.from), u.text)
    write(authorKey(book, chapter, u.from), u.by || null)
    if (u.to > u.from) write(joinKey(book, chapter, u.from), String(u.to))
  }
}

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
  if (other && keepOther) writeDraft(book, chapter, verse, other.text, other.by)
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
