/**
 * Reviewing a passage as a whole (design, section 4): a section of the team's translation read through and weighed
 * by four questions, one at a time: is it faithful (it says what the source says, nothing taken out or added), clear
 * (it is understood the first time it is heard), natural (it sounds as people speak), precise (names, numbers, places
 * and key terms right). It complements the checks with the notes and with the words, which go phrase by phrase.
 *
 * What is kept: for each section and question, who answered «yes» on which text (an answer stands while the text it
 * was given on does); and, for each verse, what someone saw to improve, with the words it is about, until someone
 * marks it improved. In the prototype it lives in this browser; wired, in the book's journal.
 */

export type Criterion = 'fiel' | 'claro' | 'natural' | 'preciso'
export const CRITERIA: Criterion[] = ['fiel', 'claro', 'natural', 'preciso']

/** A question answered «yes» for a section, on the text it had then. */
export interface PassageAnswer {
  by: string
  at: string
  /** The fingerprint of the section's text it was given on. */
  key: string
}

/** Something to improve in a verse, seen while weighing a question. */
export interface Observation {
  id: string
  verse: number
  criterion: Criterion
  /** The words of the translation it is about, as marked. */
  words: string
  comment: string
  by: string
  at: string
  state: 'abierta' | 'resuelta'
  resolvedBy?: string
  resolvedAt?: string
}

const KEY = 'servos.prototipo'
const read = <T>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* kept on screen for this visit */
  }
}
const passageKey = (book: string, chapter: number, first: number) => `${KEY}.pasaje.${book}.${chapter}.${first}`
const observationsKey = (book: string, chapter: number, verse: number) => `${KEY}.observacion.${book}.${chapter}.${verse}`

/** A fingerprint of a section's text: an answer given on another text no longer stands. */
export function textKey(texts: string[]): string {
  const text = texts.map((x) => x.replace(/\s+/g, ' ').trim()).join('\n')
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36) + text.length.toString(36)
}

/** The questions answered «yes» for a section on its text as it is now. */
export function answersOf(book: string, chapter: number, verses: number[], texts: string[]): Partial<Record<Criterion, PassageAnswer>> {
  const kept = read<Partial<Record<Criterion, PassageAnswer>>>(passageKey(book, chapter, verses[0])) ?? {}
  const now = textKey(texts)
  return Object.fromEntries(Object.entries(kept).filter(([, a]) => a?.key === now)) as Partial<Record<Criterion, PassageAnswer>>
}

export function answer(book: string, chapter: number, verses: number[], texts: string[], criterion: Criterion, by: string, now = new Date()) {
  const k = passageKey(book, chapter, verses[0])
  const kept = read<Partial<Record<Criterion, PassageAnswer>>>(k) ?? {}
  write(k, { ...kept, [criterion]: { by, at: now.toISOString(), key: textKey(texts) } })
}

export const observationsOf = (book: string, chapter: number, verse: number): Observation[] => read<Observation[]>(observationsKey(book, chapter, verse)) ?? []

export const openObservations = (book: string, chapter: number, verses: number[]) =>
  verses.flatMap((v) => observationsOf(book, chapter, v)).filter((o) => o.state === 'abierta')

export function addObservation(book: string, chapter: number, o: Omit<Observation, 'id' | 'at' | 'state'>, now = new Date()): Observation {
  const made: Observation = { ...o, id: `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: now.toISOString(), state: 'abierta' }
  write(observationsKey(book, chapter, o.verse), [...observationsOf(book, chapter, o.verse), made])
  return made
}

/** Marks something improved: it stays, with who said so, for whoever wants to see what was done. */
export function resolveObservation(book: string, chapter: number, verse: number, id: string, by: string, now = new Date()) {
  write(
    observationsKey(book, chapter, verse),
    observationsOf(book, chapter, verse).map((o) => (o.id === id ? { ...o, state: 'resuelta', resolvedBy: by, resolvedAt: now.toISOString() } : o))
  )
}

/**
 * A section is reviewed when its four questions stand «yes» on its text as it is, and nothing seen to improve in it is
 * still open. Its verses count as done.
 */
export function passageDone(book: string, chapter: number, verses: number[], texts: string[]): boolean {
  if (!texts.some((x) => x.trim())) return false
  const answers = answersOf(book, chapter, verses, texts)
  return CRITERIA.every((c) => answers[c]) && openObservations(book, chapter, verses).length === 0
}
