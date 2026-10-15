/**
 * The helps of the open verse, one at a time, right under it (philosophy, principle 4). The same panel for every mini
 * app: a mini app only says whether it wants it. Each tab says how many there are («Notas 3»); the note being read
 * marks its words in the verse.
 */

import { useEffect, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import { Markdown } from './Markdown'
import { Sheet } from './Sheet'

type Tab = 'notas' | 'preguntas' | 'palabras'

export function HelpsPanel({
  data,
  verse,
  textAbbreviation,
  onMark,
}: {
  data: PrototypeData
  verse: number
  textAbbreviation: string
  onMark(words: string | null): void
}) {
  const t = useT()
  const helps = data.verses.find((v) => v.verse === verse)
  const notes = helps?.notes ?? []
  const questions = helps?.questions ?? []
  const words = helps?.words ?? []
  const [tab, setTab] = useState<Tab>('notas')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(false)
  const [article, setArticle] = useState<{ title: string; markdown: string } | null>(null)

  useEffect(() => {
    setIndex(0)
    setAnswer(false)
  }, [verse, tab])

  const count = tab === 'notas' ? notes.length : tab === 'preguntas' ? questions.length : words.length
  const note = tab === 'notas' ? notes[index] : undefined
  const marked = note ? (textAbbreviation === 'TPS' ? note.gst : note.glt) : null
  useEffect(() => onMark(marked), [marked, onMark])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'notas', label: t('ayudas.notas', { n: notes.length }) },
    { id: 'preguntas', label: t('ayudas.preguntas', { n: questions.length }) },
    { id: 'palabras', label: t('ayudas.palabras', { n: words.length }) },
  ]

  return (
    <section className="helps" aria-label={tabs.map((x) => x.label).join(', ')}>
      <div className="helps-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className="helps-tab" onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="helps-card" role="tabpanel">
        {count === 0 && (
          <p className="quiet">
            {t(tab === 'notas' ? 'ayudas.sinNotas' : tab === 'preguntas' ? 'ayudas.sinPreguntas' : 'ayudas.sinPalabras')}
          </p>
        )}

        {note && (
          <>
            {marked ? <p className="help-quote">{marked}</p> : <p className="quiet">{t('ayudas.noAlineada', { texto: textAbbreviation })}</p>}
            <p className="help-original" lang="grc">
              {t('ayudas.enElOriginal', { texto: note.quote })}
            </p>
            <Markdown text={note.note} />
            {note.academy && data.academy[note.academy] && (
              <button type="button" className="button-link" onClick={() => setArticle(data.academy[note.academy!])}>
                {t('ayudas.leerArticulo', { titulo: data.academy[note.academy].title })}
              </button>
            )}
          </>
        )}

        {tab === 'preguntas' && questions[index] && (
          <>
            <p className="help-question">{questions[index].question}</p>
            {answer ? (
              <p>{questions[index].response}</p>
            ) : (
              <button type="button" className="button-quiet" onClick={() => setAnswer(true)}>
                {t('ayudas.verRespuesta')}
              </button>
            )}
          </>
        )}

        {tab === 'palabras' && words[index] && (
          <>
            <p className="help-quote">{data.words[words[index].article]?.title ?? words[index].article}</p>
            <p className="help-original" lang="grc">
              {t('ayudas.enElOriginal', { texto: words[index].original })}
              {words[index].keyTerm && <span className="badge">{t('ayudas.palabraClave')}</span>}
            </p>
            {data.words[words[index].article] && (
              <button type="button" className="button-link" onClick={() => setArticle(data.words[words[index].article])}>
                {t('ayudas.leerArticulo', { titulo: data.words[words[index].article].title })}
              </button>
            )}
          </>
        )}

        {count > 1 && (
          <div className="helps-steps">
            <button type="button" className="button-quiet" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              ‹ {t('ayudas.anterior')}
            </button>
            <span className="quiet">{t('ayudas.cuenta', { i: index + 1, n: count })}</span>
            <button type="button" className="button-quiet" disabled={index === count - 1} onClick={() => setIndex((i) => i + 1)}>
              {t('ayudas.siguiente')} ›
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
