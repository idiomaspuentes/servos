/**
 * Sharing work between computers without internet (design, section 7, «the work package»): «Share» puts books of a
 * project in one file, `.servos`, and «Receive» gathers such a file in, saying first what it brings and what it would
 * change, book by book. Everything goes, without asking layer by layer: each book itself (its USFM and its journal,
 * and its alignment with each text, with the alignment's own diary: `src/core`), and what hangs on each verse with the
 * text it was made on (the checks with notes and with words, the study notes), the recordings with their sound; and the
 * project's glossary, settings and mini apps.
 *
 * A book is gathered by the merge of `src/core` (the book's door, `mergeBook`): what does not clash comes in by
 * itself, a change already taken here (or older) stays out, a choice someone already made is applied, and what two
 * people changed apart from the same text waits for a person; the choice goes into the journal and is not asked again
 * wherever the book goes. The conflicts waiting on a phone stay there (they are not shared). The alignment follows its
 * text (design, 6.8, `mergeAlignments`): the one made on the text that stays wins; two made apart, neither from the
 * other, are a choice for a person. Each other layer follows its text too: of a check, or a passage's «yes», the one
 * given on the text that stays here wins over one given on another; of two checks on the same text, the one given
 * knowing the other, and two given apart wait side by side for a person to choose (the date decides nothing); what was seen to improve in a passage is gathered, none lost, and one marked improved anywhere
 * comes in improved; the glossary is gathered word by word; two study notes on the same verses stay both; recordings
 * take by take, none lost.
 *
 * A file of the first kind (version 1) carried loose verses instead of the book; so does a USFM file read in. They
 * are made a copy of the book, each verse its writer's change, and gathered the same way.
 */

import type { AlignmentGroup } from '@usfm-tools/types'
import { gatherGlossary, readGlossary, saveGlossaryEntry, type GlossaryEntry } from './glossary'
import { closer, privacyOf, type BookEntry, type Phase, type Project } from './model'
import { gatherCheck, type NoteCheck } from './noteChecks'
import { blobOf, gatherTakes, keepSound, recordedPlaces, soundBase64, takesOf, type Take } from './recordings'
import { placesOf, textKey, type BookState } from '../../core'
import { inProject, scoped } from './scope'
import { textKey as passageTextKey, type Criterion, type Observation, type PassageAnswer } from './passageReview'
import { alignmentFrom, bookFrom, bookStateOf, joinStartOf, mergeBook, mergePreview, textOf, writtenVerses, type StudyNote } from './work'

export const SHARE_FORMAT = 'servos-compartir'

interface SharedVerse {
  chapter: number
  verse: number
  text: string
  by: string | null
  /** The last verse joined to this one, when it starts a join. */
  joinedTo?: number
}

interface SharedAlignment {
  chapter: number
  verse: number
  source: string
  groups: AlignmentGroup[]
  /** The verse's text it was made on. */
  text: string
  by?: string
  at?: string
}

export interface SharedBook {
  code: string
  phase: Phase
  /** Its name in the team's language, if the team gave it one. */
  name?: string
  /** Everyone translates it and the versions are brought together (`BookEntry.together`). */
  together?: boolean
  /** The book: its USFM, its journal and the choices still open on the phone that shares it. */
  state?: BookState
  /** Instead of the book, loose verses: a file of the first kind, or a USFM file read in. */
  verses?: SharedVerse[]
  /** A file of the first kind: the alignments alone (version 2 carries them in `state`). */
  alignments?: SharedAlignment[]
  /** By store (`revisionNota`, `revisionPalabra`), then by what was checked. */
  checks: Record<string, Record<string, NoteCheck>>
  /** The passage review: the questions answered «yes» for each section (by `chapter.first`), on the text they had. */
  passages?: Record<string, Partial<Record<Criterion, PassageAnswer>>>
  /** What was seen to improve, by `chapter.verse`. */
  observations?: Record<string, Observation[]>
  studyNotes: Array<{ chapter: number; notes: StudyNote[] }>
  /** The recordings of each place, every take with its sound (base64; `withSounds` adds it). */
  recordings?: Array<{ chapter: number; verse: number; chosen: string | null; knew?: string[]; waiting?: string[]; takes: Array<Take & { sound?: string }> }>
}

