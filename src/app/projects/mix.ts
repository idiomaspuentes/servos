/**
 * Making a verse from several versions of it (design 6.10), on a phone, by touch: each version is cut into pieces a
 * finger can take (at its signs, and a long run again every few words, in any language), the pieces kept are joined
 * back into a verse, and of a piece chosen in the mix the app proposes the one of another version that seems to say
 * the same (the most words in common): the person confirms.
 */

/** A piece of a verse to touch; `lineEnd` when a line of a poem ends after it. */
export interface Piece {
  text: string
  lineEnd?: boolean
}

/** Pieces longer than this many words are cut again, into runs about this long. */
const LONGEST = 7
const RUN = 4

/** A run of words cut into parts of about `RUN` words, as even as can be. */
function cutRun(words: string[]): string[] {
  if (words.length <= LONGEST) return [words.join(' ')]
  const parts = Math.ceil(words.length / RUN)
  const size = Math.ceil(words.length / parts)
  const out: string[] = []
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '))
  return out
}

/** A verse (its lines as the editor gives them) in pieces to touch: cut after its signs, long runs cut again. */
export function piecesOf(text: string): Piece[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const out: Piece[] = []
  lines.forEach((line, n) => {
    // After a sign that ends a phrase (with the closing quote that may follow it), where a space comes.
    const phrases = line.split(/(?<=[,;:.!?¿¡»”’)\]])\s+/u).filter(Boolean)
    const pieces = phrases.flatMap((phrase) => cutRun(phrase.split(/\s+/).filter(Boolean)))
    pieces.forEach((piece, i) => out.push(i === pieces.length - 1 && n < lines.length - 1 ? { text: piece, lineEnd: true } : { text: piece }))
  })
  return out
}

/** The verse the pieces make: a space between two, a new line where a line of the poem ended. */
export const joinPieces = (pieces: Piece[]): string =>
  pieces.map((p, i) => p.text + (i === pieces.length - 1 ? '' : p.lineEnd ? '\n' : ' ')).join('')

const wordsOf = (text: string) =>
  text
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * Of `pieces` (another version), the one that seems to say what `chosen` says: the one with the most words in
 * common, the first of those that tie; -1 when none shares a word.
 */
export function matchingPiece(chosen: string, pieces: Piece[]): number {
  const want = new Set(wordsOf(chosen))
  let best = -1
  let most = 0
  pieces.forEach((p, i) => {
    const shared = new Set(wordsOf(p.text).filter((w) => want.has(w))).size
    if (shared > most) {
      most = shared
      best = i
    }
  })
  return best
}

/** Names said together, as a person says them: «Ana», «Ana y Dani», «Ana, Bea y Dani». */
export function namesTogether(names: string[], and: string): string {
  if (names.length < 2) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')}${and}${names[names.length - 1]}`
}
