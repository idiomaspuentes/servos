/**
 * Servos online over format 3 (`@bt-synergy/language-pack-client`), used by `onlineResources.ts` when the packs server
 * is staging (`packsFormat() === 3`). Here only the client calls and what their answers mean; the state the screens
 * read (`OnlineState`), the runs, the waits and «Ahora no» stay in `onlineResources.ts`, so Home, AddBook and
 * BookScreen read format 3 as they read format 2.0.
 *
 * - A book is its unit (`book:tit`, with what it needs: its original, the maps, its article groups) and the lexicon
 *   groups its original's Strong numbers fall in (`lex:G5`, a thousand numbers each, as `lexiconV3` reads them). Those
 *   are known once the original is read, so a download installs the book first, then its groups (`lexWantV3`).
 * - A size is what `install` would fetch now: the segments of those units not in the store (`planV3`). A download cut
 *   halfway left its complete segments stored, so the size of the rest is smaller. Before the book's original is on the
 *   device its groups are not known: the size then counts every group of its testament, so «Bajar · 3,9 MB» never says
 *   less than what comes (an upper bound by the lexicon's part).
 * - An update is an installed unit whose segments changed in the catalog `refresh` kept (`status().updates`).
 */

import type { LanguagePackClient, PackReader, Progress as ProgressV3, Want } from '@bt-synergy/language-pack-client'
import type { Progress } from '../online/downloads'
import { BIBLE_ORDER } from '../reading'
import { planV3 } from './client'
import { lexGroupsOf } from './companionsV3'

/** What a format 3 call came to, in the words format 2.0 already says (`Blocked`), and `noConfiable`. */
export type OutcomeV3 =
  | { kind: 'listo' }
  /** The Worker has no format 3 pack of the language (`E_NO_PACK`). */
  | { kind: 'sinIdioma' }
  /** A 429: ask again after `retryAfter` seconds. */
  | { kind: 'espera'; retryAfter: number }
  /** Format 3 off (404 `v3-off`), a 5xx, no connection, a common catalog the server does not match. */
  | { kind: 'noDisponible' }
  /** A catalog whose signature is not by a trusted key (`E_SIGNATURE`): nothing was installed. */
  | { kind: 'noConfiable' }
  /** The store would not take it (`E_STORE`, quota included): the state is the one before. */
  | { kind: 'sinEspacio' }
  /** The run was stopped (its signal). */
  | { kind: 'parado' }

/** Seconds to wait after a 429 that named no time (as format 2.0's `RETRY.rateLimited`). */
export const RATE_LIMITED = 60

const codeOf = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined

/**
 * What an error of the client means. `E_SIGNATURE` is a `FormatError` of `language-pack-v3`, not a `ClientError`: told
 * by its code. Anything not known (a bug, a dropped connection the source did not wrap) is «noDisponible».
 */
export function outcomeOf(e: unknown, signal?: AbortSignal): OutcomeV3 {
  if (signal?.aborted) return { kind: 'parado' }
  const code = codeOf(e)
  if (code === 'E_NO_PACK') return { kind: 'sinIdioma' }
  if (code === 'E_SIGNATURE') return { kind: 'noConfiable' }
  if (code === 'E_STORE') return { kind: 'sinEspacio' }
  if (code === 'E_NETWORK' && (e as { status?: number }).status === 429) {
    const after = (e as { retryAfter?: number }).retryAfter
    return { kind: 'espera', retryAfter: typeof after === 'number' && after > 0 ? after : RATE_LIMITED }
  }
  return { kind: 'noDisponible' }
}

/**
 * The language's catalogs asked again (with their ETag: a 304 when nothing changed). A lower revision than the one here
 * (`E_DOWNGRADE`) is never confirmed: what is here is kept, and nothing is said.
 */
export async function refreshV3(client: LanguagePackClient, lang: string, signal?: AbortSignal): Promise<OutcomeV3> {
  try {
    await client.refresh(lang, signal ? { signal } : {})
    return { kind: 'listo' }
  } catch (e) {
    if (!signal?.aborted && codeOf(e) === 'E_DOWNGRADE') return { kind: 'listo' }
    return outcomeOf(e, signal)
  }
}

/** Every lexicon group of a book's testament, of the units the catalogs list (`es-419/lex:G0`...): an upper bound. */
export function testamentLexOf(book: string, units: readonly string[]): string[] {
  const greek = BIBLE_ORDER.indexOf(book.toLowerCase()) >= BIBLE_ORDER.indexOf('mat')
  const group = greek ? /\/lex:G\d+$/ : /\/lex:H\d+$/
  return units.filter((u) => group.test(u))
}

/** The lexicon units (of those the catalogs list, `es-419/lex:G5`) these Strong numbers are found in. */
export function lexUnitsFor(strongs: Iterable<string>, units: readonly string[]): string[] {
  const groups = lexGroupsOf(strongs)
  return units.filter((u) => groups.has(u.slice(u.indexOf('/') + 1)))
}

