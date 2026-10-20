/**
 * Touching a word of a text (a bridge text or the original) brings the notes and the translation words that are about
 * it, one at a time, right under its verse (philosophy, principle 4). First come the other bridge texts: the TPS is a
 * help to the TPL as much as a text, so a TPL word shows the TPS words that translate the same original words (and
 * the other way round), as Taller does. A help knows its words in every text through the
 * alignment (`PrototypeNote.places`), so a Hebrew word finds the notes of its Spanish words, and the help being read
 * lights its words in every pane.
 */

import { RowButton } from './Actions'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Places, PrototypeData, PrototypeNote, PrototypeText } from '../../prototype/data'
import type { WordLine } from '../../resources/reading'
import { useT } from '../i18n/i18n'
import { entriesAbout, type GlossaryEntry } from '../projects/glossary'
import { lexiconOf } from '../../prototype/data'
import { sensesOfWord, strongCode, type LexiconSense } from '../../lexicon/lexicon'
import { Markdown } from './Markdown'
import { hasReferents, OriginalFacts, Referents } from './OriginalWord'
import { SentenceDiagram } from './SentenceDiagram'
import { Sheet } from './Sheet'
import { inSight, keepPlace, litOf, pagedHelps, revealBelow, shortGloss } from './wordCard'

export type WordHelp =
  /** What the original says of how a word of it is read: the qere of a ketiv, another possible reading, a note. */
  | { kind: 'lectura'; id: string; places: Places; reading: 'qere' | 'perhaps' | 'note'; text: string }
  | { kind: 'glosario'; id: string; places: Places; entry: GlossaryEntry }
  | { kind: 'puente'; id: string; places: Places; abbreviation: string }
  | { kind: 'nota'; id: string; places: Places; note: PrototypeNote }
  | { kind: 'palabra'; id: string; places: Places; original: string; article: string; keyTerm: boolean }
  | {
      kind: 'lexico'
      id: string
      places: Places
      /** The word of the original, by its place, and its verse: what its grammar, referents and sentence are read by. */
      place: number
      verse: number
      lemma: string
      code: string
      brief: string
      /** The senses the lexicon gives for this verse (all, when it gives none for it); then the others. */
      here: LexiconSense[]
      other: LexiconSense[]
      byVerse: boolean
    }

/** The words of a bridge text that translate any of these words of the original. */
function wordsTranslating(text: PrototypeText, originals: Set<number>): number[] {
  const out: number[] = []
  text.toOriginal?.forEach((places, word) => places.some((p) => originals.has(p)) && out.push(word))
  return out
}

/** The words of the original a touched word stands for: itself, in the original; else those it is aligned to. */
export function originalsOfWord(data: PrototypeData, abbreviation: string, place: number): number[] {
  const text = data.texts.find((x) => x.abbreviation === abbreviation)
  return text?.original ? [place] : text?.toOriginal?.[place] ?? []
}

/** Where some words of the original stand in every text: themselves, and the bridge words aligned to them. */
export function placesOfOriginals(data: PrototypeData, originals: number[]): Places {
  const set = new Set(originals)
  return Object.fromEntries(data.texts.map((x) => [x.abbreviation, x.original ? [...set].sort((a, b) => a - b) : wordsTranslating(x, set)]))
}

/**
 * The words of every text that the glossary has an entry for: the original's whose Strong number an entry holds, and
 * the bridge words aligned to them. Marked in the texts, so the person sees what the team already decided.
 */
export function glossedPlaces(data: PrototypeData, glossary: GlossaryEntry[]): Record<string, Set<number>> {
  const original = data.texts.find((x) => x.original)
  const strongs = new Set(glossary.flatMap((e) => e.strong.split(';').map((s) => s.split(':').pop() ?? '')).filter(Boolean))
  if (!original?.words || !strongs.size) return {}
  const originals = original.words.map((w, i) => (strongs.has(w.strong.split(':').pop() ?? '') ? i : -1)).filter((i) => i >= 0)
  return Object.fromEntries(Object.entries(placesOfOriginals(data, originals)).map(([abbr, places]) => [abbr, new Set(places)]))
}

/**
 * The words of every text a help is about in particular: the key terms (God, sin, grace…; not every name or word
 * linked) and the notes on three words or fewer. Marked lightly, so the person sees where touching a word brings
 * something on it. A note on a whole clause would mark most of the text (78 % of Jonah 1), telling nothing: it is
 * still found by touching any of its words.
 */
const SHORT_NOTE = 3
export function helpedPlaces(data: PrototypeData): Record<string, Set<number>> {
  const out: Record<string, Set<number>> = {}
  const mark = (places: PrototypeData['verses'][number]['notes'][number]['places'], short: boolean) => {
    for (const [abbr, at] of Object.entries(places)) if (at?.length && (!short || at.length <= SHORT_NOTE)) for (const p of at) (out[abbr] ??= new Set()).add(p)
  }
  for (const v of data.verses) {
    for (const w of v.words) if (w.keyTerm) mark(w.places, false)
    for (const n of v.notes) mark(n.places, true)
  }
  return out
}

