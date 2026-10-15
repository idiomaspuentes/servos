/**
 * Two versions of a verse (received from another computer while this one had its own, design 6.2): what tells them
 * apart, word by word, so the person sees at a glance the few words to weigh instead of reading two verses whole.
 */

import { otherVersion } from './work'

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

/** The verses of a book's chapters that have two versions waiting for a choice, in order. */
export function versesToChoose(book: string, chapters: Array<{ chapter: number; verses: number[] }>) {
  return chapters.flatMap(({ chapter, verses }) => verses.filter((verse) => otherVersion(book, chapter, verse)).map((verse) => ({ chapter, verse })))
}
