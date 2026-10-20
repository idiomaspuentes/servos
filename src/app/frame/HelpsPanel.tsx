/**
 * The helps of the open verse that no word leads to, one at a time (philosophy, principle 4): what the team decided
 * for its words (glossary) and understood of it (the study's notes, the chapter's, the book's), the notes on the
 * whole verse, and the comprehension questions, read here to check the translation against. Notes on words and key
 * words are what touching a word brings, beside its text, and are not listed again; but a note a newer pack changed
 * stays, with its label, since the verse's row says to read it here. Only the tabs with something are shown, each
 * saying how many («Glosario 2»).
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import { entriesAbout, type GlossaryEntry } from '../projects/glossary'
import { changedVerses, changesVersion, subscribeChanges } from '../projects/helpsChanges'
import { BOOK_NOTE_CHAPTER, introNoteOn, studyNotesAbout } from '../projects/work'
import { RowButton } from './Actions'
import { Markdown } from './Markdown'
import { rangeOf } from './PlacePicker'
import { showInPane } from './Panes'
import { ArticleSheet, articleIn, type OpenArticle } from './ArticleSheet'
import { placesOfOriginals, wordsOf } from './TouchWords'

type Tab = 'glosario' | 'comentarios' | 'notas' | 'preguntas'

/** Each help once, though it covers several of the verses shown (a note on 3–4 is in both), with its first verse. */
function once<T extends { id: string }>(lists: Array<{ verse: number; items: T[] }>): Array<T & { verse: number }> {
  const out: Array<T & { verse: number }> = []
  for (const { verse, items } of lists) for (const item of items) if (!out.some((x) => x.id === item.id)) out.push({ ...item, verse })
  return out
}

