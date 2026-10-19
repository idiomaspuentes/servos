/**
 * What a newer pack changed in the verses a project already translated (design, section 7, «Saber que hay recursos
 * nuevos»): before a pack replaces a resource, the notes and bridge texts of each written verse are read
 * (`VerseHelps`); after, read again and compared (`compareHelps`). What changed is kept by project and book, so the
 * editor marks those verses «Ayudas cambiadas», and a note check made before its note changed is to be made again.
 *
 * The notes are told apart by their id, which a notes resource keeps from one release to the next.
 */

import type { VerseHelps } from '../../resources/reading'
import { scoped } from './scope'

/** A note of a verse that came, changed or went. `before` is what it said, for a changed or removed note. */
export interface NoteChange {
  id: string
  kind: 'nueva' | 'cambiada' | 'quitada'
  /** The words of the original it is about. */
  quote: string
  before?: string
}

/** A bridge text of a verse that says something else now, and what it said. */
export interface TextChange {
  text: 'literal' | 'simple'
  before: string
}

/** What changed in a verse, and when the pack that changed it was opened. */
export interface VerseChange {
  chapter: number
  verse: number
  at: string
  notes: NoteChange[]
  texts: TextChange[]
  /** The translator said it was seen: the verse is no longer marked, and its changed notes still reopen checks. */
  seen?: boolean
}

const spaced = (text: string) => text.replace(/\s+/g, ' ').trim()

/** What changed between the helps of the same verses read before and after a pack was opened. */
export function compareHelps(before: readonly VerseHelps[], after: readonly VerseHelps[], at: string): VerseChange[] {
  const out: VerseChange[] = []
  for (const was of before) {
    const now = after.find((v) => v.chapter === was.chapter && v.verse === was.verse)
    // A verse the new release does not have: nothing is said of it, there is nothing to look at.
    if (!now) continue
    const notes: NoteChange[] = []
    for (const n of now.notes) {
      const old = was.notes.find((o) => o.id === n.id)
      if (!old) notes.push({ id: n.id, kind: 'nueva', quote: n.quote })
      else if (spaced(old.note) !== spaced(n.note) || spaced(old.quote) !== spaced(n.quote)) notes.push({ id: n.id, kind: 'cambiada', quote: n.quote, before: old.note })
    }
    for (const o of was.notes) if (!now.notes.some((n) => n.id === o.id)) notes.push({ id: o.id, kind: 'quitada', quote: o.quote, before: o.note })
    const texts: TextChange[] = (['literal', 'simple'] as const).filter((x) => spaced(was[x]) !== spaced(now[x])).map((x) => ({ text: x, before: was[x] }))
    if (notes.length || texts.length) out.push({ chapter: was.chapter, verse: was.verse, at, notes, texts })
  }
  return out
}

/** A note's changes one after the other, as one: what it said first, and what it is now. */
function joinNote(first: NoteChange, then: NoteChange): NoteChange | null {
  if (first.kind === 'nueva') return then.kind === 'quitada' ? null : { ...then, kind: 'nueva', before: undefined }
  if (then.kind === 'nueva') return { ...then, kind: 'cambiada', before: first.before }
  return { ...then, before: first.before }
}

/** A verse's changes not seen yet, with those of a later pack: each note and text once, with what it said first. */
function joinVerse(first: VerseChange, then: VerseChange): VerseChange {
  if (first.seen) return then
  const notes: NoteChange[] = first.notes.filter((n) => !then.notes.some((m) => m.id === n.id))
  for (const m of then.notes) {
    const n = first.notes.find((x) => x.id === m.id)
    const joined = n ? joinNote(n, m) : m
    if (joined) notes.push(joined)
  }
  const texts = [...first.texts, ...then.texts.filter((x) => !first.texts.some((y) => y.text === x.text))]
  return { ...then, notes, texts }
}

const KEY = 'servos.recursos.cambios'

/** Every project's changes, by its book as its work is kept (`jon~biblia-kichwa`, `scoped`). */
type Kept = Record<string, VerseChange[]>

function readAll(): Kept {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Kept | null) ?? {}
  } catch {
    return {}
  }
}

const listeners = new Set<() => void>()
let version = 0
/** Told when what changed is kept or seen, so every place that marks a verse draws it again (`useSyncExternalStore`). */
export const subscribeChanges = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export const changesVersion = () => version

function writeAll(kept: Kept) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept))
  } catch {
    /* without storage the changes are said once, on the screen that received the pack */
  }
  version++
  listeners.forEach((fn) => fn())
}

/** Keeps what a pack changed in a book of the project the app is in, with what earlier packs changed and was not seen. */
export function keepChanges(book: string, changes: readonly VerseChange[]) {
  if (!changes.length) return
  const all = readAll()
  const list = [...(all[scoped(book)] ?? [])]
  for (const c of changes) {
    const i = list.findIndex((x) => x.chapter === c.chapter && x.verse === c.verse)
    if (i < 0) list.push(c)
    else list[i] = joinVerse(list[i], c)
  }
  all[scoped(book)] = list.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
  writeAll(all)
}

/** The verses of a book (or of one of its chapters) whose helps changed and were not seen, in order. */
export function changedVerses(book: string, chapter?: number): VerseChange[] {
  return (readAll()[scoped(book)] ?? []).filter((c) => !c.seen && (chapter === undefined || c.chapter === chapter))
}

/** What changed in a verse not seen yet, or null. */
export const changeAt = (book: string, chapter: number, verse: number): VerseChange | null =>
  changedVerses(book, chapter).find((c) => c.verse === verse) ?? null

/** The translator saw what changed in a verse: it is no longer marked. */
export function seeChange(book: string, chapter: number, verse: number) {
  const all = readAll()
  const list = all[scoped(book)]
  const c = list?.find((x) => x.chapter === chapter && x.verse === verse)
  if (!c) return
  c.seen = true
  writeAll(all)
}

/** When a note of the book last changed (a pack opened with it changed), seen or not; null when it never did. */
export function noteChangedAt(book: string, id: string): string | null {
  let last: string | null = null
  for (const c of readAll()[scoped(book)] ?? []) {
    if (c.notes.some((n) => n.id === id && n.kind === 'cambiada') && (!last || c.at > last)) last = c.at
  }
  return last
}
