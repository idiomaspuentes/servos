/**
 * The team's note on the verse or section being studied: what it says, who speaks to whom, what will be hard to
 * translate. The editor shows it again under «Comments» while those verses are translated. Anyone may correct it; it
 * says who wrote it last. Notes written on other units over the same verses (the section's, while reading by verse)
 * are shown under it.
 *
 * On a phone, starting a note from nothing is hard: short questions are offered to touch, each starting a line of the
 * note with the cursor after it, and the keyboard stays up between them.
 */

import { forwardRef } from 'react'
import { keepFocus } from '../../frame/Panes'
import { rangeOf } from '../../frame/PlacePicker'
import { useT } from '../../i18n/i18n'
import type { StudyNote } from '../../projects/work'

const PROMPTS = ['preguntaQueDice', 'preguntaQuienHabla', 'preguntaAQuien', 'preguntaDificil'] as const

/** The note with a line added at its end, after a blank line when it says something already. */
export const withLine = (text: string, line: string) => (text.trim() ? `${text.replace(/\s+$/, '')}\n${line}` : line)

export const StudyNotes = forwardRef<
  HTMLTextAreaElement,
  {
    passage: string
    verses: number[]
    text: string
    by: string | null
    others: StudyNote[]
    onChange(text: string): void
  }
>(function StudyNotes({ passage, verses, text, by, others, onChange }, box) {
  const t = useT()
  const field = typeof box === 'object' ? box : null

  const ask = (line: string) => {
    const next = withLine(text, `${line} `)
    onChange(next)
    // The cursor after the question, the keyboard up: the person answers right away. The focus now, while the touch
    // lasts (a phone opens its keyboard only then); the cursor once React has drawn the new text.
    field?.current?.focus()
    setTimeout(() => field?.current?.setSelectionRange(next.length, next.length), 0)
  }

  return (
    <div className="study-notes">
      <p className="field-label">{t('estudio.notaDe', { pasaje: passage })}</p>
      <div className="study-prompts" onPointerDown={keepFocus}>
        {PROMPTS.map((p) => (
          <button key={p} type="button" className="chip" onClick={() => ask(t(`estudio.${p}`))}>
            {t(`estudio.${p}`)}
          </button>
        ))}
      </div>
      <textarea
        ref={box}
        className="study-note-field"
        aria-label={t('estudio.notaDe', { pasaje: passage })}
        value={text}
        placeholder={t(verses.length > 1 ? 'estudio.preguntaSeccion' : 'estudio.preguntaVersiculo')}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="quiet study-note-by">{by ? t('estudio.notaGuardada', { nombre: by }) : t('estudio.notaVacia')}</p>
      {others.length > 0 && (
        <section className="study-other-notes" aria-label={t('estudio.otrasNotas')}>
          <h3>{t('estudio.otrasNotas')}</h3>
          {others.map((n) => (
            <div key={n.verses.join(',')} className="study-other-note">
              <p className="help-verse">{t('estudio.notaSobre', { versiculos: rangeOf(n.verses), nombre: n.by })}</p>
              <p className="study-other-text">{n.text}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
})
