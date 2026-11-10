/**
 * Timings of format 3 on the device, as the library's desktop bench (`language-pack-client/bench/timings.ts`) takes
 * them, with differences that matter on a phone: every run opens fresh readers over the real store, so what the store
 * (IndexedDB) costs to read is counted (the bench reads from memory); the first run is reported apart (cold); and a run
 * during which the app went to the background is marked, since the browser slows a background page then (its timers
 * above all; the book's turns between chapters are `giveTurn`'s, as in the app, and only the pauses between runs are
 * timers).
 *
 * A verse tapped inside an open book is read from the chapters already in memory (`PrototypeData`), not asked of the
 * reader. `passage` and `context` run for a verse of another place (`VerseSheet`, the lookups across books), on the
 * reader the app keeps (`readerV3`). Its first query reads the maps too (`maps()`, which `passage` needs for its
 * coverage), once per reader: that is `firstVerse`, the first lookup after opening Servos or installing. The next ones
 * (`passage`, `context`) are timed on a reader that already answered the same query once, as the bench does. All three
 * are judged against the verse target.
 *
 * No module-level cache sits between runs: `readBookV3`, `articlesV3`, `lexiconV3` and `helpsV3` keep none, and each
 * reader (the library's own caches) is made anew by `client.open`. Never `readerV3`, which keeps its reader.
 *
 * Targets (the proposal, for a 2 GB Android phone): a whole book readable in under 3 s, a verse with its helps under
 * 50 ms.
 */
import type { LanguagePackClient } from '@bt-synergy/language-pack-client'
import { giveTurn, readBookV3 } from './bookV3'
import { packsV3 } from './client'

export type Stat = { median: number; min: number; max: number }

export const ROWS = ['open', 'book', 'firstChapter', 'screen', 'firstVerse', 'passage', 'context'] as const
export type RowName = (typeof ROWS)[number]

export type Timings = {
  open: Stat
  /** The library's row: from the open reader to `book(code)` readable (its segments read from the store). */
  book: Stat
  /**
   * From the same fresh open to the first chapter read into screen data: what a person would wait for if the screens
   * showed a book's chapters as they are read (today they wait for `screen`).
   */
  firstChapter: Stat
  /** The book as the screens read it (`readBookV3`: every chapter into screen data), counted from a fresh open. */
  screen: Stat
  /** The first `passage(ref)` of a reader that has read the book: it reads the maps too (once a reader). */
  firstVerse: Stat
  /** `passage(ref)` with its notes, on a reader that read the book and answered it once (a later lookup of a verse). */
  passage: Stat
  /** `context(ref)`, on a reader that read the book and answered it once. */
  context: Stat
  /** Run 1 of each row, ms: the cold one (nothing of this was read in this run of the app before). */
  first: Record<RowName, number>
  /** How much of `screen` was waiting for the screen between chapters (the yield, which a timer slows in the background). */
  yielded: Stat
  runs: number
  /** How many runs had the app in the background at some moment: more than 0, the table is not valid. */
  hidden: number
}

export const TARGETS = { readableMs: 3000, verseMs: 50 } as const

export const statOf = (times: number[]): Stat => {
  const sorted = [...times].sort((a, b) => a - b)
  return { median: sorted[Math.floor(sorted.length / 2)]!, min: sorted[0]!, max: sorted[sorted.length - 1]! }
}

/** Lets the page draw between runs, so a screen showing progress is not frozen. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export type MeasureOptions = {
  /** Tests give their own; the app's client by default. */
  client?: LanguagePackClient
  /** Told after each run (done, of how many). */
  onRun?: (done: number, total: number) => void
  /** Stops the measure (the sheet closed): it rejects with the signal's reason. */
  signal?: AbortSignal
}

/**
 * The median, minimum and maximum, in ms, of `runs` runs of each step over `book` of `lang` (code in lowercase, as
 * `'psa'`), each on readers opened anew, with `ref` (as `'psa 23:1'`) for the verse steps. In every run `screen` goes
 * first, on a fresh open, before the others read the book. Throws what the library or `readBookV3` throws (a book that
 * is not installed, an original missing): the caller says it.
 */
export async function measure(lang: string, book: string, ref: string, runs = 20, o: MeasureOptions = {}): Promise<Timings> {
  const client = o.client ?? (await packsV3())
  const times = { open: [] as number[], book: [] as number[], firstChapter: [] as number[], screen: [] as number[], firstVerse: [] as number[], passage: [] as number[], context: [] as number[], yielded: [] as number[] }
  let hiddenRuns = 0
  let wasHidden = false
  const seen = () => {
    if (typeof document !== 'undefined' && document.hidden) wasHidden = true
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', seen)
  const stop = () => o.signal?.throwIfAborted()
  try {
    for (let i = 0; i < runs; i++) {
      stop()
      wasHidden = false
      seen()
      // The person's wait for the book, first so that it is the cold one: a reader opened and the book read into screen
      // data. The wait between chapters is counted apart.
      let waited = 0
      const t = performance.now()
      const d = await client.open(lang)
      const read = await readBookV3(d, lang, book, {
        onChapter: (done) => {
          if (done === 1) times.firstChapter.push(performance.now() - t)
        },
        yield: async () => {
          const w = performance.now()
          await giveTurn()
          waited += performance.now() - w
        },
      })
      times.screen.push(performance.now() - t)
      times.yielded.push(waited)
      if (!read) throw new Error(`${lang}/${book} is not installed`)
      stop()

      // Never `readerV3`: it keeps its reader, and a kept reader has already read what it is asked.
      const t1 = performance.now()
      const a = await client.open(lang)
      times.open.push(performance.now() - t1)
      const t2 = performance.now()
      await a.book(book)
      times.book.push(performance.now() - t2)

      const b = await client.open(lang)
      await b.book(book)
      const t3 = performance.now()
      await b.passage(ref)
      times.firstVerse.push(performance.now() - t3)
      const t4 = performance.now()
      await b.passage(ref)
      times.passage.push(performance.now() - t4)

      const c = await client.open(lang)
      await c.context(ref)
      const t5 = performance.now()
      await c.context(ref)
      times.context.push(performance.now() - t5)

      if (wasHidden) hiddenRuns++
      o.onRun?.(i + 1, runs)
      await breathe()
    }
  } finally {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', seen)
  }
  return {
    open: statOf(times.open),
    book: statOf(times.book),
    firstChapter: statOf(times.firstChapter),
    screen: statOf(times.screen),
    firstVerse: statOf(times.firstVerse),
    passage: statOf(times.passage),
    context: statOf(times.context),
    first: { open: times.open[0]!, book: times.book[0]!, firstChapter: times.firstChapter[0]!, screen: times.screen[0]!, firstVerse: times.firstVerse[0]!, passage: times.passage[0]!, context: times.context[0]! },
    yielded: statOf(times.yielded),
    runs,
    hidden: hiddenRuns,
  }
}

/** Whether the book and its original are in format 3 on this device (what `measure` needs). */
export async function onDeviceV3(lang: string, book: string, client?: LanguagePackClient): Promise<boolean> {
  const c = client ?? (await packsV3())
  if (!(await c.status(lang)).active) return false
  const reader = await c.open(lang)
  return reader.installed(`book:${book}`) && reader.installed(`orig:${book}`)
}
