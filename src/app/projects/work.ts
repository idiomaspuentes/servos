/**
 * The translation of a book, verse by verse, and who wrote each verse. A team may split a book by chapters, by
 * sections or by single verses, each person on their own computer, and gather the work later on the one that keeps
 * the master copy: the verse is the smallest part anyone can take, so it is what records its writer, and chapters and
 * sections only add up their verses.
 *
 * In the prototype this lives in this browser (localStorage). Wired, each change is an entry of the book's journal
 * (design, section 6), and gathering work merges journals; a verse two people wrote differently keeps both until
 * someone chooses.
 */

const KEY = 'servos.prototipo'
const draftKey = (book: string, chapter: number, verse: number) => `${KEY}.borrador.${book}.${chapter}.${verse}`
const authorKey = (book: string, chapter: number, verse: number) => `${KEY}.autor.${book}.${chapter}.${verse}`
const otherKey = (book: string, chapter: number, verse: number) => `${KEY}.otra.${book}.${chapter}.${verse}`
const placeKey = (person: string, book: string, app: string) => `${KEY}.posicion.${person}.${book}.${app}`
const joinKey = (book: string, chapter: number, verse: number) => `${KEY}.union.${book}.${chapter}.${verse}`

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

/** The verse as written: its lines parted by `\n`, or empty. */
export const readDraft = (book: string, chapter: number, verse: number): string => read(draftKey(book, chapter, verse)) ?? ''

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

export function writeDraft(book: string, chapter: number, verse: number, text: string, by: string) {
  write(draftKey(book, chapter, verse), text)
  write(authorKey(book, chapter, verse), text.trim() ? by : null)
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

/** Keeps the other version (it replaces the verse) or this one; either way the choice is made. */
export function chooseVersion(book: string, chapter: number, verse: number, keepOther: boolean) {
  const other = otherVersion(book, chapter, verse)
  if (other && keepOther) writeDraft(book, chapter, verse, other.text, other.by)
  write(otherKey(book, chapter, verse), null)
}

/** How far the translation of some verses has gone, and who wrote them. */
export interface WorkDone {
  written: number
  total: number
  /** Person → verses they wrote, most first. */
  people: Array<[string, number]>
  /** Verses with two versions waiting for a choice. */
  choices: number
}

export function workOf(book: string, chapter: number, verses: number[]): WorkDone {
  const people = new Map<string, number>()
  let written = 0
  let choices = 0
  for (const v of verses) {
    const by = authorOf(book, chapter, v)
    if (textOf(book, chapter, v).trim()) written++
    if (by) people.set(by, (people.get(by) ?? 0) + 1)
    if (otherVersion(book, chapter, v)) choices++
  }
  return { written, total: verses.length, people: [...people].sort((a, b) => b[1] - a[1]), choices }
}

/** Work received from another computer: some verses of a book, written by one person. */
export interface WorkFile {
  from: string
  book: string
  /** What the file holds, as the person would say it («Jonás 3», «Jonás 1:1–10»). */
  label: string
  verses: Array<{ chapter: number; verse: number; text: string }>
}

export interface Received {
  /** Verses that were empty here and now have the received text. */
  taken: number
  /** Verses that already had the same text. */
  same: number
  /** Verses that had another text here: the received one waits as the other version. */
  choices: number
}

/** Gathers a file of work into this computer: nothing written here is overwritten without a choice. */
export function receiveWork(file: WorkFile): Received {
  const result: Received = { taken: 0, same: 0, choices: 0 }
  for (const { chapter, verse, text } of file.verses) {
    const here = readDraft(file.book, chapter, verse)
    if (!here.trim()) {
      writeDraft(file.book, chapter, verse, text, file.from)
      result.taken++
    } else if (here.trim() === text.trim()) {
      result.same++
    } else {
      write(otherKey(file.book, chapter, verse), JSON.stringify({ text, by: file.from } satisfies OtherVersion))
      result.choices++
    }
  }
  return result
}

/** Where a person was in a book with a mini app, to open it there again. */
export interface Place {
  chapter: number
  verse: number
}

export function placeOf(person: string, book: string, app: string): Place | null {
  const raw = read(placeKey(person, book, app))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Place
  } catch {
    return null
  }
}

export const keepPlace = (person: string, book: string, app: string, place: Place) => write(placeKey(person, book, app), JSON.stringify(place))

/** The mini app a person last opened from a book: what «Continue» goes back to, and whose progress the chapters show. */
const lastAppKey = (person: string, book: string) => `servos.prototipo.ultimaApp.${person}.${book}`
export const lastAppOf = (person: string, book: string): string | null => read(lastAppKey(person, book))
export const keepLastApp = (person: string, book: string, app: string) => write(lastAppKey(person, book), app)

/**
 * A note the team writes while studying a verse or a section: what it says, who speaks to whom, what will be hard to
 * translate (as translationCore 4's comprehension notes). It is read again while translating those verses. Anyone
 * may correct it; it keeps who wrote it last.
 */
export interface StudyNote {
  verses: number[]
  text: string
  by: string
}

const studyKey = (book: string, chapter: number) => `${KEY}.comprension.${book}.${chapter}`

export function studyNotesOf(book: string, chapter: number): StudyNote[] {
  try {
    return JSON.parse(read(studyKey(book, chapter)) ?? '[]') as StudyNote[]
  } catch {
    return []
  }
}

const sameVerses = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/** The note written on exactly these verses (a verse, or a section), if any. */
export const studyNoteOn = (book: string, chapter: number, verses: number[]): StudyNote | null =>
  studyNotesOf(book, chapter).find((n) => sameVerses(n.verses, verses)) ?? null

/** The notes about any of these verses: written on them, on a section holding them, or on a verse of them. */
export const studyNotesAbout = (book: string, chapter: number, verses: number[]): StudyNote[] =>
  studyNotesOf(book, chapter).filter((n) => n.verses.some((v) => verses.includes(v)))

/** Writes the note on these verses; an empty one is taken away. */
export function writeStudyNote(book: string, chapter: number, verses: number[], text: string, by: string) {
  const others = studyNotesOf(book, chapter).filter((n) => !sameVerses(n.verses, verses))
  const notes = text.trim() ? [...others, { verses, text, by }].sort((a, b) => a.verses[0] - b.verses[0]) : others
  write(studyKey(book, chapter), notes.length ? JSON.stringify(notes) : null)
}