/**
 * The glossary's entries about a touched word: the team's decision on how to translate the original word it stands
 * for, whichever text it was touched in.
 */
function glossaryOf(data: PrototypeData, abbreviation: string, place: number, glossary: GlossaryEntry[]): WordHelp[] {
  const original = data.texts.find((x) => x.original)
  const originals = originalsOfWord(data, abbreviation, place)
  if (!original?.words || !originals.length || !glossary.length) return []
  return entriesAbout(glossary, originals.map((p) => original.words![p]?.strong ?? '')).map((entry) => {
    // The entry's words, for an expression all of them, near the touched one.
    const strongs = new Set(entry.strong.split(';').map((s) => s.split(':').pop()))
    const near = original.words!.map((_, i) => i).filter((i) => strongs.has(original.words![i].strong.split(':').pop()) && Math.abs(i - originals[0]) < 12)
    return { kind: 'glosario' as const, id: `glosario-${entry.id}`, places: placesOfOriginals(data, near.length ? near : originals), entry }
  })
}

/**
 * What the other bridge texts say for a touched word: for each, its words aligned to the same original words. The
 * places light the words in every text, the touched one's too (all its words aligned there, not only the touched).
 */
function otherBridges(data: PrototypeData, abbreviation: string, place: number): WordHelp[] {
  const text = data.texts.find((x) => x.abbreviation === abbreviation)
  const original = data.texts.find((x) => x.original)
  if (!text || !original) return []
  const originals = new Set(originalsOfWord(data, abbreviation, place))
  if (!originals.size) return []
  const own = text.original ? [...originals] : wordsTranslating(text, originals)
  return data.texts
    .filter((x) => !x.original && x !== text)
    .map((other): WordHelp | null => {
      const words = wordsTranslating(other, originals)
      if (!words.length) return null
      const places: Places = { [other.abbreviation]: words, [original.abbreviation]: [...originals].sort((a, b) => a - b), [abbreviation]: own }
      return { kind: 'puente', id: `puente-${other.abbreviation}`, places, abbreviation: other.abbreviation }
    })
    .filter((h): h is WordHelp => h !== null)
}

/**
 * The helps of a touched word: the team's glossary first, then what the other bridge texts say, then the notes and
 * word links whose words in `abbreviation` include it, in the order of the verses.
 */
/**
 * What the lexicon says of the words of the original a touched word stands for, the sense of this verse first: last
 * among its helps, for whoever wants to go to the root of a word.
 */
function lexiconOfWord(data: PrototypeData, abbreviation: string, place: number, verse: number): WordHelp[] {
  const original = data.texts.find((x) => x.original)
  if (!original?.words) return []
  const out: WordHelp[] = []
  for (const p of originalsOfWord(data, abbreviation, place)) {
    const word = original.words[p]
    const found = word && lexiconOf(word.strong)
    if (!found) continue
    const code = strongCode(found)
    if (out.some((h) => h.id === `lexico-${code}`)) continue
    const senses = sensesOfWord(found.file, { book: data.book.id.toUpperCase(), chapter: data.chapter, verse }, found.letter)
    out.push({
      kind: 'lexico',
      id: `lexico-${code}`,
      places: placesOfOriginals(data, [p]),
      place: p,
      verse,
      lemma: senses.entries[0]?.lemma || word.lemma,
      code,
      brief: found.file.brief,
      ...senses,
    })
  }
  return out
}

/**
 * The notes the original gives on the words a touched word stands for: first among its helps, for they say what the
 * text itself reads. The Hebrew writes «Q» before a qere and «Or perhaps» before another reading.
 */
function readingsOfWord(data: PrototypeData, abbreviation: string, place: number): WordHelp[] {
  const original = data.texts.find((x) => x.original)
  if (!original?.wordNotes) return []
  return originalsOfWord(data, abbreviation, place).flatMap((p): WordHelp[] => {
    const note = original.wordNotes?.[p]
    if (!note) return []
    const qere = note.match(/^Q\s+(.+)$/)
    const perhaps = note.match(/^or perhaps\s+(.+)$/i)
    const [reading, text] = qere ? (['qere', qere[1]] as const) : perhaps ? (['perhaps', perhaps[1]] as const) : (['note', note] as const)
    return [{ kind: 'lectura', id: `lectura-${p}`, places: placesOfOriginals(data, [p]), reading, text }]
  })
}

