/**
 * Where a glossary entry's word of the original appears in the project's books, and whether the team's translation of
 * each verse uses the agreed rendering (or one of its other forms): what lets the team keep a word the same across a
 * book, and find the verses written before the decision.
 */

import type { PrototypeData } from '../../prototype/data'
import { baseStrong, type GlossaryEntry } from './glossary'
import { textOf } from './work'

export type UseState = 'uses' | 'other' | 'untranslated'

export interface GlossaryUse {
  book: string
  chapter: number
  verse: number
  state: UseState
}

/** A form found in a verse as words of its own: «rey» is in «el rey dijo», not in «reyes». */
export function hasForm(text: string, form: string): boolean {
  const f = form.trim().toLocaleLowerCase()
  if (!f) return false
  const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text.toLocaleLowerCase())
}

/** The verses where every word of the entry (one, or each of an expression) is in the original. */
export function glossaryUses(entry: GlossaryEntry, books: Array<{ code: string; chapters: PrototypeData[] }>): GlossaryUse[] {
  const wanted = entry.strong.split(';').map(baseStrong).filter(Boolean)
  if (!wanted.length) return []
  const forms = [entry.rendering, ...entry.alternatives].filter((f) => f.trim())
  const out: GlossaryUse[] = []
  for (const { code, chapters } of books) {
    for (const data of chapters) {
      const original = data.texts.find((x) => x.original)
      if (!original?.words) continue
      for (const { verse } of data.verses) {
        const here = new Set(
          (original.lines[verse] ?? []).flatMap((l) => l.pieces.map((p) => (p.word === undefined ? '' : baseStrong(original.words![p.word]?.strong ?? ''))))
        )
        if (!wanted.every((s) => here.has(s))) continue
        const text = textOf(code, data.chapter, verse)
        out.push({ book: code, chapter: data.chapter, verse, state: !text.trim() ? 'untranslated' : forms.some((f) => hasForm(text, f)) ? 'uses' : 'other' })
      }
    }
  }
  return out
}