export interface SharedFile {
  format: typeof SHARE_FORMAT
  /** 2: books as USFM and journal; 1: loose verses (still read). */
  version: 1 | 2
  from: string
  at: string
  project: Omit<Project, 'books'>
  books: SharedBook[]
  glossary: GlossaryEntry[]
}

const P = 'servos.prototipo'
const keys = (prefix: string): string[] => {
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
const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* the phone is full: what fitted stays */
  }
}
const json = <T,>(k: string): T | null => {
  try {
    return JSON.parse(get(k) ?? 'null') as T | null
  } catch {
    return null
  }
}

/** A book of this phone, as it is shared. */
export function shareBook(code: string, phase: Phase): SharedBook {
  // The book itself, its journal brought up to what is written now; what waits for a choice here is not shared.
  const state = bookStateOf(code)
  const book = scoped(code)
  const checks: SharedBook['checks'] = {}
  for (const store of ['revisionNota', 'revisionPalabra']) {
    for (const k of keys(`${P}.${store}.${book}.`)) {
      const check = json<NoteCheck>(k)
      if (check) (checks[store] ??= {})[k.slice(`${P}.${store}.${book}.`.length)] = check
    }
  }
  const passages: NonNullable<SharedBook['passages']> = {}
  for (const k of keys(`${P}.pasaje.${book}.`)) {
    const kept = json<Partial<Record<Criterion, PassageAnswer>>>(k)
    if (kept) passages[k.slice(`${P}.pasaje.${book}.`.length)] = kept
  }
  const observations: NonNullable<SharedBook['observations']> = {}
  for (const k of keys(`${P}.observacion.${book}.`)) {
    const list = json<Observation[]>(k)
    if (list?.length) observations[k.slice(`${P}.observacion.${book}.`.length)] = list
  }
  const studyNotes = keys(`${P}.comprension.${book}.`).flatMap((k) => {
    const notes = json<StudyNote[]>(k)
    return notes?.length ? [{ chapter: Number(k.split('.').pop()), notes }] : []
  })
  // The alignment goes in the book, with its diary; so do the choices still open, for whoever has one of their two versions.
  return { code, phase, ...(state ? { state } : { verses: [] }), checks, passages, observations, studyNotes, recordings: recordedPlaces(code) }
}

/** The file with the sound of every take on this phone in it (kept apart from the rest, where sound is kept). */
export async function withSounds(file: SharedFile): Promise<SharedFile> {
  const books = await Promise.all(
    file.books.map(async (b) => ({
      ...b,
      recordings: await Promise.all(
        (b.recordings ?? []).map(async (r) => ({
          ...r,
          takes: (await Promise.all(r.takes.map(async (x) => ({ ...x, sound: (await soundBase64(x.id)) ?? undefined })))).filter((x) => x.sound),
        }))
      ),
    }))
  )
  return { ...file, books }
}

/** These books of a project, with its glossary and settings, as one file. */
export function shareProject(project: Project, codes: string[], from: string, now = new Date()): SharedFile {
  const { books, ...rest } = project
  return inProject(project.id, () => ({
    format: SHARE_FORMAT,
    version: 2,
    from,
    at: now.toISOString(),
    project: rest,
    books: books
      .filter((b) => codes.includes(b.code))
      .map((b) => ({ ...shareBook(b.code, b.phase), ...(b.name ? { name: b.name } : {}), ...(b.together ? { together: true } : {}) })),
    glossary: readGlossary(project.id),
  }))
}

/** A received file, if it is one of Servos's. */
export function readShared(text: string): SharedFile | null {
  try {
    const file = JSON.parse(text) as SharedFile
    return file?.format === SHARE_FORMAT && Array.isArray(file.books) ? file : null
  } catch {
    return null
  }
}