export function helpsOfWord(data: PrototypeData, abbreviation: string, place: number, glossary: GlossaryEntry[] = [], verse?: number): WordHelp[] {
  const out: WordHelp[] = [...readingsOfWord(data, abbreviation, place), ...glossaryOf(data, abbreviation, place, glossary), ...otherBridges(data, abbreviation, place)]
  // What is about the word touched comes first: its key words, then its notes, each from the narrowest (the word
  // alone) to the widest (a phrase or clause holding it): «Jehová» before «la palabra de Jehová», a note on «Jehová»
  // before one on «the word of Jehová came». A stable sort: helps as wide keep the resources' order.
  const narrowest = (x: WordHelp, y: WordHelp) => (x.places[abbreviation]?.length ?? 0) - (y.places[abbreviation]?.length ?? 0)
  const seen = new Set<string>()
  const words: WordHelp[] = []
  for (const verse of data.verses) {
    for (const word of verse.words) {
      if (seen.has(word.id) || !word.places[abbreviation]?.includes(place)) continue
      seen.add(word.id)
      words.push({ kind: 'palabra', id: word.id, places: word.places, original: word.original, article: word.article, keyTerm: word.keyTerm })
    }
  }
  out.push(...words.sort(narrowest))
  const notes: WordHelp[] = []
  for (const verse of data.verses) {
    for (const note of verse.notes) {
      if (seen.has(note.id) || !note.places[abbreviation]?.includes(place)) continue
      seen.add(note.id)
      notes.push({ kind: 'nota', id: note.id, places: note.places, note })
    }
  }
  out.push(...notes.sort(narrowest))
  if (verse !== undefined) out.push(...lexiconOfWord(data, abbreviation, place, verse))
  return out
}


/** A word touched in a text, and which of its helps read one at a time is open (an index into `pagedHelps`). */
export interface Touched {
  abbreviation: string
  verse: number
  place: number
  helps: WordHelp[]
  index: number
}

/**
 * The words lit in a text, and the word touched there: the touched word is marked apart from the words a help lights,
 * so the person still sees which word they touched while the helps light other words around it.
 */
export type Lit = Set<number> & { touched?: { verse: number; place: number } }

/** The words a touched word's card lights in a text (`wordCard.litOf`). */
export function litPlaces(touched: Touched | null, abbreviation: string): Set<number> {
  if (!touched) return new Set()
  return litOf(touched.helps, touched.index, touched, abbreviation)
}

/**
 * A line's pieces in groups that do not break: a word keeps its punctuation (`mí.`, `¿Qué?`) and words bound by a
 * maqaf stay together. A word is a button, and a line could otherwise break between it and its full stop.
 */
function groups(pieces: WordLine['pieces'], word: (place: number, text: string, key: string) => ReactNode): ReactNode[] {
  const out: ReactNode[] = []
  let group: ReactNode[] = []
  const close = () => {
    if (group.length) out.push(<span key={`g${out.length}`} className="word-group">{group}</span>)
    group = []
  }
  pieces.forEach((piece, i) => {
    if (piece.word !== undefined) return void group.push(word(piece.word, piece.text, `w${i}`))
    piece.text.split(/(\s+)/).forEach((part, j) => {
      if (!part) return
      if (/^\s+$/.test(part)) {
        close()
        out.push(<span key={`s${i}-${j}`}>{part}</span>)
      } else group.push(<span key={`t${i}-${j}`}>{part}</span>)
    })
  })
  close()
  return out
}

/**
 * The word button last pressed: the card that opens for it keeps it where it stood on screen. Taken once, by the
 * touch that follows the press.
 */
let pressed: HTMLElement | null = null
function takePressed(): HTMLElement | null {
  const el = pressed
  pressed = null
  return el
}

export function WordLines({
  lines,
  verse,
  lit,
  onWord,
  writing,
  glossed,
  helped,
  numbered = true,
  tabbable = true,
  noted,
}: {
  lines: WordLine[]
  verse: number
  lit: Lit
  onWord(place: number): void
  /** Its verse number before the first line; not where the number has a column of its own (texts side by side). */
  numbered?: boolean
  /** Whether Tab stops at each word: not between the boxes of rows where the team writes (the words are a click away). */
  tabbable?: boolean
  /** Words the glossary has an entry for: marked, so a decision is seen before it is asked for. */
  glossed?: Set<number>
  /** Words a note or a key word is about (`helpedPlaces`): marked lightly, the glossary's mark over it. */
  helped?: Set<number>
  /** Words the text gives a note on (the Hebrew's ketiv, read by its qere): marked with «°», as Hebrew Bibles do. */
  noted?: Set<number>
  /** The line that the line being written translates, to stand out from the rest of the verse. */
  writing?: number
}) {
  const touched = lit.touched?.verse === verse ? lit.touched.place : undefined
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={i === writing ? 'usfm-line is-writing-line' : 'usfm-line'} data-marker={line.marker}>
          {i === 0 && numbered && <span className="verse-number">{verse} </span>}
          {groups(line.pieces, (place, text, key) => (
            <button
              key={key}
              type="button"
              tabIndex={tabbable ? undefined : -1}
              className={`word${lit.has(place) ? ' is-lit' : ''}${place === touched ? ' is-touched' : ''}${glossed?.has(place) ? ' has-gloss' : helped?.has(place) ? ' has-help' : ''}`}
              aria-expanded={place === touched ? true : undefined}
              onClick={(e) => {
                pressed = e.currentTarget
                onWord(place)
              }}
            >
              {text}
              {noted?.has(place) && (
                <span className="word-noted" aria-hidden="true">
                  °
                </span>
              )}
            </button>
          ))}
        </p>
      ))}
    </>
  )
}

