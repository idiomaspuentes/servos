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
import { flushSync } from 'react-dom'
import type { Places, PrototypeData, PrototypeNote, PrototypeText } from '../../prototype/data'
import type { WordLine } from '../../resources/reading'
import { useT } from '../i18n/i18n'
import { entriesAbout, type GlossaryEntry } from '../projects/glossary'
import { lexiconOf } from '../../prototype/data'
import { sensesOfWord, strongCode, type LexiconSense } from '../../lexicon/lexicon'
import { Markdown } from './Markdown'
import { OriginalFacts, Referents } from './OriginalWord'
import { SentenceDiagram } from './SentenceDiagram'
import { showInPane } from './Panes'
import { Sheet } from './Sheet'

export type WordHelp =
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

export function helpsOfWord(data: PrototypeData, abbreviation: string, place: number, glossary: GlossaryEntry[] = [], verse?: number): WordHelp[] {
  const out: WordHelp[] = [...glossaryOf(data, abbreviation, place, glossary), ...otherBridges(data, abbreviation, place)]
  const seen = new Set<string>()
  for (const verse of data.verses) {
    for (const note of verse.notes) {
      if (seen.has(note.id) || !note.places[abbreviation]?.includes(place)) continue
      seen.add(note.id)
      out.push({ kind: 'nota', id: note.id, places: note.places, note })
    }
  }
  for (const verse of data.verses) {
    for (const word of verse.words) {
      if (seen.has(word.id) || !word.places[abbreviation]?.includes(place)) continue
      seen.add(word.id)
      out.push({ kind: 'palabra', id: word.id, places: word.places, original: word.original, article: word.article, keyTerm: word.keyTerm })
    }
  }
  if (verse !== undefined) out.push(...lexiconOfWord(data, abbreviation, place, verse))
  return out
}

/** A word touched in a text, and the help of it being read. */
export interface Touched {
  abbreviation: string
  verse: number
  place: number
  helps: WordHelp[]
  index: number
}