/** The lexicon units a book's original uses; null when its original is not readable here. */
async function bookLexOf(reader: PackReader | null, book: string, units: readonly string[]): Promise<string[] | null> {
  const orig = await reader?.orig(book.toLowerCase()).catch(() => undefined)
  return orig ? lexUnitsFor(orig.words.map((w) => w.strong), units) : null
}

/** A fresh reader of the language (not the library's cached one), or null when nothing can be read. */
const readerOf = (client: LanguagePackClient, lang: string): Promise<PackReader | null> => client.open(lang).catch(() => null)

/** The book a unit key names (`es-419/book:tit` → `tit`), or null. */
export const bookOfUnit = (key: string): string | null => /\/book:([^/]+)$/.exec(key)?.[1] ?? null

/**
 * What to install first for some books and some units by key (an offered update): `want`, without the lexicon, which
 * `lexWantV3` adds once the originals are here. `bytes` counts the lexicon too: the groups of each book's original when
 * it is here already, else every group of its testament (an upper bound). Undefined when no catalog of the language is
 * kept (refresh first); null when a book asked for is not in the catalogs.
 */
export async function planBooksV3(
  client: LanguagePackClient,
  lang: string,
  books: readonly string[],
  units: readonly string[] = [],
): Promise<{ want: Want; bytes: number } | null | undefined> {
  const want: Want = { books: books.map((b) => b.toLowerCase()), units: [...units] }
  const plan = await planV3(client, lang, want)
  if (!plan) return undefined
  if (books.some((b) => plan.unknown.includes(`book:${b.toLowerCase()}`))) return null
  if (!books.length) return { want, bytes: plan.bytes }
  const reader = await readerOf(client, lang)
  const lex = new Set<string>()
  for (const b of books) for (const u of (await bookLexOf(reader, b, plan.units)) ?? testamentLexOf(b, plan.units)) lex.add(u)
  const whole = lex.size ? await planV3(client, lang, { ...want, units: [...units, ...lex] }) : plan
  return { want, bytes: whole?.bytes ?? plan.bytes }
}

/**
 * The second step of a book's download: the lexicon groups its original uses, read from the original installed in the
 * first step. Null when there is nothing to add (no original readable, or no group listed).
 */
export async function lexWantV3(client: LanguagePackClient, lang: string, books: readonly string[]): Promise<{ want: Want; bytes: number } | null> {
  if (!books.length) return null
  const listed = await planV3(client, lang, { defaults: false })
  if (!listed) return null
  const reader = await readerOf(client, lang)
  const lex = new Set<string>()
  for (const b of books) for (const u of (await bookLexOf(reader, b, listed.units)) ?? []) lex.add(u)
  if (!lex.size) return null
  const want: Want = { units: [...lex], defaults: false }
  return { want, bytes: (await planV3(client, lang, want))?.bytes ?? 0 }
}

/** The books the language's catalog lists, in its order. */
export async function booksV3(client: LanguagePackClient, lang: string): Promise<string[]> {
  const units = (await client.status(lang)).units
  return units.flatMap((u) => {
    const book = bookOfUnit(u.key)
    return book ? [book] : []
  })
}

/** The Home offer of a language: its installed units with a newer catalog, their bytes, and what «Ahora no» keeps. */
export async function offerV3(client: LanguagePackClient, lang: string): Promise<{ bytes: number; key: string; units: string[] } | null> {
  const updates = (await client.status(lang)).updates
  if (!updates.length) return null
  // The revisions offered: «Ahora no» silences these, and the next revision of any of them is offered again.
  const offered = updates.map((u) => `${u.key}@${u.to}`).sort().join(' ')
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(offered)))
  return {
    bytes: updates.reduce((n, u) => n + u.bytes, 0),
    key: Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join(''),
    units: updates.map((u) => u.key),
  }
}

/** The install's progress as the screens read format 2.0's: bytes stored over the bytes planned. */
export const progressOf = (p: ProgressV3, planned: number): Progress => ({
  done: p.done,
  total: p.total,
  bytesDone: p.bytes,
  bytesTotal: Math.max(planned, p.bytes),
})

/**
 * What an install came to: its outcome, which wanted units are not active after it (a segment the server lacks), and
 * the bytes it fetched.
 */
export type InstalledV3 = { outcome: OutcomeV3; waiting: string[]; bytes: number }

/** Installs `want`, saying its progress. Never rejects: an error is its outcome. */
export async function installV3(
  client: LanguagePackClient,
  lang: string,
  want: Want,
  o: { signal: AbortSignal; planned: number; onProgress: (p: Progress) => void },
): Promise<InstalledV3> {
  try {
    const report = await client.install(lang, want, {
      signal: o.signal,
      onProgress: (p) => o.onProgress(progressOf(p, o.planned)),
    })
    return { outcome: { kind: 'listo' }, waiting: report.waiting.map((w) => w.key), bytes: report.bytes }
  } catch (e) {
    return { outcome: outcomeOf(e, o.signal), waiting: [], bytes: 0 }
  }
}