/** A sense of a word as the lexicon gives it: its glosses first (the words to say it with), then what it means. */
function LexiconSenseText({ sense }: { sense: LexiconSense }) {
  return (
    <div className="lexicon-sense">
      {sense.glosses?.length ? <p className="lexicon-glosses">{sense.glosses.join(', ')}</p> : null}
      {sense.definition && <p className="lexicon-definition">{sense.definition.replace(/^=\s*/, '')}</p>}
    </div>
  )
}

/** The text a word has in a text: its surface at a place. */
export function wordAt(text: PrototypeText, place: number): string {
  for (const lines of Object.values(text.lines)) for (const line of lines) for (const piece of line.pieces) if (piece.word === place) return piece.text
  return ''
}

/** The words of a text at these places, in reading order, with «…» where words are left out between them. */
export function wordsOf(text: PrototypeText, places: number[] | undefined): string {
  if (!places?.length) return ''
  const sorted = [...places].sort((a, b) => a - b)
  return sorted.map((p, i) => (i > 0 && p > sorted[i - 1] + 1 ? `… ${wordAt(text, p)}` : wordAt(text, p))).join(' ')
}

/** Words of a text, set apart in their own direction and letters: Hebrew starts its line beside a label, not at the far edge. */
function Scripture({ text, children, className = 'word-help-scripture' }: { text: PrototypeText | undefined; children: ReactNode; className?: string }) {
  return (
    <bdi className={className} lang={text?.lang} dir={text?.dir}>
      {children}
    </bdi>
  )
}

/**
 * The card of a touched word, under its verse, in one shape for every kind of word (principle 10): first what the
 * word is (in the original, its sense here; in the other texts; the team's decision), which stays while the person
 * moves through the helps; then the helps, one at a time (principle 4), the only part that changes; last, folded,
 * more about the word of the original for whoever wants to go to its root.
 */
