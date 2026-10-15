/**
 * Checking the translation of the words (Translation Words): every use of a word the words list links to an article
 * (God, Yahweh, faith, Nineveh…) is checked on its own, as the notes are, and what it adds is the comparison: how the
 * same word was translated in the other places of the book. A word need not be translated the same everywhere; where
 * it means the same it should, and where it means something else it should say that. Seeing the renderings side by
 * side is what lets the translator tell which is which, as Taller's «Revisar palabras clave» and translationCore do.
 */

import type { Places, PrototypeData } from '../../prototype/data'

/** The kinds of words, as translationWords sorts its articles: key terms, other terms, names. */
export const WORD_KINDS = ['kt', 'other', 'names']

/** One use of a word: where it is, its article, and its words in each text. */
export interface WordItem {
  /** The words list's id for this use. */
  id: string
  chapter: number
  verse: number
  /** The article's path (`bible/kt/god`): the word, whatever its form here. */
  article: string
  kind: string
  /** The words of the original here. */
  original: string
  keyTerm: boolean
  places: Places
}

export const kindOf = (article: string) => article.split('/')[1] ?? 'other'

/** Every use of a word in these chapters, in the order of the verses. */
export function wordChecksOf(chapters: PrototypeData[]): WordItem[] {
  const out: WordItem[] = []
  const seen = new Set<string>()
  for (const data of chapters) {
    for (const v of data.verses) {
      for (const w of v.words) {
        if (seen.has(w.id)) continue
        seen.add(w.id)
        out.push({ id: w.id, chapter: data.chapter, verse: v.verse, article: w.article, kind: kindOf(w.article), original: w.original, keyTerm: w.keyTerm, places: w.places })
      }
    }
  }
  return out
}

/** The same uses word by word: each word's uses together, the words in the order they first appear. */
export function byWord<T extends { article: string }>(items: T[]): T[] {
  const order = [...new Set(items.map((i) => i.article))]
  return order.flatMap((article) => items.filter((i) => i.article === article))
}

const bare = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

/** What the translator marked, as it reads: the marked words in order, «…» where words are left out between them. */
export function renderingOf(words: string[], picked: number[]): string {
  const sorted = [...picked].sort((a, b) => a - b)
  return sorted
    .map((p, i) => (i > 0 && p > sorted[i - 1] + 1 ? `… ${bare(words[p] ?? '')}` : bare(words[p] ?? '')))
    .filter(Boolean)
    .join(' ')
}

/** A way a word was translated, and the uses translated so. */
export interface Rendering<U> {
  text: string
  places: U[]
}

/** The ways a word was translated across its uses, the most used first; the same words in other capitals are one. */
export function renderingsOf<U extends { text: string }>(uses: U[]): Rendering<U>[] {
  const out = new Map<string, Rendering<U>>()
  for (const use of uses) {
    if (!use.text) continue
    const key = use.text.toLocaleLowerCase()
    const found = out.get(key) ?? { text: use.text, places: [] }
    found.places.push(use)
    out.set(key, found)
  }
  return [...out.values()].sort((a, b) => b.places.length - a.places.length)
}
