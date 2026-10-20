/**
 * What no word of a verse leads to, under it: its notes on the whole verse and its comprehension questions. Folded,
 * each is a small sign in the helps' colour, not a box across the page that reads as part of the verse; open, it is
 * a card like the one a touched word opens, so it reads as a help.
 */

import { Fragment, useState } from 'react'
import { Markdown } from '../../frame/Markdown'
import { useT } from '../../i18n/i18n'

export function VerseExtras({
  notes,
  questions,
}: {
  notes: Array<{ id: string; quote: string; note: string }>
  questions: Array<{ id: string; question: string; response: string }>
}) {
  const t = useT()
  const [open, setOpen] = useState<'notas' | 'preguntas' | null>(null)
  if (!notes.length && !questions.length) return null
  const label = {
    notas: notes.length === 1 ? t('estudio.notaVersiculo') : t('estudio.notasVersiculo', { n: notes.length }),
    preguntas: questions.length === 1 ? t('estudio.preguntaPensar') : t('estudio.preguntasPensar', { n: questions.length }),
  }
  const sign = (kind: 'notas' | 'preguntas', mark: string) => (
    <button
      type="button"
      className={`verse-extra${open === kind ? ' is-open' : ''}`}
      aria-expanded={open === kind}
      onClick={() => setOpen(open === kind ? null : kind)}
    >
      <span aria-hidden="true" className="verse-extra-mark">
        {mark}
      </span>
      {label[kind]}
    </button>
  )
  return (
    <div className="verse-extras">
      <div className="verse-extras-signs">
        {notes.length > 0 && sign('notas', '¶')}
        {questions.length > 0 && sign('preguntas', '?')}
      </div>
      {open && (
        <div className="word-help verse-extra-card">
          <div className="word-help-head">
            <p className="verse-extra-title">{label[open]}</p>
            <button type="button" className="button-quiet word-help-close" onClick={() => setOpen(null)}>
              {t('ayudas.cerrar')}
            </button>
          </div>
          {open === 'notas'
            ? notes.map((n) => (
                <Fragment key={n.id}>
                  {n.quote.trim() && <p className="general-quote">{n.quote}</p>}
                  <Markdown text={n.note} />
                </Fragment>
              ))
            : questions.map((q) => (
                <div key={q.id} className="general-question">
                  <p className="help-question">{q.question}</p>
                  <p>{q.response}</p>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}