export function HelpsPanel({
  data,
  verse,
  verses,
  comments = false,
  glossary,
  textAbbreviation,
  onMark,
}: {
  data: PrototypeData
  verse: number
  /** The verses whose helps to show together (a section's); else the verse's. */
  verses?: number[]
  /** Whether the study's notes on these verses are a tab («Comments»), when there are any. */
  comments?: boolean
  /** The project's glossary: its entries about the words of these verses are a tab («Glossary»), when there are any. */
  glossary?: GlossaryEntry[]
  textAbbreviation: string
  onMark(words: string | null): void
}) {
  const t = useT()
  const original = data.texts.find((x) => x.original)
  const shown = verses?.length ? verses : [verse]
  const of = data.verses.filter((v) => shown.includes(v.verse))
  const questions = once(of.map((v) => ({ verse: v.verse, items: v.questions })))
  const several = shown.length > 1
  // The team's notes from the study: on these verses, then on the chapter's introduction and on the book's, which
  // hold for every verse of them (last, so the verse's own come first).
  const studyNotes = comments
    ? [
        ...studyNotesAbout(data.book.id, data.chapter, shown).map((n) => ({ ...n, about: t('ayudas.comentarioDe', { versiculos: rangeOf(n.verses), nombre: n.by }) })),
        ...[introNoteOn(data.book.id, data.chapter)].filter((n) => n !== null).map((n) => ({ ...n, about: t('ayudas.comentarioCapitulo', { capitulo: data.chapter, nombre: n.by }) })),
        ...[introNoteOn(data.book.id, BOOK_NOTE_CHAPTER)].filter((n) => n !== null).map((n) => ({ ...n, about: t('ayudas.comentarioLibro', { nombre: n.by }) })),
      ]
    : []
  // The team's decisions on the words of these verses, in the order the words come, each with the words of the text
  // being read that translate it here: a decision is about the original, but the person finds it in that text.
  const read = data.texts.find((x) => x.abbreviation === textAbbreviation)
  const decided = (() => {
    const original = data.texts.find((x) => x.original)
    if (!glossary?.length || !original?.words) return []
    const places = shown.flatMap((v) => (original.lines[v] ?? []).flatMap((l) => l.pieces.map((p) => p.word).filter((w): w is number => w !== undefined)))
    const out: Array<GlossaryEntry & { inText: string[] }> = []
    for (const p of places)
      for (const e of entriesAbout(glossary, [original.words[p]?.strong ?? ''])) {
        const words = read && !read.original ? wordsOf(read, placesOfOriginals(data, [p])[read.abbreviation]) : ''
        const found = out.find((x) => x.id === e.id)
        if (!found) out.push({ ...e, inText: words ? [words] : [] })
        else if (words && !found.inText.includes(words)) found.inText.push(words)
      }
    return out
  })()
  const [tab, setTab] = useState<Tab>('notas')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(false)
  const [article, setArticle] = useState<OpenArticle | null>(null)
  // What a newer pack changed in these verses, already translated (helpsChanges.ts): a changed note unfolds what it said.
  useSyncExternalStore(subscribeChanges, changesVersion)
  const changes = changedVerses(data.book.id, data.chapter).filter((c) => shown.includes(c.verse))
  const [before, setBefore] = useState(false)
  // The notes no word of the text being read leads to (on the whole verse, or whose words were not found in it), and
  // those a newer pack changed.
  const changed = new Set(changes.flatMap((c) => c.notes).filter((n) => n.kind !== 'quitada').map((n) => n.id))
  const notes = once(of.map((v) => ({ verse: v.verse, items: v.notes.filter((n) => !n.places[textAbbreviation]?.length || changed.has(n.id)) })))

  useEffect(() => {
    setIndex(0)
    setAnswer(false)
  }, [shown.join(','), tab])
  useEffect(() => setBefore(false), [index, tab, shown.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps

  const countOf = (id: Tab) => (id === 'glosario' ? decided.length : id === 'notas' ? notes.length : id === 'preguntas' ? questions.length : studyNotes.length)
  const count = countOf(tab)
  // A verse opens on a tab with something in it: another verse may have no notes but questions, or no decisions
  // (its glossary tab gone). A tab the person chose stays while it has something.
  const order: Tab[] = ['glosario', 'comentarios', 'notas', 'preguntas']
  const firstFull = order.find((id) => countOf(id) > 0) ?? 'notas'
  useEffect(() => {
    if (countOf(tab) === 0 && firstFull !== tab) setTab(firstFull)
  }, [shown.join(','), firstFull]) // eslint-disable-line react-hooks/exhaustive-deps
  const note = tab === 'notas' ? notes[index] : undefined
  // In a section, which verse the help shown is on.
  const current = tab === 'notas' ? notes[index] : tab === 'preguntas' ? questions[index] : undefined
  const marked = note ? (textAbbreviation === 'TPS' ? note.gst : note.glt) : null
  const noteChange = note ? changes.flatMap((c) => c.notes).find((n) => n.id === note.id && n.kind !== 'quitada') : undefined
  useEffect(() => onMark(marked), [marked, onMark])
  // In a pane, the next help starts at its first line, wherever the last one left the scroll.
  const self = useRef<HTMLElement>(null)
  useLayoutEffect(() => showInPane(self.current), [index, tab])

  // What the team decided and understood first; then what the verse says as a whole, and what to check it against.
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'glosario' as const, label: t('ayudas.glosarioN', { n: decided.length }) },
    { id: 'comentarios' as const, label: t('ayudas.comentarios', { n: studyNotes.length }) },
    { id: 'notas' as const, label: t('ayudas.sobreVersiculo', { n: notes.length }) },
    { id: 'preguntas' as const, label: t('ayudas.paraComprobar', { n: questions.length }) },
  ].filter((x) => countOf(x.id) > 0)

  return (
    <section ref={self} className="helps" aria-label={tabs.map((x) => x.label).join(', ')}>
      <div className="helps-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className="helps-tab" data-empty={countOf(x.id) === 0 || undefined} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="helps-card" role="tabpanel">
        {several && current && <p className="help-verse">{t('ayudas.versiculo', { v: current.verse })}</p>}
        {tabs.length === 0 && <p className="quiet">{t('ayudas.nadaMas')}</p>}

        {note && (
          <>
            {noteChange && <span className="badge badge-changed help-changed">{t(`cambios.etiqueta.${noteChange.kind}`)}</span>}
            {/* A note on the whole verse quotes no words; one whose words this text does not have says them in the original. */}
            {marked && <p className="help-quote">{marked}</p>}
            {note.quote.trim() && (
              <p className="help-original">
                {t('ayudas.enElOriginalSolo')}{' '}
                <span lang={original?.lang} dir={original?.dir}>
                  {note.quote}
                </span>
              </p>
            )}
            <Markdown text={note.note} />
            {noteChange?.kind === 'cambiada' && (
              <>
                <RowButton kind="fold" label={t('cambios.loQueDecia')} expanded={before} onClick={() => setBefore((b) => !b)} />
                {before && (
                  <div className="helps-changed-before">
                    <Markdown text={noteChange.before ?? ''} />
                  </div>
                )}
              </>
            )}
            {note.academy && data.academy[note.academy] && (
              <RowButton label={t('ayudas.leerArticulo', { titulo: data.academy[note.academy].title })} onClick={() => setArticle(articleIn(data, { kind: 'ta', path: note.academy! }))} />
            )}
          </>
        )}

        {tab === 'glosario' && decided[index] && (
          <>
            {/* What the decision is about, as in a note: the words of the text being read, then the original's. */}
            {decided[index].inText.length > 0 && (
              <p className="help-quote" lang={read?.lang} dir={read?.dir}>
                {decided[index].inText.join(' · ')}
              </p>
            )}
            <p className="help-original">
              {t('ayudas.enElOriginalSolo')}{' '}
              <span lang={original?.lang} dir={original?.dir}>
                {decided[index].lemma}
              </span>
            </p>
            <p className="help-decision">
              {t('ayudas.elEquipoTraduce')} <strong>{decided[index].rendering}</strong>
            </p>
            {decided[index].alternatives.length > 0 && <p className="quiet">{t('ayudas.tambien', { formas: decided[index].alternatives.join(', ') })}</p>}
            {decided[index].note && <p className="study-other-text">{decided[index].note}</p>}
            <p className="quiet">
              {t(decided[index].status === 'agreed' ? 'ayudas.acordada' : 'ayudas.propuesta')}
              {decided[index].by && ` · ${t('ayudas.glosarioDe', { nombre: decided[index].by })}`}
            </p>
          </>
        )}

        {tab === 'comentarios' && studyNotes[index] && (
          <>
            <p className="help-verse">{studyNotes[index].about}</p>
            <p className="study-other-text">{studyNotes[index].text}</p>
          </>
        )}

        {/* While translating, the comprehension questions check what was written: does it answer this? The answer
            expected, once the person has looked. */}
        {tab === 'preguntas' && questions[index] && (
          <>
            <p className="quiet">{t('ayudas.comprobarAyuda')}</p>
            <p className="help-question">{questions[index].question}</p>
            {answer ? (
              <p>{questions[index].response}</p>
            ) : (
              <RowButton kind="fold" label={t('ayudas.verRespuestaEsperada')} expanded={false} onClick={() => setAnswer(true)} />
            )}
          </>
        )}

        {count > 1 && (
          <div className="helps-steps">
            <button type="button" className="pager-arrow" aria-label={t('ayudas.anterior')} title={t('ayudas.anterior')} disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              ‹
            </button>
            <span className="quiet">{t('ayudas.cuenta', { i: index + 1, n: count })}</span>
            <button type="button" className="pager-arrow" aria-label={t('ayudas.siguiente')} title={t('ayudas.siguiente')} disabled={index === count - 1} onClick={() => setIndex((i) => i + 1)}>
              ›
            </button>
          </div>
        )}
      </div>

      {article && <ArticleSheet data={data} article={article} onClose={() => setArticle(null)} />}
    </section>
  )
}
