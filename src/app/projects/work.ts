/**
 * The translation of a book, verse by verse, and who wrote each verse. A team may split a book by chapters, by
 * sections or by single verses, each person on their own computer, and gather the work later on the one that keeps
 * the master copy: the verse is the smallest part anyone can take, so it is what records its writer, and chapters and
 * sections only add up their verses.
 *
 * The text itself, verse by verse, is kept behind one door (bookText.ts); here is what is reckoned from it, and what
 * is the person's own: where they were, and the notes written while studying.
 */

import { authorOf, bookFrom, mergeBook, otherVersion, textOf } from './bookText'

// The book's text is the door's (bookText.ts); it is offered from here too, where the screens have always asked for it.
export * from './bookText'

const KEY = 'servos.prototipo'
const placeKey = (person: string, book: string, app: string) => `${KEY}.posicion.${person}.${book}.${app}`

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

/**
 * Gathers a file of work into this computer, as another copy of the book (the merge of `src/core`): nothing written
 * here is overwritten without a choice. `by` is who gathers it.
 */
export function receiveWork(file: WorkFile, by: string): Received {
  const theirs = bookFrom(
    file.book,
    file.verses.map((v) => ({ ...v, by: file.from })),
    `obra:${file.from}:${file.label}`
  )
  const same = file.verses.filter((v) => v.text.trim() && textOf(file.book, v.chapter, v.verse).trim() === v.text.trim()).length
  const report = mergeBook(file.book, theirs, by)
  return { taken: report.taken.length, same, choices: report.conflicts.length }
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
