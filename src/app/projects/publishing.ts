/**
 * What publishing a project does, apart from the screen that asks for it: Publicar does it at once, and what waited for
 * internet (`outbox.ts`) does it later, when the person says yes. The books are read as they are when it goes.
 */

import { chapterOf, chaptersOf, type PrototypeData } from '../../prototype/data'
import { readAlignment } from './alignment'
import { changesBetween, placesOf, type BookState } from '../../core'
import { applyVerseEdits } from '../../usfm/usfmEdit'
import {
  booksThere,
  fileOf,
  fileThere,
  fingerprint,
  keepSeen,
  keepUploaded,
  manifestOf,
  markVersion,
  attachToRelease,
  publish,
  seenOf,
  type Destination,
  type Door43Account,
  type FileResult,
  type Seen,
} from './door43'
import { titleOf, type Project } from './model'
import { SHARE_FORMAT, type SharedFile } from './share'
import { audioFileOf, chosenTake, recordedPlaces, soundOf } from './recordings'
import { inProject } from './scope'
import { bookUsfm } from './usfmExport'
import { bookStateOf, textOf } from './work'
import { zipStore } from './zip'

export type BookToPublish = {
  code: string
  title: string
  usfm: string
  written: number
  total: number
  aligned: number
  /** The take that counts for each recorded place, and where it goes. */
  takes: Array<{ id: string; path: string }>
  /** What is uploaded of the book, as a fingerprint: its text and which takes count. */
  key: string
}

/** Each book of the project whose texts are on this phone, as it would be uploaded now. */
export function booksOf(project: Project): BookToPublish[] {
  return inProject(project.id, () =>
    project.books.flatMap((b) => {
      const chapters = chaptersOf(b.code)
        .map((c) => chapterOf(b.code, c))
        .filter((d): d is PrototypeData => Boolean(d))
      if (!chapters.length) return []
      const title = titleOf(project, b.code)
      const original = chapters[0].texts.find((x) => x.original)?.abbreviation
      let written = 0
      let total = 0
      let aligned = 0
      for (const d of chapters)
        for (const { verse } of d.verses) {
          total++
          if (textOf(b.code, d.chapter, verse).trim()) written++
          if (original && readAlignment(b.code, d.chapter, verse, original)?.groups.length) aligned++
        }
      const usfm = bookUsfm(b.code, project.name, chapters, 'TPL', b.name, true)
      const takes = recordedPlaces(b.code).flatMap((p) => {
        const take = chosenTake(b.code, p.chapter, p.verse)
        return take ? [{ id: take.id, path: audioFileOf(b.code, p.chapter, p.verse, take) }] : []
      })
      return [{ code: b.code, title, usfm, written, total, aligned, takes, key: fingerprint(usfm + takes.map((x) => x.id).join()) }]
    })
  )
}

/** Books with something to upload: a text, or recordings (a book only said aloud goes with the version). */
export const withWorkOf = (books: BookToPublish[]) => books.filter((b) => b.written > 0 || b.takes.length > 0)

/**
 * Uploads the project's texts and its manifest, and keeps on this phone what was uploaded of each book. A book whose
 * file on Door43 is not the one this phone last saw there is not uploaded (`changed`): someone else uploaded it, and
 * their verses would be lost under these; it is brought in and gathered first (`fromDoor43`). The recordings go apart,
 * with each numbered version: git would keep every take ever recorded.
 */
export async function uploadProject(
  account: Door43Account,
  to: Destination,
  project: Project,
  person: string,
  message: (books: string) => string
): Promise<{ results: FileResult[]; books: BookToPublish[] }> {
  const books = booksOf(project)
  const withText = books.filter((b) => b.written > 0)
  // The manifest names what this phone uploads and what others already uploaded: a book empty here is never left
  // out of it, and its file stays (nothing is deleted).
  const named = new Map(withText.map((b) => [b.code, b.title]))
  for (const b of await booksThere(account, to)) if (!named.has(b.code)) named.set(b.code, b.title || titleOf(project, b.code))
  const manifestBooks = [...named].map(([code, title]) => ({ code, title })).sort((a, b) => fileOf(a.code).localeCompare(fileOf(b.code)))
  const files = [
    ...withText.map((b) => ({ path: fileOf(b.code), content: b.usfm })),
    { path: 'manifest.yaml', content: manifestOf(project, to.owner, to.repo, manifestBooks) },
  ]
  const seen = Object.fromEntries(withText.map((b) => [fileOf(b.code), seenOf(project.id, b.code)?.sha]))
  const results = await publish(account, to, files, message(withWorkOf(books).map((b) => b.title).join(', ')), {
    seen,
    knows: (path, text) => {
      const b = withText.find((x) => fileOf(x.code) === path)
      return Boolean(b) && inProject(project.id, () => knowsAll(b!.code, text, seenOf(project.id, b!.code)?.text ?? ''))
    },
  })
  const now = new Date().toISOString()
  for (const b of withWorkOf(books)) {
    const mine = results.filter((x) => x.path === fileOf(b.code))
    if (mine.length && mine.every((r) => r.state === 'written' || r.state === 'same')) keepUploaded(project.id, b.code, { at: now, by: person, key: b.key })
    const up = mine.find((r) => (r.state === 'written' || r.state === 'same') && r.sha)
    if (up) keepSeen(project.id, b.code, { sha: up.sha!, text: b.usfm })
  }
  return { results, books }
}

