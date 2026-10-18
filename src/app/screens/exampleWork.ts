/**
 * Work as two teammates would bring it back from their communities, for the prototype to gather: Bea translated the
 * last chapter, and Carlos the first two sections of the first chapter and, by a slip, the last section of the last
 * one, which Bea also did, so gathering both shows what happens when two people wrote the same verse.
 *
 * Wired, these come as work files from another computer (a memory stick, a shared folder, a phone nearby). The texts
 * stand for a translation the prototype does not have: Bea's are the TPL's, Carlos's the TPS's, so where both did the
 * same verse their texts differ, as two translators' would.
 */

import type { PrototypeData } from '../../prototype/data'
import type { Project } from '../projects/model'
import type { SharedFile } from '../projects/share'
import type { WorkFile } from '../projects/work'

const linesOf = (c: PrototypeData, verse: number, text: number) =>
  (c.texts[text]?.lines[verse] ?? []).map((line) => line.pieces.map((p) => p.text).join('')).join('\n')

const rangeLabel = (c: PrototypeData, verses: number[]) =>
  `${c.chapter}:${verses[0]}${verses.length > 1 ? `–${verses[verses.length - 1]}` : ''}`

export function exampleWork(chapters: PrototypeData[]): WorkFile[] {
  if (!chapters.length) return []
  const name = chapters[0].book.name
  const book = chapters[0].book.id
  const last = chapters[chapters.length - 1]
  const first = chapters[0]
  const firstPart = first.sections.slice(0, 2).flat()
  const lastPart = last.sections[last.sections.length - 1] ?? []
  const verses = (c: PrototypeData, vs: number[], text: number) =>
    vs.map((verse) => ({ chapter: c.chapter, verse, text: linesOf(c, verse, text) }))
  return [
    { from: 'Bea', book, label: `${name} ${last.chapter}`, verses: verses(last, last.verses.map((v) => v.verse), 0) },
    {
      from: 'Carlos',
      book,
      label: `${name} ${rangeLabel(first, firstPart)}${last !== first ? `, ${rangeLabel(last, lastPart)}` : ''}`,
      verses: [...verses(first, firstPart, 1), ...(last !== first ? verses(last, lastPart, 1) : [])],
    },
  ]
}

/** The same work, as the files Bea and Carlos would share from their phones (`projects/share.ts`). */
export function exampleShared(project: Project, chapters: PrototypeData[]): SharedFile[] {
  const { books: _books, ...rest } = project
  void _books
  return exampleWork(chapters).map((w) => ({
    format: 'servos-compartir',
    version: 1,
    from: w.from,
    at: '2026-10-15T12:00:00.000Z',
    project: rest,
    books: [
      {
        code: w.book,
        phase: 'traduccion',
        verses: w.verses.map((v) => ({ ...v, by: w.from })),
        others: [],
        alignments: [],
        checks: {},
        studyNotes: [],
      },
    ],
    glossary: [],
  }))
}
