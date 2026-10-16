/**
 * Sharing work between computers without internet (design, section 7, «the work package»): «Share» puts books of a
 * project in one file, `.servos`, and «Receive» gathers such a file in, saying first what it brings and what it would
 * change, book by book. Everything goes, without asking layer by layer: the text (with joined verses), and what hangs
 * on each verse with the text it was made on (the alignment with each source, the checks with notes and with words,
 * the study notes, the versions waiting for a choice), the recordings with their sound; and the project's glossary,
 * settings and mini apps.
 *
 * Gathering never overwrites without a choice: each layer follows its text (design, 6.2 and 6.8). A verse only one
 * side wrote comes in; one both wrote differently waits as the other version, for the editor; an alignment or a check
 * comes in only if it was made on the text that stays, and otherwise is left to be checked again; the glossary is
 * gathered word by word; two study notes on the same verses stay both, each with its writer; recordings are gathered
 * take by take, none lost, the one that counts here staying so.
 *
 * In the prototype the file is JSON and there is no journal yet (design, 6.3): a verse already here with the same text
 * is recognised by its text. Wired, the journal says what was already gathered from whom.
 */

import type { AlignmentGroup } from '@usfm-tools/types'
import { gatherGlossary, readGlossary, saveGlossaryEntry, type GlossaryEntry } from './glossary'
import type { BookEntry, Phase, Project } from './model'
import type { NoteCheck } from './noteChecks'
import { blobOf, gatherTakes, keepSound, recordedPlaces, soundBase64, takesOf, type Take } from './recordings'
import { joinStartOf, joinedVerses, keepStructureConflict, textOf, type StudyNote } from './work'

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
  verses: SharedVerse[]
  others: Array<{ chapter: number; verse: number; text: string; by: string }>
  alignments: SharedAlignment[]
  /** By store (`revisionNota`, `revisionPalabra`), then by what was checked. */
  checks: Record<string, Record<string, NoteCheck>>
  studyNotes: Array<{ chapter: number; notes: StudyNote[] }>
  /** The recordings of each place, every take with its sound (base64; `withSounds` adds it). */
  recordings?: Array<{ chapter: number; verse: number; chosen: string | null; takes: Array<Take & { sound?: string }> }>
}