/** Marks what is on Door43 as version `n`, and attaches to it the take that counts of each place, a zip by book. */
export async function markVersionWithTakes(account: Door43Account, to: Destination, books: BookToPublish[], n: number, note: string): Promise<number> {
  const release = await markVersion(account, to, n, note)
  let attached = 0
  for (const b of books.filter((x) => x.takes.length)) {
    const files = (
      await Promise.all(
        b.takes.map(async (x) => {
          const sound = await soundOf(x.id)
          return sound ? { name: x.path, bytes: new Uint8Array(await sound.arrayBuffer()) } : null
        })
      )
    ).filter((x) => x !== null)
    if (!files.length) continue
    await attachToRelease(account, to, release.id, `audio-${b.code.toUpperCase()}.zip`, zipStore(files))
    attached += files.length
  }
  return attached
}

/**
 * Whether this phone already has everything a book's file on Door43 says (the work came another way: a card, the
 * team's work): each verse there is the one here, or one this phone's diary changed from or wrote before; and a verse
 * emptied there since `base` (what this phone last saw) is empty here too. Then uploading over it loses nothing.
 */
export function knowsAll(code: string, there: string, base: string): boolean {
  const state = bookStateOf(code)
  if (!state) return false
  const here = new Map(placesOf(state.usfm).map((p) => [`${p.chapter}:${p.from}-${p.to}`, p.key]))
  const was = new Map(placesOf(base).map((p) => [`${p.chapter}:${p.from}-${p.to}`, p.key]))
  return placesOf(there).every((p) => {
    const id = `${p.chapter}:${p.from}-${p.to}`
    if (here.get(id) === p.key) return true
    if (!p.text) return !was.get(id)
    return state.journal.some((e) => `${e.place.chapter}:${e.place.from}-${e.place.to}` === id && (e.key === p.key || e.base === p.key))
  })
}

/**
 * A book's file on Door43 as a copy of the book to gather here, weighed against the last version this phone saw there
 * (`base`, its common start; empty when it never saw one): only the verses that changed on Door43 since are in it, each
 * a change of whoever uploaded it, made on the text it had in `base`. So the merge brings in what changed only there,
 * keeps what changed only here, and leaves for a person what changed on both sides. `origin` tells this version's
 * writer apart from any other, and is the same each time the same version is brought.
 */
export function door43Copy(code: string, base: string, there: string, origin: string, at = new Date().toISOString()): BookState {
  const journal = changesBetween(base, there, { name: 'Door43', device: origin }, 1, at)
  const changed = new Set(journal.map((e) => `${e.place.chapter}:${e.place.from}-${e.place.to}`))
  // What did not change there is left empty: it brings nothing, and what is here stays.
  const still = new Map<number, Array<{ from: number; to: number; text: string }>>()
  for (const p of placesOf(there)) {
    if (!p.text || changed.has(`${p.chapter}:${p.from}-${p.to}`)) continue
    still.set(p.chapter, [...(still.get(p.chapter) ?? []), { from: p.from, to: p.to, text: '' }])
  }
  let usfm = there
  for (const [chapter, edits] of still) usfm = applyVerseEdits(usfm, chapter, edits)
  return { book: code, usfm, journal, pending: [] }
}

/** A book of the project brought from Door43: its file there, and what this phone last saw of it. */
export interface Brought {
  code: string
  there: Seen
}

/**
 * The books of the project whose file on Door43 is not the one this phone last saw there (someone else uploaded them),
 * read from Door43 as they are now.
 */
export async function changedOnDoor43(account: Door43Account, to: Destination, project: Project): Promise<Brought[]> {
  const out: Brought[] = []
  for (const b of project.books) {
    const there = await fileThere(account, to, fileOf(b.code))
    if (there && there.sha !== seenOf(project.id, b.code)?.sha) out.push({ code: b.code, there })
  }
  return out
}

/**
 * What was brought from Door43, as a file to receive (design 7, «Receive»): each book a copy weighed against what this
 * phone last saw there, with that version, to be kept as seen once it is gathered.
 */
export function fromDoor43(project: Project, brought: Brought[], at = new Date()): SharedFile {
  const { books, ...rest } = project
  return {
    format: SHARE_FORMAT,
    version: 2,
    from: 'Door43',
    at: at.toISOString(),
    project: rest,
    books: brought.map(({ code, there }) => ({
      code,
      phase: books.find((b) => b.code === code)?.phase ?? 'traduccion',
      state: door43Copy(code, seenOf(project.id, code)?.text ?? '', there.text, `door43~${there.sha}`, at.toISOString()),
      checks: {},
      studyNotes: [],
      door43: there,
    })),
    glossary: [],
  }
}

/** What changed on Door43 for a project, as a file for «Receive»; null when nothing there is new to this phone. */
export async function bringFromDoor43(account: Door43Account, to: Destination, project: Project): Promise<SharedFile | null> {
  const brought = await changedOnDoor43(account, to, project)
  return brought.length ? fromDoor43(project, brought) : null
}