export function WordHelpCard({
  data,
  touched,
  onIndex,
  onClose,
  onNote,
  onGlossary,
  cardRef,
}: {
  data: PrototypeData
  touched: Touched
  onIndex(index: number): void
  onClose(): void
  /** For a mini app where the person writes notes (the study): take the touched word into the note. */
  onNote?(word: string): void
  /** For a mini app where the person decides how words are translated (the editor): add or change its entry. */
  onGlossary?(): void
  /** The card's box, for whoever keeps the pane in place around it. */
  cardRef?(box: HTMLElement | null): void
}) {
  const t = useT()
  const [article, setArticle] = useState<{ title: string; markdown: string } | null>(null)
  const [diagram, setDiagram] = useState<{ verse: number; place: number } | null>(null)
  const text = data.texts.find((x) => x.abbreviation === touched.abbreviation)!
  const original = data.texts.find((x) => x.original)
  const word = wordAt(text, touched.place)
  const paged = pagedHelps(touched.helps)
  const index = Math.min(touched.index, Math.max(0, paged.length - 1))
  const help = paged[index]
  const decided = touched.helps.filter((h): h is Extract<WordHelp, { kind: 'glosario' }> => h.kind === 'glosario')
  const bridges = touched.helps.filter((h): h is Extract<WordHelp, { kind: 'puente' }> => h.kind === 'puente')
  const lexicons = touched.helps.filter((h): h is Extract<WordHelp, { kind: 'lexico' }> => h.kind === 'lexico')
  const originals = originalsOfWord(data, touched.abbreviation, touched.place)
  const gloss = lexicons
    .map((l) => shortGloss(l.here[0], l.brief))
    .filter(Boolean)
    .join(' · ')

  // Moving to another help changes only what is under the arrows, so nothing moves: the arrows stay under the finger
  // and the words lit stay where they were. Only when reading the last help left its start above the pane does the
  // next one come back to its first line.
  const pagedHead = useRef<HTMLDivElement>(null)
  const refocus = useRef<'previous' | 'next' | null>(null)
  const shownHelp = useRef(`${touched.abbreviation}|${touched.place}|${index}`)
  useLayoutEffect(() => {
    const key = `${touched.abbreviation}|${touched.place}|${index}`
    const sameWord = shownHelp.current.startsWith(`${touched.abbreviation}|${touched.place}|`)
    if (shownHelp.current === key || !sameWord) {
      shownHelp.current = key
      return
    }
    shownHelp.current = key
    const head = pagedHead.current
    const pane = head?.closest<HTMLElement>('.pane')
    if (head && pane) {
      const view = paneView(pane)
      const top = head.getBoundingClientRect().top
      if (top < view.top) pane.scrollTop -= view.top - top + 8
    }
    // An arrow used up to its end is no longer a place for the focus: it goes to the other arrow, so whoever goes by
    // the keyboard keeps their place in the card (principle 13).
    const used = refocus.current
    refocus.current = null
    if (used && head) {
      const arrows = head.querySelectorAll<HTMLButtonElement>('.pager-arrow')
      const [previous, next] = [arrows[0], arrows[arrows.length - 1]]
      const there = used === 'next' ? next : previous
      if (there?.disabled) (used === 'next' ? previous : next)?.focus()
    }
  }, [touched.abbreviation, touched.place, index])

  const go = (to: number, used: 'previous' | 'next') => {
    refocus.current = used
    onIndex(to)
  }

  const labelOf = (h: WordHelp): string =>
    h.kind === 'lectura'
      ? t(h.reading === 'qere' ? 'ayudas.seLee' : h.reading === 'perhaps' ? 'ayudas.otraLectura' : 'ayudas.notaDelTexto')
      : h.kind === 'nota'
        ? t('ayudas.nota')
        : h.kind === 'palabra' && h.keyTerm
          ? t('ayudas.palabraClave')
          : t('ayudas.palabraTraduccion')

  // The helps read one at a time, by kind, as tabs over them («Palabra clave», «Notas 4»): what there is is seen before
  // going through it, and a kind is a touch away. The count under the arrows is within the kind.
  const groupOf = (h: WordHelp) => (h.kind === 'nota' ? 'nota' : h.kind === 'palabra' ? 'palabra' : 'lectura')
  const groups = paged.reduce<Array<{ kind: string; from: number; items: WordHelp[] }>>((out, h, i) => {
    const last = out[out.length - 1]
    if (last?.kind === groupOf(h)) last.items.push(h)
    else out.push({ kind: groupOf(h), from: i, items: [h] })
    return out
  }, [])
  const groupAt = help ? groups.find((g) => index >= g.from && index < g.from + g.items.length) : undefined
  const groupLabel = (g: (typeof groups)[number]) =>
    g.items.length === 1 ? labelOf(g.items[0]) : t(g.kind === 'nota' ? 'ayudas.notasN' : g.kind === 'palabra' ? 'ayudas.palabrasN' : 'ayudas.lecturasN', { n: g.items.length })

  // On a phone the card is slid sideways to the next help or the one before, as a page; the arrows stay, for a
  // computer and whoever prefers them. The slide is the card's, not the panes' around it.
  const slide = useRef<{ id: number; x: number; y: number; dx: number; horizontal: boolean | null } | null>(null)
  const slid = useRef(false)
  const slider = paged.length > 1 && {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return
      e.stopPropagation()
      slide.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, horizontal: null }
      slid.current = false
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = slide.current
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (s.horizontal === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) s.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
      if (s.horizontal) s.dx = dx
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = slide.current
      slide.current = null
      if (!s || s.id !== e.pointerId || !s.horizontal || Math.abs(s.dx) < 50) return
      slid.current = true
      if (s.dx < 0 && index < paged.length - 1) go(index + 1, 'next')
      else if (s.dx > 0 && index > 0) go(index - 1, 'previous')
    },
    onPointerCancel: () => (slide.current = null),
    onClickCapture: (e: React.MouseEvent) => {
      if (!slid.current) return
      slid.current = false
      e.stopPropagation()
      e.preventDefault()
    },
  }

  const teamNotes = decided.filter((d) => d.entry.note || d.entry.by)
  const teamNotesShown = (
    <>
      {teamNotes.map((d) => (
        <p key={d.id} className="word-help-team-note">
          {d.entry.note}
          {d.entry.note && d.entry.by ? ' — ' : ''}
          {d.entry.by && <span className="quiet">{t('ayudas.glosarioDe', { nombre: d.entry.by })}</span>}
        </p>
      ))}
    </>
  )

  return (
    <aside
      ref={cardRef}
      className="word-help"
      aria-label={t('ayudas.dePalabra', { palabra: word })}
      onKeyDown={(e) => {
        // Esc closes the card from inside it, as it closes a sheet (principle 13).
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="word-help-head">
        <p className="word-help-word">
          <Scripture text={text}>{word}</Scripture>
        </p>
        <button type="button" className="button-quiet word-help-close" onClick={onClose}>
          {t('ayudas.cerrar')}
        </button>
      </div>

      {/* The word's original and its gloss are said in «More on …» below; here only for a word without it. The card
          keeps short above what is read in it, so its verse stays in sight. */}
      {lexicons.length === 0 && (gloss || (!text.original && original && originals.length > 0)) && (
        <p className="word-help-original">
          {!text.original && original && originals.length > 0 && <Scripture text={original}>{wordsOf(original, originals)}</Scripture>}
          {gloss && <span className="word-help-gloss">{gloss}</span>}
        </p>
      )}

      {/* The other bridge text's words; beside them, while the team has decided nothing for the word, the way to. */}
      {(bridges.length > 0 || (!decided.length && onGlossary)) && (
        <div className="word-help-line">
          {bridges.length > 0 && (
            <dl className="word-help-texts">
              {bridges.map((b) => {
                const other = data.texts.find((x) => x.abbreviation === b.abbreviation)!
                return (
                  <div key={b.id}>
                    <dt>{b.abbreviation}</dt>
                    <dd>
                      <Scripture text={other}>{wordsOf(other, b.places[b.abbreviation])}</Scripture>
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
          {!decided.length && onGlossary && (
            <button type="button" className="chip" onClick={onGlossary}>
              + {t('ayudas.alGlosario')}
            </button>
          )}
        </div>
      )}

      {(decided.length > 0 || (lexicons.length === 0 && teamNotes.length > 0) || onNote) && (
        <div className="word-help-part word-help-team">
          {decided.map((d, i) => (
            <div key={d.id}>
              <p className="word-help-label">
                {t('ayudas.glosarioDelEquipo')}
                <span className="badge">{t(d.entry.status === 'agreed' ? 'ayudas.acordada' : 'ayudas.propuesta')}</span>
              </p>
              <div className="word-help-decided">
                <p className="word-help-rendering">{d.entry.rendering || t('ayudas.sinTraduccion')}</p>
                {i === 0 && onGlossary && (
                  <button type="button" className="chip" onClick={onGlossary}>
                    ✎ {t('ayudas.cambiar')}
                  </button>
                )}
              </div>
              {(d.entry.alternatives.length > 0 || d.entry.avoid.length > 0) && (
                <p className="word-help-soft">
                  {[
                    d.entry.alternatives.length ? t('ayudas.tambien', { formas: d.entry.alternatives.join(', ') }) : '',
                    d.entry.avoid.length ? t('ayudas.seEvita', { formas: d.entry.avoid.join(', ') }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          ))}
          {/* With no word of the original to say more about, what the team noted is said here. */}
          {lexicons.length === 0 && teamNotesShown}
          {onNote && (
            <div className="chip-row">
              <button type="button" className="chip" onClick={() => onNote(word)}>
                + {t('ayudas.anotarPalabra')}
              </button>
            </div>
          )}
        </div>
      )}

      {help && (
        <section className="word-help-part word-help-paged" aria-label={labelOf(help)} {...(slider || {})}>
          <div className="word-help-paged-head" ref={pagedHead}>
            {groups.length > 1 ? (
              <div className="word-help-kinds" role="tablist" aria-label={t('ayudas.dePalabra', { palabra: word })}>
                {groups.map((g) => (
                  <button key={g.from} type="button" role="tab" aria-selected={g === groupAt} className="helps-tab" onClick={() => g !== groupAt && go(g.from, g.from > index ? 'next' : 'previous')}>
                    {groupLabel(g)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="word-help-label">{groupAt && groupAt.items.length > 1 ? groupLabel(groupAt) : labelOf(help)}</p>
            )}
            {paged.length > 1 && (
              <div className="helps-steps word-help-steps">
                <button type="button" className="pager-arrow" aria-label={t('ayudas.anterior')} title={t('ayudas.anterior')} disabled={index === 0} onClick={() => go(index - 1, 'previous')}>
                  ‹
                </button>
                <span className="quiet">{groupAt && groupAt.items.length > 1 ? t('ayudas.cuenta', { i: index - groupAt.from + 1, n: groupAt.items.length }) : ' '}</span>
                <button type="button" className="pager-arrow" aria-label={t('ayudas.siguiente')} title={t('ayudas.siguiente')} disabled={index === paged.length - 1} onClick={() => go(index + 1, 'next')}>
                  ›
                </button>
              </div>
            )}
          </div>

          {help.kind === 'lectura' && (
            <>
              {help.reading === 'note' ? (
                // The text's own note, in English as it has it.
                <p className="study-other-text" lang="en">
                  {help.text}
                </p>
              ) : (
                <p className="help-reading">
                  <Scripture text={original}>{help.text}</Scripture>
                </p>
              )}
              {help.reading === 'qere' && <p className="word-help-soft">{t('ayudas.seLeeAyuda')}</p>}
            </>
          )}

          {/* A note or a key word says which words of the text being read it is about: the original is at the card's
              head already, and is said again only for a quote this text does not have. */}
          {help.kind === 'nota' && (
            <>
              {help.places[touched.abbreviation]?.length ? (
                <p className="word-help-quote">
                  <Scripture text={text}>{wordsOf(text, help.places[touched.abbreviation])}</Scripture>
                </p>
              ) : (
                original &&
                help.note.quote.trim() && (
                  <p className="word-help-quote-original">
                    <Scripture text={original}>{help.note.quote}</Scripture>
                  </p>
                )
              )}
              <Markdown text={help.note.note} />
              {help.note.academy && data.academy[help.note.academy] && (
                <button type="button" className="word-help-read" onClick={() => setArticle(data.academy[help.note.academy!])}>
                  {t('ayudas.leerArticuloDe', { titulo: data.academy[help.note.academy].title })} ›
                </button>
              )}
            </>
          )}

          {help.kind === 'palabra' &&
            (() => {
              // An article's title names the word and its kin («apóstol, apostolado»): the word names the link.
              const [name] = (data.words[help.article]?.title ?? help.article).split(/,\s*/)
              const here = help.places[touched.abbreviation]
              return (
                <>
                  <p className="word-help-quote">{here?.length ? <Scripture text={text}>{wordsOf(text, here)}</Scripture> : name}</p>
                  {/* Its article, said with its name and kept to the item, not a row like «More on …» under it. */}
                  {data.words[help.article] && (
                    <button type="button" className="word-help-read" onClick={() => setArticle(data.words[help.article])}>
                      {t('ayudas.leerSobre', { palabra: name })} ›
                    </button>
                  )}
                </>
              )
            })()}
        </section>
      )}

      {!help && lexicons.length === 0 && bridges.length === 0 && decided.length === 0 && <p className="quiet">{t('ayudas.nadaEnPalabra')}</p>}

      {lexicons.map((l, i) => (
        <details key={l.id} className="word-help-more">
          <summary>
            <span>
              {/* The lemma in its own letters, wherever the language puts it in the sentence. */}
              {t('ayudas.masSobre', { palabra: ' ' })
                .split(' ')
                .flatMap((part, j) => (j === 0 ? [part] : [<Scripture key={j} text={original}>{l.lemma}</Scripture>, part]))}
            </span>
          </summary>
          {i === 0 && teamNotes.length > 0 && (
            <div className="word-help-more-part">
              <p className="word-help-label">{t('ayudas.glosarioDelEquipo')}</p>
              {teamNotesShown}
            </div>
          )}
          <div className="word-help-more-part">
            {l.byVerse && <p className="word-help-label">{t('ayudas.enEsteVersiculo')}</p>}
            {l.here.map((s, j) => (
              <LexiconSenseText key={j} sense={s} />
            ))}
          </div>
          <Referents data={data} verse={l.verse} place={l.place} credit={false} />
          <OriginalFacts data={data} place={l.place} />
          {l.other.length > 0 && (
            <details className="word-help-other">
              <summary>{t('ayudas.otrosSentidos', { n: l.other.length })}</summary>
              {l.other.map((s, j) => (
                <LexiconSenseText key={j} sense={s} />
              ))}
            </details>
          )}
          <RowButton label={t('st.open')} onClick={() => setDiagram({ verse: l.verse, place: l.place })} />
          <p className="quiet lexicon-credit">
            {t('ayudas.lexicoCredito')}
            {hasReferents(data, l.verse, l.place) && ` ${t('lx.refCredit')}`}
          </p>
        </details>
      ))}

      {article && (
        <Sheet title={article.title} onClose={() => setArticle(null)}>
          <Markdown text={article.markdown} skipFirstHeading />
        </Sheet>
      )}
      {diagram && <SentenceDiagram data={data} verse={diagram.verse} place={diagram.place} onClose={() => setDiagram(null)} />}
    </aside>
  )
}

/** The part of a pane in sight: under the names that stay over the columns of texts side by side. */
function paneView(pane: HTMLElement): { top: number; bottom: number } {
  const box = pane.getBoundingClientRect()
  const head = pane.querySelector<HTMLElement>('.side-row.is-head')
  const covered = head ? Math.max(0, head.getBoundingClientRect().bottom - box.top) : 0
  return { top: box.top + covered, bottom: box.bottom }
}

/** A word to add to the glossary: the original words it stands for, and the word as the person touched it. */
export interface GlossaryTarget {
  originals: number[]
  word: string
  abbreviation: string
  verse: number
}

/**
 * Words to touch in the texts of a mini app (the editor, the study): which word is touched and its help, the words
 * lit in every text, and the card under the touched word's verse. Everything starts again when `resetKey` changes
 * (another verse or section). The helps are worked out as the card is drawn, so an entry just added to the glossary
 * shows at once.
 *
 * Without a touched word, the note being read in the helps lights its words while the person has them open
 * (`helpsShown`): lit words nobody asked for, in a text read before the helps or after they were folded, only puzzle.
 *
 * The pane does not move under the person's finger. A word touched stays where it was on screen, also when a card
 * above it goes away; its card is brought into sight only as far as the word stays in sight, so the words it lights
 * are seen while it is read. Closed, the word stays where it is; when reading the card took it out of sight, it comes
 * back to where it was when touched. The focus goes back to the word only when it was in the card: in the editor the
 * box being written keeps it, and the keyboard stays up.
 */
export function useWordHelps({
  data,
  resetKey,
  marked,
  bridge,
  verses,
  onNote,
  glossary = [],
  onGlossary,
}: {
  data: PrototypeData
  resetKey: string
  /** The bridge-text words of the note open in the helps pane (the frame's `marked`). */
  marked: string | null
  /** The bridge text `marked` is in. */
  bridge: string
  /** The verses whose notes `marked` may come from. */
  verses: number[]
  /** Offered on each card, for a mini app where the person writes notes. */
  onNote?(word: string): void
  /** The project's glossary: its entries come first among a word's helps. */
  glossary?: GlossaryEntry[]
  /** Offered on each card, for a mini app where the person decides how words are translated (the editor). */
  onGlossary?(target: GlossaryTarget): void
}) {
  const [at, setAt] = useState<Omit<Touched, 'helps'> | null>(null)
  const [helpsRead, setHelpsRead] = useState(false)
  const [key, setKey] = useState(resetKey)
  /** The word to keep in place through the next drawing, at its top on screen; and whether it takes the focus back. */
  const anchor = useRef<{ el: HTMLElement; y: number; focus: boolean } | null>(null)
  /** The word whose card is open, and its top on screen when it was touched. */
  const opened = useRef<{ el: HTMLElement; y: number } | null>(null)
  const cardBox = useRef<HTMLElement | null>(null)
  if (key !== resetKey) {
    setKey(resetKey)
    setAt(null)
    setHelpsRead(false)
    anchor.current = null
  }
  const touched: Touched | null = at ? { ...at, helps: helpsOfWord(data, at.abbreviation, at.place, glossary, at.verse) } : null
  const openNote =
    marked && helpsRead
      ? data.verses
          .filter((v) => verses.includes(v.verse))
          .flatMap((v) => v.notes)
          .find((n) => (bridge === 'TPS' ? n.gst : n.glt) === marked)
      : undefined

  const close = () => {
    const word = opened.current
    const pane = word?.el.closest<HTMLElement>('.pane')
    if (word && pane && word.el.isConnected) {
      const seen = inSight(word.el.getBoundingClientRect(), paneView(pane))
      const inCard = Boolean(cardBox.current?.contains(document.activeElement))
      anchor.current = { el: word.el, y: seen ? word.el.getBoundingClientRect().top : word.y, focus: inCard }
    }
    setAt(null)
  }

  const shown = at ? `${at.abbreviation}|${at.verse}|${at.place}` : ''
  useLayoutEffect(() => {
    const word = anchor.current
    anchor.current = null
    const pane = word?.el.closest<HTMLElement>('.pane')
    if (!word || !pane || !word.el.isConnected) {
      if (!shown) opened.current = null
      return
    }
    pane.scrollTop = keepPlace(pane.scrollTop, word.y, word.el.getBoundingClientRect().top)
    if (!shown) {
      opened.current = null
      if (word.focus) word.el.focus({ preventScroll: true })
      return
    }
    opened.current = { el: word.el, y: word.y }
    const box = cardBox.current
    if (!box) return
    const view = paneView(pane)
    const until = (box.querySelector('.word-help-paged-head') ?? box).getBoundingClientRect().bottom
    pane.scrollTop += revealBelow({ paneTop: view.top, paneBottom: view.bottom, wordTop: word.el.getBoundingClientRect().top, until })
  }, [shown])

  return {
    lit: (abbreviation: string): Lit =>
      Object.assign(touched ? litPlaces(touched, abbreviation) : new Set(openNote?.places[abbreviation] ?? []), {
        touched: touched && touched.abbreviation === abbreviation ? { verse: touched.verse, place: touched.place } : undefined,
      }),
    touch: (abbreviation: string, verse: number, place: number) => {
      const el = takePressed()
      if (at && at.abbreviation === abbreviation && at.place === place) return close()
      anchor.current = el ? { el, y: el.getBoundingClientRect().top, focus: false } : null
      setAt({ abbreviation, verse, place, index: 0 })
    },
    card: (abbreviation: string, verse: number) =>
      touched && touched.abbreviation === abbreviation && touched.verse === verse ? (
        <WordHelpCard
          data={data}
          touched={touched}
          onIndex={(index) => setAt({ ...touched, index })}
          onClose={close}
          onNote={onNote}
          cardRef={(box) => (cardBox.current = box)}
          onGlossary={
            onGlossary &&
            (() =>
              onGlossary({
                originals: originalsOfWord(data, touched.abbreviation, touched.place),
                word: wordAt(data.texts.find((x) => x.abbreviation === touched.abbreviation)!, touched.place),
                abbreviation: touched.abbreviation,
                verse: touched.verse,
              }))
          }
        />
      ) : null,
    helpsShown: (on: boolean) => setHelpsRead(on),
  }
}
