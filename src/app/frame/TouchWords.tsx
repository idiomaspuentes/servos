/**
 * Touching a word of a text (a bridge text or the original) brings the notes and the translation words that are about
 * it, one at a time, right under its verse (philosophy, principle 4). A help knows its words in every text through the
 * alignment (`PrototypeNote.places`), so a Hebrew word finds the notes of its Spanish words, and the help being read
 * lights its words in every pane.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Places, PrototypeData, PrototypeNote, PrototypeText } from '../../prototype/data'
import type { WordLine } from '../../resources/reading'
import { useT } from '../i18n/i18n'
import { Markdown } from './Markdown'
import { Sheet } from './Sheet'

export type WordHelp =
  | { kind: 'nota'; id: string; places: Places; note: PrototypeNote }
  | { kind: 'palabra'; id: string; places: Places; original: string; article: string; keyTerm: boolean }

/** The notes and word links whose words in `abbreviation` include the word at `place`, in the order of the verses. */
export function helpsOfWord(data: PrototypeData, abbreviation: string, place: number): WordHelp[] {
  const out: WordHelp[] = []
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
}: {
  lines: WordLine[]
  verse: number
  lit: Set<number>
  onWord(place: number): void
}) {
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className="usfm-line" data-marker={line.marker}>
          {i === 0 && <span className="verse-number">{verse} </span>}
          {groups(line.pieces, (place, text, key) => (
            <button key={key} type="button" className={lit.has(place) ? 'word is-lit' : 'word'} onClick={() => onWord(place)}>
              {text}
            </button>
          ))}
        </p>
      ))}
    </>
  )
}

/** The text a word has in a text: its surface at a place. */
export function wordAt(text: PrototypeText, place: number): string {
  for (const lines of Object.values(text.lines)) for (const line of lines) for (const piece of line.pieces) if (piece.word === place) return piece.text
  return ''
}

/** The words of a help in a text, in order, with «…» where other words lie between. */
function wordsOf(text: PrototypeText, places: number[] | undefined): string {
  if (!places?.length) return ''
  const sorted = [...places].sort((a, b) => a - b)
  return sorted.map((p, i) => (i > 0 && p > sorted[i - 1] + 1 ? `… ${wordAt(text, p)}` : wordAt(text, p))).join(' ')
}

export function WordHelpCard({
  data,
  touched,
  onIndex,
  onClose,
}: {
  data: PrototypeData
  touched: Touched
  onIndex(index: number): void
  onClose(): void
}) {
  const t = useT()
  const [article, setArticle] = useState<{ title: string; markdown: string } | null>(null)
  const text = data.texts.find((x) => x.abbreviation === touched.abbreviation)!
  const original = data.texts.find((x) => x.original)
  const help = touched.helps[touched.index]
  const count = touched.helps.length
  const word = wordAt(text, touched.place)

  // Brought into sight in what scrolls around it (a pane, or the text above the box being written in), never by
  // scrolling the page: under the keyboard there is little room, and the card would open out of sight.
  const self = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const card = self.current
    const around = card?.parentElement?.closest<HTMLElement>('.edit-source-scroll, .pane')
    if (!card || !around) return
    const c = around.getBoundingClientRect()
    const r = card.getBoundingClientRect()
    if (r.bottom > c.bottom) around.scrollTop += Math.min(r.top - c.top - 8, r.bottom - c.bottom + 8)
  }, [touched.place, touched.index])

  return (
    <aside ref={self} className="word-help" aria-label={t('ayudas.dePalabra', { palabra: word })}>
      <div className="word-help-head">
        <span className="word-help-word" dir={text.dir} lang={text.lang}>
          {word}
        </span>
        {count > 1 && <span className="quiet">{t('ayudas.cuenta', { i: touched.index + 1, n: count })}</span>}
        <button type="button" className="button-quiet word-help-close" aria-label={t('ayudas.cerrar')} onClick={onClose}>
          ×
        </button>
      </div>

      {!help && <p className="quiet">{t('ayudas.nadaEnPalabra')}</p>}

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
            <button type="button" className="button-link" onClick={() => setArticle(data.academy[help.note.academy!])}>
              {t('ayudas.leerArticulo', { titulo: data.academy[help.note.academy].title })}
            </button>
          )}
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
            <button type="button" className="button-link" onClick={() => setArticle(data.words[help.article])}>
              {t('ayudas.leerArticulo', { titulo: data.words[help.article].title })}
            </button>
          )}
        </>
      )}

      {count > 1 && (
        <div className="helps-steps">
          <button type="button" className="button-quiet" disabled={touched.index === 0} onClick={() => onIndex(touched.index - 1)}>
            ‹ {t('ayudas.anterior')}
          </button>
          <button type="button" className="button-quiet" disabled={touched.index === count - 1} onClick={() => onIndex(touched.index + 1)}>
            {t('ayudas.siguiente')} ›
          </button>
        </div>
      )}

      {article && (
        <Sheet title={article.title} onClose={() => setArticle(null)}>
          <Markdown text={article.markdown} skipFirstHeading />
        </Sheet>
      )}
    </aside>
  )
}