export interface SharedFile {
  format: typeof SHARE_FORMAT
  version: 1
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
/** `servos.prototipo.borrador.jon.1.2` → [1, 2]. */
const place = (k: string) => k.split('.').slice(-2).map(Number) as [number, number]

/** A book of this phone, as it is shared. */
export function shareBook(code: string, phase: Phase): SharedBook {
  const verses: SharedVerse[] = []
  for (const k of keys(`${P}.borrador.${code}.`)) {
    const [chapter, verse] = place(k)
    const text = get(k) ?? ''
    const joined = Number(get(`${P}.union.${code}.${chapter}.${verse}`))
    if (!text.trim() && !joined) continue
    verses.push({ chapter, verse, text, by: get(`${P}.autor.${code}.${chapter}.${verse}`), ...(joined > verse ? { joinedTo: joined } : {}) })
  }
  verses.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
  const others = keys(`${P}.otra.${code}.`).flatMap((k) => {
    const [chapter, verse] = place(k)
    const o = json<{ text: string; by: string }>(k)
    return o ? [{ chapter, verse, ...o }] : []
  })
  const alignments = keys(`${P}.alineacion.${code}.`).flatMap((k) => {
    const [source, chapter, verse] = k.slice(`${P}.alineacion.${code}.`.length).split('.')
    const kept = json<{ groups: AlignmentGroup[]; text: string; by?: string; at?: string }>(k)
    return kept ? [{ chapter: Number(chapter), verse: Number(verse), source, ...kept }] : []
  })
  const checks: SharedBook['checks'] = {}
  for (const store of ['revisionNota', 'revisionPalabra']) {
    for (const k of keys(`${P}.${store}.${code}.`)) {
      const check = json<NoteCheck>(k)
      if (check) (checks[store] ??= {})[k.slice(`${P}.${store}.${code}.`.length)] = check
    }
  }
  const studyNotes = keys(`${P}.comprension.${code}.`).flatMap((k) => {
    const notes = json<StudyNote[]>(k)
    return notes?.length ? [{ chapter: Number(k.split('.').pop()), notes }] : []
  })
  return { code, phase, verses, others, alignments, checks, studyNotes, recordings: recordedPlaces(code) }
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
  return {
    format: SHARE_FORMAT,
    version: 1,
    from,
    at: now.toISOString(),
    project: rest,
    books: books.filter((b) => codes.includes(b.code)).map((b) => ({ ...shareBook(b.code, b.phase), ...(b.name ? { name: b.name } : {}) })),
    glossary: readGlossary(project.id),
  }
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

const draftHere = (code: string, chapter: number, verse: number) => get(`${P}.borrador.${code}.${chapter}.${verse}`) ?? ''
/**
 * How a verse received (alone, or a join up to `to`) fits this phone's verses: the same way (the same verse, or the
 * same join), or another; and, when another, the stretch both ways cover and whether this phone has text in it.
 */
function shapeOf(code: string, chapter: number, verse: number, to: number) {
  const received = Array.from({ length: to - verse + 1 }, (_, i) => verse + i)
  const starts = [...new Set(received.map((x) => joinStartOf(code, chapter, x)))]
  const cover = [...new Set([...received, ...starts.flatMap((s) => joinedVerses(code, chapter, s))])].sort((a, b) => a - b)
  const same = starts.length === 1 && starts[0] === verse && cover.length === received.length
  const written = starts.some((s) => draftHere(code, chapter, s).trim() !== '')
  return { same, written, from: cover[0], to: cover[cover.length - 1] }
}

/** The text of another version already waiting for a choice at a verse, if one is. */
const waitingOf = (code: string, chapter: number, verse: number): string | null =>
  json<{ text: string }>(`${P}.otra.${code}.${chapter}.${verse}`)?.text.trim() ?? null

export function previewBook(book: SharedBook, isNew: boolean): BookPreview {
  const p: BookPreview = { code: book.code, isNew, taken: 0, same: 0, choices: 0, waiting: 0, alignments: book.alignments.length, checks: 0, studyNotes: 0, recordings: 0 }
  for (const v of book.verses) {
    if (!v.text.trim()) continue
    const shape = shapeOf(book.code, v.chapter, v.verse, v.joinedTo ?? v.verse)
    // Joined on one side and not on the other: taken as it comes where nothing is written here, else a choice.
    if (!shape.same) {
      if (shape.written) p.choices++
      else p.taken++
      continue
    }
    const here = draftHere(book.code, v.chapter, v.verse)
    const pending = waitingOf(book.code, v.chapter, v.verse)
    if (!here.trim()) p.taken++
    else if (here.trim() === v.text.trim() || pending === v.text.trim()) p.same++
    else if (pending !== null) p.waiting++
    else p.choices++
  }
  p.checks = Object.values(book.checks).reduce((n, byId) => n + Object.keys(byId).length, 0)
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
  checksTaken: number
  /** Recordings taken in. */
  recordingsTaken: number
}

/** Gathers a received book in: nothing written here is overwritten without a choice; each layer follows its text. */
export function receiveBook(book: SharedBook, isNew: boolean): BookReceived {
  const result: BookReceived = { ...previewBook(book, isNew), alignmentsTaken: 0, checksTaken: 0, recordingsTaken: 0 }
  const { code } = book
  for (const v of book.verses) {
    const to = v.joinedTo ?? v.verse
    const shape = shapeOf(code, v.chapter, v.verse, to)
    if (!shape.same) {
      // Joined on one side and not on the other. With nothing written here in the stretch, the way received comes in
      // (its join, its text); with text on both sides it waits for a person to choose the way, never verse by verse:
      // a text said for 1–2 is not a version of verse 1.
      if (!v.text.trim()) continue
      if (!shape.written) {
        for (let x = shape.from; x <= shape.to; x++) set(`${P}.union.${code}.${v.chapter}.${x}`, null)
        set(`${P}.borrador.${code}.${v.chapter}.${v.verse}`, v.text)
        set(`${P}.autor.${code}.${v.chapter}.${v.verse}`, v.by)
        if (to > v.verse) set(`${P}.union.${code}.${v.chapter}.${v.verse}`, String(to))
      } else {
        keepStructureConflict(code, { chapter: v.chapter, from: shape.from, to: shape.to, received: [{ from: v.verse, to, text: v.text, by: v.by ?? '' }] })
      }
      continue
    }
    const here = draftHere(code, v.chapter, v.verse)
    if (v.text.trim() && !here.trim()) {
      set(`${P}.borrador.${code}.${v.chapter}.${v.verse}`, v.text)
      set(`${P}.autor.${code}.${v.chapter}.${v.verse}`, v.by)
    } else if (v.text.trim() && here.trim() !== v.text.trim() && waitingOf(code, v.chapter, v.verse) === null) {
      // Only where no other version waits: one waiting for a choice is not replaced without it.
      set(`${P}.otra.${code}.${v.chapter}.${v.verse}`, JSON.stringify({ text: v.text, by: v.by ?? '' }))
    }
  }
  for (const o of book.others) {
    const k = `${P}.otra.${code}.${o.chapter}.${o.verse}`
    if (!get(k) && draftHere(code, o.chapter, o.verse).trim() !== o.text.trim()) set(k, JSON.stringify({ text: o.text, by: o.by }))
  }
  for (const a of book.alignments) {
    const k = `${P}.alineacion.${code}.${a.source}.${a.chapter}.${a.verse}`
    // The text that says the verse now, after the verses were gathered (joined ones by their first).
    const now = textOf(code, a.chapter, a.verse).replace(/\n/g, ' ').trim()
    if (a.text.trim() !== now) continue
    const mine = json<{ text: string; at?: string }>(k)
    if (mine && mine.text.trim() === now && (mine.at ?? '') >= (a.at ?? '')) continue
    set(k, JSON.stringify({ groups: a.groups, text: a.text, by: a.by, at: a.at }))
    result.alignmentsTaken++
  }
  for (const [store, byId] of Object.entries(book.checks)) {
    for (const [id, check] of Object.entries(byId)) {
      const k = `${P}.${store}.${code}.${id}`
      const mine = json<NoteCheck>(k)
      if (!mine || (mine.at ?? '') < (check.at ?? '')) {
        set(k, JSON.stringify(check))
        result.checksTaken++
      }
    }
  }
  for (const { chapter, notes } of book.studyNotes) {
    const k = `${P}.comprension.${code}.${chapter}`
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
    for (const take of gatherTakes(code, r.chapter, r.verse, { takes, chosen: r.chosen })) {
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
  projects: Project[]
): { projects: Project[]; projectId: string; books: BookReceived[]; glossary: { added: number; same: number; joined: number } } {
  const target =
    destination.kind === 'join'
      ? projects.find((p) => p.id === destination.projectId)!
      : { ...file.project, id: freeId(file.project.id, projects), books: [] as BookEntry[] }
  const books = file.books.filter((b) => codes.includes(b.code))
  const received = books.map((b) => receiveBook(b, !target.books.some((x) => x.code === b.code)))
  const added = books
    .filter((b) => !target.books.some((x) => x.code === b.code))
    .map((b) => ({ code: b.code, phase: b.phase, ...(b.name ? { name: b.name } : {}) }))
  // A name the book did not have here comes in; one it had stays.
  const named = target.books.map((x) => (x.name ? x : { ...x, name: books.find((b) => b.code === x.code)?.name }))
  const updated: Project = { ...target, books: [...named.map((x) => (x.name ? x : { code: x.code, phase: x.phase })), ...added] }
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
