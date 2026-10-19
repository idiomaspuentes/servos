/**
 * Checking a translation against the notes: for each note that sends to a Translation Academy article (a phrase that
 * may be misread or is hard to translate), the translator marks the words of their verse that translate the phrase
 * and says whether they translated it as the note explains.
 *
 * A check is resolved only when it is marked «it is right», and only while the verse is as it was when marked: a
 * later change to the verse leaves it to be checked again, as translationCore 3 and 4 and Taller do. «Correct later»
 * keeps a found error, or a doubt to look into, for when the team is together; it is not resolved.
 *
 * In the prototype the checks live in this browser, one a note. Wired, each is an entry of the book's journal.
 */

import type { PrototypeData, PrototypeNote } from '../../prototype/data'
import { textKey } from '../../core/textKey'
import { scoped } from './scope'

/**
 * The categories of the checks, by Translation Academy article: translationCore 3's grouping of translation notes,
 * as translationCore 4 keeps it (`src/data/derive.ts`, `TN_CATEGORY_MAP`). An article not listed is «other».
 */
export const NOTE_CATEGORIES: Record<string, string[]> = {
  discourse: [
    'figs-declarative', 'figs-events', 'figs-exclamations', 'figs-exmetaphor', 'figs-imperative', 'figs-parables',
    'figs-pastforfuture', 'figs-quotations', 'figs-quotesinquotes', 'figs-sentences', 'translate-versebridge',
    'writing-background', 'writing-connectingwords', 'writing-endofstory', 'writing-intro', 'writing-newevent',
    'writing-participants', 'writing-poetry', 'writing-proverbs', 'writing-quotations',
  ],
  numbers: ['translate-fraction', 'translate-numbers', 'translate-ordinal'],
  figures: [
    'figs-apostrophe', 'figs-doublenegatives', 'figs-doublet', 'figs-ellipsis', 'figs-euphemism', 'figs-hendiadys',
    'figs-hyperbole', 'figs-idiom', 'figs-irony', 'figs-litotes', 'figs-merism', 'figs-metaphor', 'figs-metonymy',
    'figs-parallelism', 'figs-personification', 'figs-rquestion', 'figs-simile', 'figs-synecdoche', 'figs-quotemarks',
  ],
  culture: [
    'figs-explicit', 'figs-go', 'translate-bdistance', 'translate-bmoney', 'translate-bvolume', 'translate-hebrewmonths',
    'translate-names', 'translate-bweight', 'translate-symaction', 'translate-unknown', 'writing-symlanguage',
  ],
  grammar: [
    'figs-abstractnouns', 'figs-activepassive', 'figs-distinguish', 'figs-exclusive', 'figs-123person', 'figs-they',
    'figs-you', 'figs-we', 'figs-genericnoun', 'figs-hypo', 'figs-inclusive', 'figs-nominaladj', 'figs-possession',
    'figs-pronouns', 'figs-rpronouns', 'figs-gendernotations', 'grammar-connect-logic-goal',
    'grammar-connect-exceptions', 'grammar-connect-logic-contrast', 'grammar-connect-logic-result',
  ],
  other: ['guidelines-sonofgodprinciples', 'translate-manuscripts', 'translate-textvariants', 'translate-transliterate'],
}
export const CATEGORY_ORDER = ['figures', 'grammar', 'culture', 'discourse', 'numbers', 'other']

const categoryOfSlug = new Map(Object.entries(NOTE_CATEGORIES).flatMap(([cat, slugs]) => slugs.map((s) => [s, cat] as const)))

/** The article's slug (`figs-metaphor`) of a path (`translate/figs-metaphor`). */
export const slugOf = (academy: string) => academy.split('/').pop() ?? academy

// A connecting word's article the list does not have yet (`grammar-connect-time-sequential`) is still grammar.
export const categoryOf = (academy: string) =>
  categoryOfSlug.get(slugOf(academy)) ?? (slugOf(academy).startsWith('grammar-') ? 'grammar' : 'other')

/** A note to check: the one note, at the first verse it is about. */
export interface CheckItem {
  note: PrototypeNote
  chapter: number
  verse: number
  /** The Translation Academy article's path. */
  academy: string
  category: string
}

/** The notes of these chapters that send to an article, each once, in the order of the verses. */
export function checksOf(chapters: PrototypeData[]): CheckItem[] {
  const out: CheckItem[] = []
  const seen = new Set<string>()
  for (const data of chapters) {
    for (const v of data.verses) {
      for (const note of v.notes) {
        if (!note.academy || seen.has(note.id)) continue
        seen.add(note.id)
        out.push({ note, chapter: data.chapter, verse: v.verse, academy: note.academy, category: categoryOf(note.academy) })
      }
    }
  }
  return out
}

export type CheckStatus = 'bien' | 'despues'

