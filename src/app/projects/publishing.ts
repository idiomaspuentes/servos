/**
 * What publishing a project does, apart from the screen that asks for it: Publicar does it at once, and what waited for
 * internet (`outbox.ts`) does it later, when the person says yes. The books are read as they are when it goes.
 */

import { chapterOf, chaptersOf, type PrototypeData } from '../../prototype/data'
import { readAlignment } from './alignment'
import { booksThere, fileOf, fingerprint, keepUploaded, manifestOf, markVersion, attachToRelease, publish, type Destination, type Door43Account, type FileResult } from './door43'
import { titleOf, type Project } from './model'
import { audioFileOf, chosenTake, recordedPlaces, soundOf } from './recordings'
import { inProject } from './scope'
import { bookUsfm } from './usfmExport'
import { textOf } from './work'
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
 * Uploads the project's texts and its manifest, and keeps on this phone what was uploaded of each book. The
 * recordings go apart, with each numbered version: git would keep every take ever recorded.
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
  const results = await publish(account, to, files, message(withWorkOf(books).map((b) => b.title).join(', ')))
  const now = new Date().toISOString()
  for (const b of withWorkOf(books)) {
    const mine = results.filter((x) => x.path === fileOf(b.code))
    if (mine.length && mine.every((r) => r.state !== 'failed')) keepUploaded(project.id, b.code, { at: now, by: person, key: b.key })
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