/** What receiving a book would do here, before anything is done. */
export interface BookPreview {
  code: string
  /** The book is not in the project it goes to. */
  isNew: boolean
  /** Verses only the file has: they come in. */
  taken: number
  /** Verses with the same text on both sides. */
  same: number
  /** Verses written differently: the received one will wait as the other version. */
  choices: number
  /**
   * Verses that already have another version waiting for a choice, different again: that one keeps waiting, and the
   * received one does not come in (choosing first, then receiving again, brings it).
   */
  waiting: number
  /** Alignments, checks and study notes it brings. */
  alignments: number
  checks: number
  studyNotes: number
  /** Recordings it brings that are not here. */
  recordings: number
}

/** Who sent a file and when, and who gathers it here: what a book received is a copy of, and who merges it. */
export interface Gathering {
  from: string
  at: string
  person: string
}

/**
 * The copy of the book a shared book is: the book itself, or one made of its loose verses, each its writer's change.
 * Their writers are told apart from the same names here by where they came from; the same file gives the same copy.
 */
export function copyOf(book: SharedBook, from: Gathering): BookState {
  if (book.state) return book.state
  const verses = (book.verses ?? []).map((v) => ({ chapter: v.chapter, verse: v.verse, to: v.joinedTo, text: v.text, by: v.by }))
  const origin = `${from.from}~${from.at}~${textKey(JSON.stringify(verses))}`.replace(/@/g, '')
  const copy = bookFrom(book.code, verses, origin)
  return book.alignments?.length ? { ...copy, alignment: alignmentFrom(book.alignments, origin) } : copy
}

/** How many verses with text a shared book brings. */
export const versesIn = (book: SharedBook): number =>
  book.state ? placesOf(book.state.usfm).filter((p) => p.text).length : (book.verses ?? []).filter((v) => v.text.trim()).length

export function previewBook(book: SharedBook, isNew: boolean, from: Gathering): BookPreview {
  const r = mergePreview(book.code, copyOf(book, from), from.person)
  const p: BookPreview = {
    code: book.code,
    isNew,
    taken: r.taken.length,
    // The same text, or one this phone has already taken in and gone past.
    same: r.same,
    // Verses (or stretches) to choose in, not conflicts: a verse several wrote waits once for each other version.
    choices: new Set(r.conflicts.map((c) => `${c.place.chapter}:${c.place.from}`)).size,
    waiting: 0,
    alignments: book.state ? Object.keys(book.state.alignment?.current ?? {}).length : (book.alignments?.length ?? 0),
    checks: 0,
    studyNotes: 0,
    recordings: 0,
  }
  p.checks =
    Object.values(book.checks).reduce((n, byId) => n + Object.keys(byId).length, 0) +
    Object.values(book.passages ?? {}).reduce((n, byCriterion) => n + Object.keys(byCriterion).length, 0) +
    Object.values(book.observations ?? {}).reduce((n, list) => n + list.length, 0)
  p.studyNotes = book.studyNotes.reduce((n, c) => n + c.notes.length, 0)
  for (const r of book.recordings ?? []) {
    const here = takesOf(book.code, r.chapter, r.verse)
    p.recordings += r.takes.filter((x) => x.sound && !here.some((y) => y.id === x.id)).length
  }
  return p
}

/** What was done when a book was received. */
export interface BookReceived extends BookPreview {
  /** Alignments and checks taken in (made on the text that stays). */
  alignmentsTaken: number
  /** Alignments made of the same text by two people apart: chosen in the aligner. */
  alignmentChoices: number
  checksTaken: number
  /** Recordings taken in. */
  recordingsTaken: number
}

