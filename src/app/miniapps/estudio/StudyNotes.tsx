/**
 * The team's note on the verse or section being studied: what it says, who speaks to whom, what will be hard to
 * translate. A pane of its own, so on a phone the box and the text read are never on screen together; the editor
 * shows it again under «Comments» while those verses are translated. Anyone may correct it; it says who wrote it last.
 * Notes written on other units over the same verses (the section's, while reading by verse) are shown under it.
 */

import { useState } from 'react'
import { useT } from '../../i18n/i18n'
import { rangeOf } from '../../frame/PlacePicker'
import { studyNoteOn, studyNotesAbout, writeStudyNote } from '../../projects/work'

export function StudyNotes({
  book,
  chapter,
  verses,
  bookName,
  person,
}: {
  book: string
  chapter: number
  verses: number[]
  bookName: string
  person: string
}) {
  const t = useT()
  const unitKey = `${book}.${chapter}.${verses.join(',')}`
  const [key, setKey] = useState(unitKey)
  const [text, setText] = useState(() => studyNoteOn(book, chapter, verses)?.text ?? '')
  const [by, setBy] = useState(() => studyNoteOn(book, chapter, verses)?.by ?? null)
  if (key !== unitKey) {
    setKey(unitKey)
    const note = studyNoteOn(book, chapter, verses)
    setText(note?.text ?? '')
    setBy(note?.by ?? null)
  }
  const others = studyNotesAbout(book, chapter, verses).filter((n) => n.verses.join(',') !== verses.join(','))

  return (
    <div className="study-notes">
      <label className="field">
        <span className="field-label">{t('estudio.notaDe', { pasaje: `${bookName} ${chapter}:${rangeOf(verses)}` })}</span>
        <textarea
          className="study-note-field"
          value={text}
          placeholder={t(verses.length > 1 ? 'estudio.preguntaSeccion' : 'estudio.preguntaVersiculo')}
          onChange={(e) => {
            setText(e.target.value)
            setBy(e.target.value.trim() ? person : null)
            writeStudyNote(book, chapter, verses, e.target.value, person)
          }}
        />
      </label>
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
}