/** The words a touched help lights in a text: its places there, or the touched word alone when it has no help. */
export function litPlaces(touched: Touched | null, abbreviation: string): Set<number> {
  if (!touched) return new Set()
  const help = touched.helps[touched.index]
  if (help) return new Set(help.places[abbreviation] ?? [])
  return touched.abbreviation === abbreviation ? new Set([touched.place]) : new Set()
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

export function WordLines({
  lines,
  verse,
  lit,
  onWord,
  writing,
  glossed,
}: {
  lines: WordLine[]
  verse: number
  lit: Set<number>
  onWord(place: number): void
  /** Words the glossary has an entry for: marked, so a decision is seen before it is asked for. */
  glossed?: Set<number>
  /** The line that the line being written translates, to stand out from the rest of the verse. */
  writing?: number
}) {
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={i === writing ? 'usfm-line is-writing-line' : 'usfm-line'} data-marker={line.marker}>
          {i === 0 && <span className="verse-number">{verse} </span>}
          {groups(line.pieces, (place, text, key) => (
            <button
              key={key}
              type="button"
              className={`word${lit.has(place) ? ' is-lit' : ''}${glossed?.has(place) ? ' has-gloss' : ''}`}
              onClick={() => onWord(place)}
            >
              {text}
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

/** The words of a help in a text, in order, with «…» where other words lie between. */
/** The words of a text at these places, in reading order, with «…» where words are left out between them. */
export function wordsOf(text: PrototypeText, places: number[] | undefined): string {
  if (!places?.length) return ''
  const sorted = [...places].sort((a, b) => a - b)
  return sorted.map((p, i) => (i > 0 && p > sorted[i - 1] + 1 ? `… ${wordAt(text, p)}` : wordAt(text, p))).join(' ')
}

export function WordHelpCard({
  data,
  touched,
  onIndex,
  onClose,
  onNote,
  onGlossary,
}: {
  data: PrototypeData
  touched: Touched
  onIndex(index: number): void
  onClose(): void
  /** For a mini app where the person writes notes (the study): take the touched word into the note. */
  onNote?(word: string): void
  /** For a mini app where the person decides how words are translated (the editor): add or change its entry. */
  onGlossary?(): void
}) {
  const t = useT()
  const [article, setArticle] = useState<{ title: string; markdown: string } | null>(null)
  const [diagram, setDiagram] = useState<{ verse: number; place: number } | null>(null)
  const text = data.texts.find((x) => x.abbreviation === touched.abbreviation)!
  const original = data.texts.find((x) => x.original)
  const help = touched.helps[touched.index]
  const count = touched.helps.length
  const word = wordAt(text, touched.place)

  // Brought into sight in the pane that scrolls around it, never by scrolling the page: under the keyboard there is
  // little room, and the card would open out of sight.
  const self = useRef<HTMLElement>(null)
  // Where the pane was when the word was touched: closing the card goes back there, to the word, and not to wherever
  // reading a long help left the scroll. Read before the card is brought into sight, which moves it.
  const before = useRef<{ pane: HTMLElement; top: number } | null>(null)
  useLayoutEffect(() => {
    const pane = self.current?.parentElement?.closest<HTMLElement>('.pane')
    before.current = pane ? { pane, top: pane.scrollTop } : null
  }, [touched.place])
  useLayoutEffect(() => showInPane(self.current), [touched.place, touched.index])
  const close = () => {
    const back = before.current
    // The card leaves at once, so the pane is its old height again before it is scrolled back.
    flushSync(onClose)
    if (back) back.pane.scrollTop = back.top
  }

  return (
    <aside ref={self} className="word-help" aria-label={t('ayudas.dePalabra', { palabra: word })}>
      <div className="word-help-head">
        <span className="word-help-word" dir={text.dir} lang={text.lang}>
          {word}
        </span>
        {count > 1 && <span className="quiet">{t('ayudas.cuenta', { i: touched.index + 1, n: count })}</span>}
        <button type="button" className="button-quiet word-help-close" onClick={close}>
          {t('ayudas.cerrar')}
        </button>
      </div>

      {!help && <p className="quiet">{t('ayudas.nadaEnPalabra')}</p>}

      {help?.kind === 'glosario' && (
        <>
          <p className="word-help-kind">
            {t('ayudas.glosario')}
            <span className="badge">{t(help.entry.status === 'agreed' ? 'ayudas.acordada' : 'ayudas.propuesta')}</span>
          </p>
          <p className="help-quote help-bridge">{help.entry.rendering || t('ayudas.sinTraduccion')}</p>
          {help.entry.alternatives.length > 0 && <p className="quiet">{t('ayudas.tambien', { formas: help.entry.alternatives.join(', ') })}</p>}
          {help.entry.avoid.length > 0 && <p className="quiet">{t('ayudas.seEvita', { formas: help.entry.avoid.join(', ') })}</p>}
          {original && (
            <p className="help-original" dir={original.dir} lang={original.lang}>
              {help.entry.lemma}
            </p>
          )}
          {help.entry.note && <p className="study-other-text">{help.entry.note}</p>}
          {help.entry.by && <p className="quiet">{t('ayudas.glosarioDe', { nombre: help.entry.by })}</p>}
        </>
      )}

      {help?.kind === 'puente' && (
        <>
          <p className="word-help-kind">{t('ayudas.enOtroTexto', { texto: help.abbreviation })}</p>
          <p className="help-quote help-bridge">{wordsOf(data.texts.find((x) => x.abbreviation === help.abbreviation)!, help.places[help.abbreviation])}</p>
          {original && !text.original && (
            <p className="help-original" dir={original.dir} lang={original.lang}>
              {wordsOf(original, help.places[original.abbreviation])}
            </p>
          )}
        </>
      )}

      {help?.kind === 'nota' && (
        <>
          <p className="word-help-kind">{t('ayudas.nota')}</p>
          {help.places[touched.abbreviation]?.length ? (
            <p className="help-quote" dir={text.dir} lang={text.lang}>
              {wordsOf(text, help.places[touched.abbreviation])}
            </p>
          ) : null}
          {original && !text.original && (
            <p className="help-original" dir={original.dir} lang={original.lang}>
              {help.note.quote}
            </p>
          )}
          <Markdown text={help.note.note} />
          {help.note.academy && data.academy[help.note.academy] && (
            <RowButton label={t('ayudas.leerArticulo', { titulo: data.academy[help.note.academy].title })} onClick={() => setArticle(data.academy[help.note.academy!])} />
          )}
        </>
      )}

      {help?.kind === 'lexico' && (
        <>
          <p className="word-help-kind">{t('ayudas.lexico')}</p>
          <OriginalFacts data={data} place={help.place} />
          <Referents data={data} verse={help.verse} place={help.place} />
          <RowButton label={t('st.open')} onClick={() => setDiagram({ verse: help.verse, place: help.place })} />
          {help.brief && <p className="help-quote">{help.brief}</p>}
          {help.byVerse && <p className="help-verse">{t('ayudas.enEsteVersiculo')}</p>}
          {help.here.map((s, i) => (
            <LexiconSenseText key={i} sense={s} />
          ))}
          {help.other.length > 0 && (
            <details className="general-notes">
              <summary>{t('ayudas.otrosSentidos', { n: help.other.length })}</summary>
              {help.other.map((s, i) => (
                <LexiconSenseText key={i} sense={s} />
              ))}
            </details>
          )}
          <p className="quiet lexicon-credit">{t('ayudas.lexicoCredito')}</p>
        </>
      )}

      {help?.kind === 'palabra' && (
        <>
          <p className="word-help-kind">
            {t('ayudas.palabraTraduccion')}
            {help.keyTerm && <span className="badge">{t('ayudas.palabraClave')}</span>}
          </p>
          <p className="help-quote">{data.words[help.article]?.title ?? help.article}</p>
          {original && !text.original && (
            <p className="help-original" dir={original.dir} lang={original.lang}>
              {help.original}
            </p>
          )}
          {data.words[help.article] && (
            <RowButton label={t('ayudas.leerArticulo', { titulo: data.words[help.article].title })} onClick={() => setArticle(data.words[help.article])} />
          )}
        </>
      )}

      {(onNote || onGlossary) && (
        // What the person can do with the word touched: chips on the card that is about it.
        <div className="chip-row word-help-actions">
          {onNote && (
            <button type="button" className="chip" onClick={() => onNote(word)}>
              + {t('ayudas.anotarPalabra')}
            </button>
          )}
          {onGlossary && (
            <button type="button" className="chip" onClick={onGlossary}>
              {touched.helps.some((h) => h.kind === 'glosario') ? `✎ ${t('ayudas.cambiarGlosario')}` : `+ ${t('ayudas.agregarGlosario')}`}
            </button>
          )}
        </div>
      )}

      {count > 1 && (
        <div className="helps-steps">
          <button type="button" className="pager-arrow" aria-label={t('ayudas.anterior')} disabled={touched.index === 0} onClick={() => onIndex(touched.index - 1)}>
            ‹
          </button>
          <button type="button" className="pager-arrow" aria-label={t('ayudas.siguiente')} disabled={touched.index === count - 1} onClick={() => onIndex(touched.index + 1)}>
            ›
          </button>
        </div>
      )}

      {article && (
        <Sheet title={article.title} onClose={() => setArticle(null)}>
          <Markdown text={article.markdown} skipFirstHeading />
        </Sheet>
      )}
      {diagram && <SentenceDiagram data={data} verse={diagram.verse} place={diagram.place} onClose={() => setDiagram(null)} />}
    </aside>
  )
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
 * Without a touched word, the note being read in the helps pane lights its words, once the person has opened that
 * pane (`helpsOpened`): lit words nobody asked for, in a text read before the helps, only puzzle.
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
  if (key !== resetKey) {
    setKey(resetKey)
    setAt(null)
    setHelpsRead(false)
  }
  const touched: Touched | null = at ? { ...at, helps: helpsOfWord(data, at.abbreviation, at.place, glossary, at.verse) } : null
  const openNote =
    marked && helpsRead
      ? data.verses
          .filter((v) => verses.includes(v.verse))
          .flatMap((v) => v.notes)
          .find((n) => (bridge === 'TPS' ? n.gst : n.glt) === marked)
      : undefined
  return {
    lit: (abbreviation: string) => (touched ? litPlaces(touched, abbreviation) : new Set(openNote?.places[abbreviation] ?? [])),
    touch: (abbreviation: string, verse: number, place: number) =>
      setAt((now) => (now && now.abbreviation === abbreviation && now.place === place ? null : { abbreviation, verse, place, index: 0 })),
    card: (abbreviation: string, verse: number) =>
      touched && touched.abbreviation === abbreviation && touched.verse === verse ? (
        <WordHelpCard
          data={data}
          touched={touched}
          onIndex={(index) => setAt({ ...touched, index })}
          onClose={() => setAt(null)}
          onNote={onNote}
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
    helpsOpened: () => setHelpsRead(true),
  }
}
