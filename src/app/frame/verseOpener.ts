/**
 * Going to a verse of another place from deep inside a screen (a place «En toda la Biblia» lists): the app, which knows
 * the project and the mini app open, says whether it can and does it. Kept here so the word card does not have to be
 * handed a callback through every mini app. None while no mini app is open.
 */

export type VersePlace = { book: string; chapter: number; verse: number }

export type VerseOpener = {
  /** Whether the verse can be opened where the person works: a book of the project, read on this device. */
  can(place: VersePlace): boolean
  open(place: VersePlace): void
}

let current: VerseOpener | null = null

export function setVerseOpener(opener: VerseOpener | null): void {
  current = opener
}

export const verseOpener = (): VerseOpener | null => current