/** Gathers a received book in: nothing written here is overwritten without a choice; each layer follows its text. */
export function receiveBook(book: SharedBook, isNew: boolean, from: Gathering): BookReceived {
  const result: BookReceived = { ...previewBook(book, isNew, from), alignmentsTaken: 0, alignmentChoices: 0, checksTaken: 0, recordingsTaken: 0 }
  const { code } = book
  // The text, and its alignment after it.
  const merged = mergeBook(code, copyOf(book, from), from.person)
  result.alignmentsTaken = merged.alignment.taken.length + merged.alignment.decided.length
  result.alignmentChoices = merged.alignment.conflicts.length
  // The verses as they say now, after the text was gathered: what an answer was given on is weighed against them.
  const now = new Set(writtenVerses(code).map((v) => v.text.replace(/\s+/g, ' ').trim()))
  const onText = (verseText: string) => now.has(verseText.replace(/\s+/g, ' ').trim())
  // A check follows its text, then its history: two answers given apart wait side by side for a person to choose. The
  // date decides nothing (decided with Abel on 19 October 2026): a device's clock may be wrong.
  for (const [store, byId] of Object.entries(book.checks)) {
    for (const [id, check] of Object.entries(byId)) {
      const k = `${P}.${store}.${scoped(code)}.${id}`
      const mine = json<NoteCheck>(k)
      const kept = gatherCheck(mine, check, mine ? onText(mine.verseText) : false, onText(check.verseText))
      if (kept) {
        set(k, JSON.stringify(kept))
        result.checksTaken++
      }
    }
  }
  // A passage's «yes»: given on the section's text as it stands here. Only its first verse is kept with it, so the
  // section is tried from there, a verse longer each time (a join counts once, as the reviewer reads it).
  const sectionOn = (chapter: number, first: number, key: string) => {
    const texts: string[] = []
    for (let v = first; v < first + 60; v++) {
      if (joinStartOf(code, chapter, v) !== v) continue
      texts.push(textOf(code, chapter, v))
      if (passageTextKey(texts) === key) return true
    }
    return false
  }
  for (const [place, byCriterion] of Object.entries(book.passages ?? {})) {
    const [chapter, first] = place.split('.').map(Number)
    const k = `${P}.pasaje.${scoped(code)}.${place}`
    const mine = json<Partial<Record<Criterion, PassageAnswer>>>(k) ?? {}
    let changed = false
    for (const [criterion, theirs] of Object.entries(byCriterion) as Array<[Criterion, PassageAnswer]>) {
      const here = mine[criterion]
      if (here?.key === theirs.key && here.at === theirs.at) continue
      // A «yes» says one thing: two on the same text are the same answer, whoever gave it and whenever. Only one given on
      // the section as it stands comes in over one given on another text.
      if (!here || (sectionOn(chapter, first, theirs.key) && !sectionOn(chapter, first, here.key))) {
        mine[criterion] = theirs
        changed = true
        result.checksTaken++
      }
    }
    if (changed) set(k, JSON.stringify(mine))
  }
  // What was seen to improve: gathered, none lost; one marked improved on either side stays improved.
  for (const [place, list] of Object.entries(book.observations ?? {})) {
    const k = `${P}.observacion.${scoped(code)}.${place}`
    const mine = json<Observation[]>(k) ?? []
    let changed = false
    for (const o of list) {
      const i = mine.findIndex((x) => x.id === o.id)
      if (i < 0) mine.push(o)
      else if (o.state === 'resuelta' && mine[i].state === 'abierta') mine[i] = o
      else continue
      changed = true
      result.checksTaken++
    }
    if (changed) set(k, JSON.stringify(mine.sort((x, y) => x.at.localeCompare(y.at))))
  }
  for (const { chapter, notes } of book.studyNotes) {
    const k = `${P}.comprension.${scoped(code)}.${chapter}`
    const mine = json<StudyNote[]>(k) ?? []
    const same = (a: number[], b: number[]) => a.join(',') === b.join(',')
    for (const note of notes) {
      const here = mine.find((m) => same(m.verses, note.verses))
      if (!here) mine.push(note)
      else if (here.text.trim() !== note.text.trim() && !here.text.includes(note.text.trim())) {
        // Two notes on the same verses stay both, each with its writer.
        here.text = `${here.text.trim()}\n\n— ${note.by}: ${note.text.trim()}`
      }
    }
    set(k, JSON.stringify(mine.sort((a, b) => a.verses[0] - b.verses[0])))
  }
  // Recordings, take by take: only those that came with their sound; what is said of each in its place, the sound apart.
  for (const r of book.recordings ?? []) {
    const sounds = new Map(r.takes.filter((x) => x.sound).map((x) => [x.id, x.sound!]))
    const takes = r.takes.filter((x) => sounds.has(x.id)).map(({ sound: _, ...take }) => take)
    for (const take of gatherTakes(code, r.chapter, r.verse, { takes, chosen: r.chosen, knew: r.knew, waiting: r.waiting })) {
      void keepSound(take.id, blobOf(sounds.get(take.id)!, take.mime)).catch(() => {})
      result.recordingsTaken++
    }
  }
  return result
}