/** What the translator answered for a note. */
export interface NoteCheck {
  status: CheckStatus
  /** The words of the verse that translate the phrase, by their place among its words (from 0). */
  words: number[]
  /** The phrase is not in the translation (left out on purpose, or missing). */
  notThere?: boolean
  /** For «correct later»: why, and what was seen. */
  reason?: 'equipo' | 'investigar'
  comment?: string
  /** The verse as it was when answered: an answer to another text is not an answer. */
  verseText: string
  by: string
  at: string
  /**
   * The answers this one was given knowing (by `checkKey`): the ones it replaced here, and those it came from. What
   * tells which of two answers came after, between devices: never the date, which a device's clock may have wrong.
   */
  was?: string[]
  /**
   * Answers to the same check given apart on other devices, neither knowing the other: they wait here for a person to
   * choose, nothing lost (decided with Abel on 19 October 2026). Answering again chooses.
   */
  others?: NoteCheck[]
}

/** What an answer says, not who gave it or when: two answers that say the same are one. */
export const checkKey = (c: NoteCheck): string =>
  textKey(JSON.stringify([c.status, c.words, Boolean(c.notThere), c.reason ?? '', c.comment ?? '', c.verseText.replace(/\s+/g, ' ').trim()]))

/** Every answer a check knows of: the ones it came after, and the ones waiting beside it. */
const knownBy = (c: NoteCheck): string[] => [...(c.was ?? []), ...(c.others ?? []).flatMap((o) => [...(o.was ?? []), checkKey(o)])]

/** The words of a verse as the translator touches them: what spaces part. */
export const wordsOfVerse = (text: string) => text.split(/\s+/).filter(Boolean)

/** Where a check is kept: the store names the kind of check (`revisionNota`, `revisionPalabra`), the id what is checked. */
// Each project keeps its own checks of a book (scope.ts).
const key = (book: string, id: string, store: string) => `servos.prototipo.${store}.${scoped(book)}.${id}`

export function readCheck(book: string, id: string, store = 'revisionNota'): NoteCheck | null {
  try {
    return JSON.parse(localStorage.getItem(key(book, id, store)) ?? 'null') as NoteCheck | null
  } catch {
    return null
  }
}

/**
 * Keeps an answer. It is given knowing the one there was and any waiting beside it (`others`): those are now behind it,
 * so answering again is also choosing among answers given apart.
 */
export function writeCheck(book: string, id: string, check: NoteCheck, store = 'revisionNota') {
  const before = readCheck(book, id, store)
  const { others: _, ...answer } = check
  const was = [...new Set([...(answer.was ?? []), ...(before ? [...knownBy(before), checkKey(before)] : [])])].filter((k) => k !== checkKey(answer))
  try {
    localStorage.setItem(key(book, id, store), JSON.stringify(was.length ? { ...answer, was } : answer))
  } catch {
    /* kept on screen for this visit */
  }
}

/**
 * A check received from another device, gathered with the one here (`mine`): what to keep, or null when nothing
 * changes. `mineOn`/`theirsOn` say whether each was given on the verse as it stands now. The one given on the verse as
 * it stands wins; else the one given knowing the other; and two given apart, saying different things, are both kept:
 * the one here stays, the other waits beside it for a person to choose. The date decides nothing.
 */
export function gatherCheck(mine: NoteCheck | null, theirs: NoteCheck, mineOn: boolean, theirsOn: boolean): NoteCheck | null {
  if (!mine) return theirs
  const m = checkKey(mine)
  const t = checkKey(theirs)
  const takeTheirs =
    m !== t && ((theirsOn && !mineOn) || (theirsOn === mineOn && Boolean(theirs.was?.includes(m)) && !mine.was?.includes(t)))
  const keepMine = m === t || (mineOn && !theirsOn) || (theirsOn === mineOn && Boolean(mine.was?.includes(t)))
  const winner = takeTheirs ? theirs : mine
  const apart = !takeTheirs && !keepMine
  const behind = new Set([...(winner.was ?? []), checkKey(winner)])
  const others: NoteCheck[] = []
  for (const o of [...(mine.others ?? []), ...(theirs.others ?? []), ...(apart ? [theirs] : [])]) {
    const k = checkKey(o)
    if (!behind.has(k) && !others.some((x) => checkKey(x) === k)) others.push(o)
  }
  const { others: _, ...answer } = winner
  const kept = others.length ? { ...answer, others } : answer
  return JSON.stringify(kept) === JSON.stringify(mine) ? null : kept
}

/** Where a note's check stands now, against the verse as it is. */
export type CheckState = 'pendiente' | 'bien' | 'despues' | 'cambio' | 'elegir'

const sameVerse = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()

/**
 * The answers to choose from, when two were given apart on the verse as it is (`others`): the one here first, then
 * each waiting beside it. Empty when there is nothing to choose.
 */
export function answersToChoose(check: NoteCheck | null, verseText: string): NoteCheck[] {
  if (!check || !sameVerse(check.verseText, verseText)) return []
  const waiting = (check.others ?? []).filter((o) => sameVerse(o.verseText, verseText))
  if (!waiting.length) return []
  const { others: _, ...here } = check
  return [here, ...waiting]
}

export function stateOf(check: NoteCheck | null, verseText: string): CheckState {
  if (!check) return 'pendiente'
  // Answered for another text: whatever the answer, it is to be checked again.
  if (check.verseText.trim() !== verseText.trim()) return 'cambio'
  // Two answers given apart on this same verse wait for a person to choose: not resolved until then.
  if (answersToChoose(check, verseText).length) return 'elegir'
  return check.status
}
