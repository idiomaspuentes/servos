/**
 * Timings of format 3 on the device, as the library's desktop bench (`language-pack-client/bench/timings.ts`) takes
 * them, with one difference that matters on a phone: every run opens a fresh reader over the real store, so what the
 * store (IndexedDB) costs to read is counted. The bench reads from memory and does not count it.
 *
 * Targets (the proposal, for a 2 GB Android phone): a whole book readable in under 3 s, a verse with its helps under
 * 50 ms.
 */
import type { LanguagePackClient } from '@bt-synergy/language-pack-client'
import { readBookV3 } from './bookV3'
import { packsV3 } from './client'

export type Stat = { median: number; min: number; max: number }

export type Timings = {
  /** `client.open(lang)`: the catalogs read from the store and checked. */
  open: Stat
  /** The library's row: from the open reader to `book(code)` readable (its segments read from the store). */
  book: Stat
  /** The book as the screens read it (`readBookV3`: every chapter into screen data), counted from a fresh open. */
  screen: Stat
  /** `passage(ref)` with its notes, the book already read (as when a verse is tapped in an open book). */
  passage: Stat
  /** `context(ref)`, the book already read. */
  context: Stat
}

export const TARGETS = { readableMs: 3000, verseMs: 50 } as const

export const statOf = (times: number[]): Stat => {
  const sorted = [...times].sort((a, b) => a - b)
  return { median: sorted[Math.floor(sorted.length / 2)]!, min: sorted[0]!, max: sorted[sorted.length - 1]! }
}

/** Lets the page draw between runs, so a screen showing progress is not frozen. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function timed<T>(times: number[], run: () => Promise<T>): Promise<T> {
  const t = performance.now()
  const out = await run()
  times.push(performance.now() - t)
  return out
}

export type MeasureOptions = {
  /** Tests give their own; the app's client by default. */
  client?: LanguagePackClient
  /** Told after each run (done, of how many). */
  onRun?: (done: number, total: number) => void
}

/**
 * The median, minimum and maximum, in ms, of `runs` runs of each step over `book` of `lang` (code in lowercase, as
 * `'psa'`), each on a reader opened anew, with `ref` (as `'psa 23:1'`) for the verse steps. Throws what the library or
 * `readBookV3` throws (a book that is not installed, an original missing): the caller says it.
 */
export async function measure(lang: string, book: string, ref: string, runs = 20, o: MeasureOptions = {}): Promise<Timings> {
  const client = o.client ?? (await packsV3())
  const open: number[] = []
  const bookT: number[] = []
  const screen: number[] = []
  const passage: number[] = []
  const context: number[] = []
  for (let i = 0; i < runs; i++) {
    // Never `readerV3`: it keeps its reader, and a kept reader has already read what it is asked.
    const a = await timed(open, () => client.open(lang))
    await timed(bookT, () => a.book(book))

    const b = await client.open(lang)
    await b.book(book)
    await timed(passage, () => b.passage(ref))

    const c = await client.open(lang)
    await c.book(book)
    await timed(context, () => c.context(ref))

    // The person's wait for the book: a reader opened and the book read into screen data.
    const t = performance.now()
    const d = await client.open(lang)
    const read = await readBookV3(d, lang, book)
    screen.push(performance.now() - t)
    if (!read) throw new Error(`${lang}/${book} is not installed`)
    o.onRun?.(i + 1, runs)
    await breathe()
  }
  return { open: statOf(open), book: statOf(bookT), screen: statOf(screen), passage: statOf(passage), context: statOf(context) }
}

/** Whether the book and its original are in format 3 on this device (what `measure` needs). */
export async function onDeviceV3(lang: string, book: string, client?: LanguagePackClient): Promise<boolean> {
  const c = client ?? (await packsV3())
  if (!(await c.status(lang)).active) return false
  const reader = await c.open(lang)
  return reader.installed(`book:${book}`) && reader.installed(`orig:${book}`)
}
