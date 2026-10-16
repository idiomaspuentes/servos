/**
 * Two versions of a verse (received from another computer while this one had its own, design 6.2): what tells them
 * apart, word by word, so the person sees at a glance the few words to weigh instead of reading two verses whole.
 */

import { joinStartOf, otherVersion, readDraft, structureConflictsOf, versionsAt } from './work'

/** A piece of a version: a word with the spaces after it, or spaces, marked when the other version lacks it. */
export interface VersionPiece {
  text: string
  changed: boolean
}

/** Words and the spaces between them, the spaces kept so the version reads as it was written. */
const piecesOf = (text: string) => text.split(/(\s+)/).filter(Boolean)

/**
 * Each version cut into pieces, the words the other does not have (in that order) marked: the longest run of words
 * both share in the same order stays unmarked. A word differs by any letter or sign («Nínive,» and «Nínive» differ):
 * a comma can change what a verse says.
 */
export function compareVersions(a: string, b: string): { a: VersionPiece[]; b: VersionPiece[] } {
  const pa = piecesOf(a)
  const pb = piecesOf(b)
  const wa = pa.map((p, i) => [p, i] as const).filter(([p]) => !/^\s+$/.test(p))
  const wb = pb.map((p, i) => [p, i] as const).filter(([p]) => !/^\s+$/.test(p))
  // The longest common run of words (a verse is short: the whole table is cheap).
  const n = wa.length
  const m = wb.length
  const run: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) run[i][j] = wa[i][0] === wb[j][0] ? run[i + 1][j + 1] + 1 : Math.max(run[i + 1][j], run[i][j + 1])
  const sharedA = new Set<number>()
  const sharedB = new Set<number>()
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (wa[i][0] === wb[j][0]) {
      sharedA.add(wa[i][1])
      sharedB.add(wb[j][1])
      i++
      j++
    } else if (run[i + 1][j] >= run[i][j + 1]) i++
    else j++
  }
  // Words changed side by side are one change: the space between them is marked with them, so they read as one.
  const mark = (pieces: string[], shared: Set<number>) => {
    const changed = (i: number) => i >= 0 && i < pieces.length && !/^\s+$/.test(pieces[i]) && !shared.has(i)
    return pieces.map((text, i) => ({ text, changed: /^\s+$/.test(text) ? changed(i - 1) && changed(i + 1) : changed(i) }))
  }
  return { a: mark(pa, sharedA), b: mark(pb, sharedB) }
}

/** What waits for a choice: a verse with two versions, or a stretch joined one way here and another there. */
export type ToChoose = { chapter: number; verse: number; kind: 'texto' | 'estructura' }

/** What waits for a choice in a book's chapters, in order. */
export function versesToChoose(book: string, chapters: Array<{ chapter: number; verses: number[] }>): ToChoose[] {
  const inBook = new Set(chapters.map((c) => c.chapter))
  const stretches = structureConflictsOf(book).filter((c) => inBook.has(c.chapter))
  const inStretch = (chapter: number, verse: number) => stretches.some((c) => c.chapter === chapter && c.from <= verse && verse <= c.to)
  return [
    ...chapters.flatMap(({ chapter, verses }) =>
      verses.filter((verse) => otherVersion(book, chapter, verse) && !inStretch(chapter, verse)).map((verse) => ({ chapter, verse, kind: 'texto' as const }))
    ),
    ...stretches.map((c) => ({ chapter: c.chapter, verse: c.from, kind: 'estructura' as const })),
  ].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
}

/**
 * What waits to be gathered (design 6.10): a section of the chapter with verses written several ways, read and kept
 * as a whole or verse by verse; or a stretch joined one way here and another there, chosen whole.
 */
export type GatherStep = { kind: 'seccion'; chapter: number; verses: number[] } | { kind: 'estructura'; chapter: number; verse: number }

/** The verses of a section as the team writes them: a join once, by its first verse. */
export const unitsOf = (book: string, chapter: number, verses: number[]) => verses.filter((v) => joinStartOf(book, chapter, v) === v)

/** The verses of a section with versions waiting to be gathered. */
export const waitingIn = (book: string, chapter: number, verses: number[]) => unitsOf(book, chapter, verses).filter((v) => versionsAt(book, chapter, v).length > 0)

/** What waits to be gathered in a book's chapters, in order: by section, the stretches joined two ways apart. */
export function sectionsToGather(book: string, chapters: Array<{ chapter: number; verses: number[]; sections: number[][] }>): GatherStep[] {
  const inBook = new Set(chapters.map((c) => c.chapter))
  const stretches = structureConflictsOf(book).filter((c) => inBook.has(c.chapter))
  const inStretch = (chapter: number, verse: number) => stretches.some((c) => c.chapter === chapter && c.from <= verse && verse <= c.to)
  const steps: GatherStep[] = chapters.flatMap(({ chapter, verses, sections }) => {
    // A verse no section holds is a section of its own.
    const held = new Set(sections.flat())
    const all = [...sections, ...verses.filter((v) => !held.has(v)).map((v) => [v])].sort((a, b) => a[0] - b[0])
    return all
      .filter((section) => waitingIn(book, chapter, section).some((v) => !inStretch(chapter, v)))
      .map((section) => ({ kind: 'seccion' as const, chapter, verses: section }))
  })
  return [...steps, ...stretches.map((c) => ({ kind: 'estructura' as const, chapter: c.chapter, verse: c.from }))].sort(
    (a, b) => a.chapter - b.chapter || (a.kind === 'seccion' ? a.verses[0] : a.verse) - (b.kind === 'seccion' ? b.verses[0] : b.verse)
  )
}

/** A section as someone wrote it: each verse with the version they wrote, or, where they wrote none apart, the one here. */
export interface Reading {
  /** Who wrote it this way (two who wrote the whole section alike are one reading); empty for a mix no one wrote. */
  names: string[]
  /** It is the section as it is now on this phone. */
  here: boolean
  verses: Array<{ verse: number; text: string; key: string }>
}

/**
 * The ways a section was written, the one here first, then each other in the order its people come: what a person
 * reads tab by tab before keeping one for the whole section.
 */
export function readingsOf(book: string, chapter: number, verses: number[]): Reading[] {
  const units = unitsOf(book, chapter, verses)
  const versions = new Map(units.map((v) => [v, versionsAt(book, chapter, v)]))
  const hereOf = (v: number) => {
    const here = versions.get(v)!.find((x) => x.here)
    return { verse: v, text: here?.text ?? readDraft(book, chapter, v), key: here?.key ?? '' }
  }
  // Each person in the order they first come with a version of their own; who wrote only what is here, after.
  const all = [...versions.values()].flat()
  const people = [...new Set([...all.filter((x) => !x.here), ...all.filter((x) => x.here)].flatMap((x) => x.by))]
  const readingOf = (name: string) =>
    units.map((v) => {
      const theirs = versions.get(v)!.find((x) => x.by.includes(name))
      return theirs ? { verse: v, text: theirs.text, key: theirs.key } : hereOf(v)
    })
  const keyOf = (r: Reading['verses']) => r.map((x) => x.key || x.text).join('|')
  const here: Reading = { names: [], here: true, verses: units.map(hereOf) }
  const out: Reading[] = [here]
  for (const name of people) {
    const verses = readingOf(name)
    const same = out.find((r) => keyOf(r.verses) === keyOf(verses))
    if (same) same.names.push(name)
    else out.push({ names: [name], here: false, verses })
  }
  return out
}
