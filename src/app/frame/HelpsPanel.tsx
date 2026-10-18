/**
 * The helps of the open verse, one at a time, right under it (philosophy, principle 4). The same panel for every mini
 * app: a mini app only says whether it wants it. Each tab says how many there are («Notas 3»); the note being read
 * marks its words in the verse.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import { entriesAbout, type GlossaryEntry } from '../projects/glossary'
import { studyNotesAbout } from '../projects/work'
import { RowButton } from './Actions'
import { Markdown } from './Markdown'
import { rangeOf } from './PlacePicker'
import { showInPane } from './Panes'
import { Sheet } from './Sheet'

type Tab = 'glosario' | 'notas' | 'preguntas' | 'palabras' | 'comentarios'

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
  const notes = once(of.map((v) => ({ verse: v.verse, items: v.notes })))
  const questions = once(of.map((v) => ({ verse: v.verse, items: v.questions })))
  const words = once(of.map((v) => ({ verse: v.verse, items: v.words })))
  const several = shown.length > 1
  const studyNotes = comments ? studyNotesAbout(data.book.id, data.chapter, shown) : []
  // The team's decisions on the words of these verses, in the order the words come.
  const decided = (() => {
    const original = data.texts.find((x) => x.original)
    if (!glossary?.length || !original?.words) return []
    const places = shown.flatMap((v) => (original.lines[v] ?? []).flatMap((l) => l.pieces.map((p) => p.word).filter((w): w is number => w !== undefined)))
    const out: GlossaryEntry[] = []
    for (const p of places) for (const e of entriesAbout(glossary, [original.words[p]?.strong ?? ''])) if (!out.includes(e)) out.push(e)
    return out
  })()
  const [tab, setTab] = useState<Tab>('notas')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(false)
  const [article, setArticle] = useState<{ title: string; markdown: string } | null>(null)

  useEffect(() => {
    setIndex(0)
    setAnswer(false)
  }, [shown.join(','), tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const countOf = (id: Tab) =>
    id === 'glosario'
      ? decided.length
      : id === 'notas'
        ? notes.length
        : id === 'preguntas'
          ? questions.length
          : id === 'palabras'
            ? words.length
            : studyNotes.length
  const count = countOf(tab)
  // A verse opens on a tab with something in it: another verse may have no notes but questions, or no decisions
  // (its glossary tab gone). A tab the person chose stays while it has something.
  const order: Tab[] = ['glosario', 'notas', 'preguntas', 'palabras', 'comentarios']
  const firstFull = order.find((id) => countOf(id) > 0) ?? 'notas'
  useEffect(() => {
    if (countOf(tab) === 0 && firstFull !== tab) setTab(firstFull)
  }, [shown.join(','), firstFull]) // eslint-disable-line react-hooks/exhaustive-deps
  const note = tab === 'notas' ? notes[index] : undefined
  // In a section, which verse the help shown is on.
  const current = tab === 'notas' ? notes[index] : tab === 'preguntas' ? questions[index] : tab === 'palabras' ? words[index] : undefined
  const marked = note ? (textAbbreviation === 'TPS' ? note.gst : note.glt) : null
  useEffect(() => onMark(marked), [marked, onMark])
  // In a pane, the next help starts at its first line, wherever the last one left the scroll.
  const self = useRef<HTMLElement>(null)
  useLayoutEffect(() => showInPane(self.current), [index, tab])

  const tabs: Array<{ id: Tab; label: string }> = [
    // What the team decided comes first, when it decided anything about these verses.
    ...(decided.length ? [{ id: 'glosario' as const, label: t('ayudas.glosarioN', { n: decided.length }) }] : []),
    { id: 'notas', label: t('ayudas.notas', { n: notes.length }) },
    { id: 'preguntas', label: t('ayudas.preguntas', { n: questions.length }) },
    { id: 'palabras', label: t('ayudas.palabras', { n: words.length }) },
    // What the team noted while studying these verses: there only when someone did.
    ...(studyNotes.length ? [{ id: 'comentarios' as const, label: t('ayudas.comentarios', { n: studyNotes.length }) }] : []),
  ]

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
        {count === 0 && (
          <p className="quiet">
            {t(tab === 'notas' ? 'ayudas.sinNotas' : tab === 'preguntas' ? 'ayudas.sinPreguntas' : 'ayudas.sinPalabras')}
          </p>
        )}

        {note && (
          <>
            {marked ? <p className="help-quote">{marked}</p> : <p className="quiet">{t('ayudas.noAlineada', { texto: textAbbreviation })}</p>}
            <p className="help-original">
              {t('ayudas.enElOriginalSolo')}{' '}
              <span lang={original?.lang} dir={original?.dir}>
                {note.quote}
              </span>
            </p>
            <Markdown text={note.note} />
            {note.academy && data.academy[note.academy] && (
              <RowButton label={t('ayudas.leerArticulo', { titulo: data.academy[note.academy].title })} onClick={() => setArticle(data.academy[note.academy!])} />
            )}
          </>
        )}

        {tab === 'glosario' && decided[index] && (
          <>
            <p className="help-quote help-bridge">{decided[index].rendering}</p>
            <p className="help-original" lang={original?.lang} dir={original?.dir}>
              {decided[index].lemma}
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
            <p className="help-verse">{t('ayudas.comentarioDe', { versiculos: rangeOf(studyNotes[index].verses), nombre: studyNotes[index].by })}</p>
            <p className="study-other-text">{studyNotes[index].text}</p>
          </>
        )}

        {tab === 'preguntas' && questions[index] && (
          <>
            <p className="help-question">{questions[index].question}</p>
            {answer ? (
              <p>{questions[index].response}</p>
            ) : (
              <RowButton kind="fold" label={t('ayudas.verRespuesta')} expanded={false} onClick={() => setAnswer(true)} />
            )}
          </>
        )}

        {tab === 'palabras' && words[index] && (
          <>
            <p className="help-quote">{data.words[words[index].article]?.title ?? words[index].article}</p>
            <p className="help-original">
              {t('ayudas.enElOriginalSolo')}{' '}
              <span lang={original?.lang} dir={original?.dir}>
                {words[index].original}
              </span>
              {words[index].keyTerm && <span className="badge">{t('ayudas.palabraClave')}</span>}
            </p>
            {data.words[words[index].article] && (
              <RowButton label={t('ayudas.leerArticulo', { titulo: data.words[words[index].article].title })} onClick={() => setArticle(data.words[words[index].article])} />
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

      {article && (
        <Sheet title={article.title} onClose={() => setArticle(null)}>
          <Markdown text={article.markdown} skipFirstHeading />
        </Sheet>
      )}
    </section>
  )
}
