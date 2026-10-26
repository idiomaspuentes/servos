/**
 * What waits for internet (design 6.11). Servos works without internet most of the time: what needs Door43 (uploading
 * the project, marking a version, leaving one's work for the team, bringing in theirs) is asked for then all the same,
 * and kept here, on this phone. When there is internet again the app shows the person what will go, and it goes only
 * when they say yes; each errand can be taken back. It goes as the work is then, not as it was when asked: the person
 * is told when it changed since.
 */

import { accountOf, destinationOf, leaveWork, nextVersion, problemOf, type Destination, type Problem } from './door43'
import { privacyOf, type Project } from './model'
import { booksOf, markVersionWithTakes, uploadProject, withWorkOf, type BookToPublish } from './publishing'
import { deviceId } from './work'
import { workToLeave } from './workToLeave'

const KEY = 'servos.prototipo.door43.espera'

export type ErrandKind = 'subir' | 'version' | 'dejar' | 'traer'

export interface Errand {
  id: string
  kind: ErrandKind
  projectId: string
  /** Who asked: it goes with their Door43 account, and only they are asked to send it. */
  person: string
  /** When it was asked. */
  at: string
  /** The book it was asked from: where bringing in the team's work opens. */
  book?: string
  /** What the books were when it was asked, by their fingerprints: to say whether they changed since. */
  keys?: Record<string, string>
  /** What went wrong the last time it was tried. */
  problem?: Problem
}

const read = (): Errand[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Errand[]
  } catch {
    return []
  }
}
const listeners = new Set<() => void>()
const write = (errands: Errand[]) => {
  try {
    if (errands.length) localStorage.setItem(KEY, JSON.stringify(errands))
    else localStorage.removeItem(KEY)
  } catch {
    /* kept for this visit */
  }
  listeners.forEach((fn) => fn())
}

/** Told when what waits changes (a screen that says it, the sheet that asks). */
export function onWaiting(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** What waits on this phone, in the order it was asked; one person's alone when named. */
export const waiting = (person?: string): Errand[] => read().filter((e) => person === undefined || e.person === person)

const same = (e: Pick<Errand, 'projectId' | 'person'>, o: Pick<Errand, 'projectId' | 'person'>) => e.projectId === o.projectId && e.person === o.person

/**
 * Keeps an errand for when there is internet. Asked twice, it is kept once, as last asked. Marking a version uploads
 * first, so it takes the place of an upload waiting; an upload asked while a version waits is in it already.
 */
export function ask(errand: Pick<Errand, 'kind' | 'projectId' | 'person' | 'book' | 'keys'>, now = new Date()): Errand {
  const all = read()
  if (errand.kind === 'subir') {
    const version = all.find((e) => e.kind === 'version' && same(e, errand))
    if (version) return version
  }
  const kept: Errand = { ...errand, id: `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: now.toISOString() }
  const replaced = (e: Errand) => same(e, errand) && (e.kind === errand.kind || (errand.kind === 'version' && e.kind === 'subir'))
  write([...all.filter((e) => !replaced(e)), kept])
  return kept
}

/** Takes an errand back: it does not go. */
export const drop = (id: string) => write(read().filter((e) => e.id !== id))

/** Done with internet from its screen: what waited to do the same goes away (a version done does an upload's work too). */
export function settle(kind: ErrandKind, projectId: string, person: string) {
  const covered = (e: Errand) => same(e, { projectId, person }) && (e.kind === kind || (kind === 'version' && e.kind === 'subir'))
  write(read().filter((e) => !covered(e)))
}

const keepProblem = (id: string, problem: Problem) => write(read().map((e) => (e.id === id ? { ...e, problem } : e)))

/** The fingerprints of a project's books now, for an errand that uploads them. */
export const keysOf = (books: BookToPublish[]): Record<string, string> => Object.fromEntries(withWorkOf(books).map((b) => [b.code, b.key]))

/** What an errand would send now: the books as they are, where they go, and whether they changed since it was asked. */
export interface ErrandNow {
  books: BookToPublish[]
  to: Destination | null
  changed: boolean
}
export function errandNow(e: Errand, project: Project): ErrandNow {
  const books = withWorkOf(booksOf(project))
  const changed = e.keys !== undefined && books.some((b) => e.keys![b.code] !== b.key)
  return { books, to: destinationOf(project.id), changed }
}

/** The number the next version would take, once there is internet to ask Door43 (null if it cannot be asked). */
export async function versionToMark(e: Errand): Promise<number | null> {
  const account = accountOf(e.person)
  const to = destinationOf(e.projectId)
  if (!account || !to) return null
  return nextVersion(account, to).catch(() => null)
}

/** What was done for an errand. Bringing in sends nothing: its screen brings, for the person to see what came. */
export type Sent = { kind: 'subir'; written: number; same: number } | { kind: 'version'; n: number; takes: number } | { kind: 'dejar' } | { kind: 'traer' }

/** Does an errand now. A problem, said in the person's terms, when it could not. */
export async function runErrand(
  e: Errand,
  project: Project,
  texts: { message(books: string): string; note: string }
): Promise<{ sent: Sent } | { problem: Problem }> {
  if (e.kind === 'traer') return { sent: { kind: 'traer' } }
  const account = accountOf(e.person)
  if (!account) return { problem: 'signin' }
  const to = destinationOf(e.projectId)
  if (!to) return { problem: 'other' }
  try {
    if (e.kind === 'dejar') {
      // Sealed with the team's password for a project kept to its team; while it is not known here, it waits.
      const work = await workToLeave(project, e.person)
      if (!work) return { problem: 'teamPassword' }
      const result = await leaveWork(account, to, work.text, e.person, deviceId(), privacyOf(project))
      return result.state === 'failed' ? { problem: result.problem ?? 'other' } : { sent: { kind: 'dejar' } }
    }
    const { results, books } = await uploadProject(account, to, project, e.person, texts.message)
    const failed = results.find((r) => r.state === 'failed')
    if (failed) return { problem: failed.problem ?? 'other' }
    // Someone else uploaded a book meanwhile: it waits, to be brought in and gathered before it goes (no version either).
    if (results.some((r) => r.state === 'changed')) return { problem: 'changed' }
    // Versions brought from Door43 still wait to be gathered here: the book goes once they are.
    if (results.some((r) => r.state === 'gather')) return { problem: 'gather' }
    if (e.kind === 'subir') {
      const usfm = results.filter((r) => r.path.endsWith('.usfm'))
      return { sent: { kind: 'subir', written: usfm.filter((r) => r.state === 'written').length, same: usfm.filter((r) => r.state === 'same').length } }
    }
    const n = await nextVersion(account, to)
    const takes = await markVersionWithTakes(account, to, withWorkOf(books), n, texts.note)
    return { sent: { kind: 'version', n, takes } }
  } catch (err) {
    return { problem: problemOf(err) }
  }
}

/**
 * Sends what waits, in the order it was asked. What went is forgotten; what could not waits still, with its problem.
 * Without internet after all, the rest is not tried: it would fail the same way.
 */
export async function sendWaiting(
  errands: Errand[],
  run: (e: Errand) => Promise<{ sent: Sent } | { problem: Problem }>
): Promise<Map<string, { sent: Sent } | { problem: Problem }>> {
  const done = new Map<string, { sent: Sent } | { problem: Problem }>()
  for (const e of errands) {
    const result = await run(e)
    done.set(e.id, result)
    if ('sent' in result) drop(e.id)
    else {
      keepProblem(e.id, result.problem)
      if (result.problem === 'offline') break
    }
  }
  return done
}
