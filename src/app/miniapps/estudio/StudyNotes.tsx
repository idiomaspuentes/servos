/**
 * The team's note on the verse or section being studied: a free note, nothing to choose. The editor shows it again
 * under «Comments» while those verses are translated. Anyone may correct it; it says who wrote it last. Notes written
 * on other units over the same verses (the section's, while reading by verse) are shown under it.
 *
 * Buttons that started lines with questions confused the teams: the questions to think on are now only the box's
 * placeholder, and the book's comprehension questions are read with the other helps.
 */

import { forwardRef } from 'react'
import { rangeOf } from '../../frame/PlacePicker'
import { useT } from '../../i18n/i18n'
import type { StudyNote } from '../../projects/work'

/** The note with a line added at its end, after a blank line when it says something already. */
export const withLine = (text: string, line: string) => (text.trim() ? `${text.replace(/\s+$/, '')}\n${line}` : line)

export const StudyNotes = forwardRef<
  HTMLTextAreaElement,
  {
    passage: string
    text: string
    by: string | null
    others: StudyNote[]
    /** What the note is for, while nobody has written it (an introduction's is read across a chapter or the book). */
    about?: string
    /** The questions to think on, in the empty box. */
    hint?: string
    onChange(text: string): void
  }
>(function StudyNotes({ passage, text, by, others, about, hint, onChange }, box) {
  const t = useT()
  return (
    <div className="study-notes">
      <div className="study-note-head">
        <h3 className="study-note-title">{t('estudio.loQueEntendi', { pasaje: passage })}</h3>
        <p className="quiet">{by && `${t('estudio.notaGuardada', { nombre: by })} `}
          {about ?? t('estudio.paraQue')}</p>
      </div>
      <textarea
        ref={box}
        className="study-note-field"
        aria-label={t('estudio.loQueEntendi', { pasaje: passage })}
        value={text}
        placeholder={hint ?? t('estudio.pista')}
        onChange={(e) => onChange(e.target.value)}
      />
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