/** Where a received file goes: into a project of this phone, or as a new one. */
export type Destination = { kind: 'join'; projectId: string } | { kind: 'new' }

/**
 * Receives the books chosen into the destination, with the glossary: the project list as it is after (with the new
 * project, or the new books added to the one joined), and what was done with each book.
 */
export function receiveShared(
  file: SharedFile,
  codes: string[],
  destination: Destination,
  projects: Project[],
  /** Who gathers it here: the merge's choices already made are applied in their name. */
  person: string
): { projects: Project[]; projectId: string; books: BookReceived[]; glossary: { added: number; same: number; joined: number } } {
  const target =
    destination.kind === 'join'
      ? projects.find((p) => p.id === destination.projectId)!
      : { ...file.project, id: freeId(file.project.id, projects), books: [] as BookEntry[] }
  const books = file.books.filter((b) => codes.includes(b.code))
  const received = inProject(target.id, () => books.map((b) => receiveBook(b, !target.books.some((x) => x.code === b.code), { from: file.from, at: file.at, person })))
  const added = books
    .filter((b) => !target.books.some((x) => x.code === b.code))
    .map((b) => ({ code: b.code, phase: b.phase, ...(b.name ? { name: b.name } : {}), ...(b.together ? { together: true } : {}) }))
  // A name the book did not have here comes in; one it had stays. How the team works on it here stays as it is here.
  const named = target.books.map((x) => {
    if (x.name) return x
    const name = books.find((b) => b.code === x.code)?.name
    return name ? { ...x, name } : x
  })
  // Only the team, on either phone, stays only the team: receiving never opens up what someone closed.
  const privacy = closer(privacyOf(target), privacyOf(file.project))
  const updated: Project = { ...target, books: [...named, ...added], ...(privacy === 'equipo' ? { privacy } : {}) }
  const { gathered, changed } = gatherGlossary(readGlossary(updated.id), file.glossary ?? [])
  for (const entry of changed) saveGlossaryEntry(updated.id, entry)
  const next = destination.kind === 'join' ? projects.map((p) => (p.id === updated.id ? updated : p)) : [...projects, updated]
  return { projects: next, projectId: updated.id, books: received, glossary: gathered }
}

const freeId = (id: string, projects: Project[]) => {
  let out = id
  while (projects.some((p) => p.id === out)) out += '-2'
  return out
}

/** The file's name: the project, who shares it, and the day. */
export function shareFileName(file: SharedFile, bookNames: string[]): string {
  const what = bookNames.length === 1 ? `${file.project.name} — ${bookNames[0]}` : file.project.name
  return `${what} — ${file.from} — ${file.at.slice(0, 10)}.servos`.replace(/[\\/:*?"<>|]/g, '')
}

/**
 * The name of work shared from a project kept to its team (`Privacy`): it says nothing of the project, the book or who
 * shares it, only the day it was made (here, not in UTC), so whoever finds it in Downloads or on a card learns nothing.
 * Who sent it is seen in «Receive», once the team's password opens it.
 */
export function sealedFileName(at: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `copia-${two(at.getDate())}-${two(at.getMonth() + 1)}.servos`
}
