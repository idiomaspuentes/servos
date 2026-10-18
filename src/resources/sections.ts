/**
 * Where each section begins in every chapter of the Bible: the `\ts\*` markers of unfoldingWord's ULT, the sections
 * translationCore works by (`sections.json`, written by `makeSections.test.ts`). In the app, not in a pack: the
 * gateway languages' texts do not mark them, and they depend on the versification alone.
 */

import table from './sections.json'

const SECTIONS = table as Record<string, Record<string, number[]>>

/** The verses where the chapter's sections begin, or undefined when the table does not know the chapter. */
export const sectionStartsOf = (book: string, chapter: number): number[] | undefined => SECTIONS[book.toLowerCase()]?.[String(chapter)]
