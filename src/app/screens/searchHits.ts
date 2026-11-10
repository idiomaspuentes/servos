/**
 * What the search sheet shows of the library's hits (`reader.search`): grouped by what they are (the texts first, then
 * the notes, the questions and the word links), each with the verse it opens and its snippet cut where the library
 * marked the words found (« »).
 */
import type { Hit } from '@bt-synergy/language-pack-client'
import { inBibleOrder } from '../../resources/reading'
import { parsePlace } from '../../resources/v3/lookups'
import type { VersePlace } from '../frame/verseOpener'
import type { T } from '../i18n/i18n'
import { bookName } from '../projects/model'

export const KINDS = ['text', 'note', 'question', 'link'] as const

export type HitGroup = { kind: string; hits: Hit[] }

/** The hits by kind, in the order of `KINDS` (a kind the app does not know yet goes last); each group keeps its order. */
export function groupHits(hits: Hit[]): HitGroup[] {
  const groups = new Map<string, Hit[]>()
  for (const h of hits) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h])
  const rank = (kind: string) => {
    const i = (KINDS as readonly string[]).indexOf(kind)
    return i < 0 ? KINDS.length : i
  }
  return [...groups].map(([kind, list]) => ({ kind, hits: list })).sort((a, b) => rank(a.kind) - rank(b.kind))
}

/** The verse a hit opens; none for a note on a book's or chapter's introduction (`front:intro`, `3:intro`). */
export function hitPlace(hit: Hit): VersePlace | null {
  return parsePlace(`${hit.book} ${hit.ref}`)
}

/** Where a hit is, as the app names places: «Tito 3:7», «Tito, introducción», «Tito 3, introducción». */
export function hitWhere(hit: Hit, t: T): string {
  const book = bookName(hit.book)
  const place = hitPlace(hit)
  if (place) return `${book} ${hit.ref}`
  if (hit.ref.startsWith('front')) return t('buscar.introLibro', { libro: book })
  const chapter = /^(\d+):intro/.exec(hit.ref)
  return chapter ? t('buscar.introCapitulo', { libro: book, n: Number(chapter[1]) }) : `${book} ${hit.ref}`
}

/** The heading of a group of hits: `buscar.tipo.text` and the like, or a plain «Otros» for a kind the app does not know. */
export const groupKey = (kind: string): string => ((KINDS as readonly string[]).includes(kind) ? `buscar.tipo.${kind}` : 'buscar.tipo.otro')

/** A word as the index compares it: without case, accents or punctuation. */
const fold = (w: string) => w.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()

/**
 * The snippet in pieces, `found` for the words searched. The library marks them with « », which Spanish texts also
 * use as quotes: a mark is a « » around one of the searched words (accents and case aside), and any other « » is the
 * text's own (`La palabra ««gracía»» aquí` has the word found inside its quotes).
 */
export function snippetParts(snippet: string, searched: string): { text: string; found: boolean }[] {
  const words = new Set(searched.split(/\s+/).filter(Boolean).map(fold))
  const out: { text: string; found: boolean }[] = []
  const push = (text: string, found: boolean) => {
    const last = out[out.length - 1]
    if (last && !last.found && !found) last.text += text
    else if (text) out.push({ text, found })
  }
  const re = /«([^«»]*)»/g
  let at = 0
  for (let m = re.exec(snippet); m; m = re.exec(snippet)) {
    if (!words.has(fold(m[1]!))) continue
    push(snippet.slice(at, m.index), false)
    push(m[1]!, true)
    at = m.index + m[0].length
  }
  push(snippet.slice(at), false)
  return out
}

/** A text's short name (`es-419/glt` is GLT), as the verse sheet shows one it has no abbreviation for. */
export const resLabel = (res: string): string => res.slice(res.lastIndexOf('/') + 1).toUpperCase()

/**
 * Which books a search looks in, and which books read here it does not: `before`, read from a pack of before (format 2;
 * format 3 has not got them); `notIndexed`, in format 3 but not in the index yet (or their indexing failed). Codes in
 * Bible order. A search never says «nothing» of a book it did not look in.
 */
export function searchCoverage(readable: string[], v3: { searchable: string[]; notIndexed: string[] }) {
  const low = (books: string[]) => new Set(books.map((b) => b.toLowerCase()))
  const searchable = low(v3.searchable)
  const notIndexed = low(v3.notIndexed)
  return {
    searchable: inBibleOrder(searchable),
    notIndexed: inBibleOrder(notIndexed),
    before: inBibleOrder([...low(readable)].filter((b) => !searchable.has(b) && !notIndexed.has(b))),
  }
}
