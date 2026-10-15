/**
 * Estudio: read the book before translating it. It begins with the book's introduction, then each chapter's, then
 * its sections (or verses, as the person chooses), the way translationCore 4's study goes.
 *
 * A section is read alone, its words to touch: a word brings its helps under its verse (the other bridge text's words,
 * the notes, the translation words), so there is no separate list of helps to go through. The texts and the team's
 * note on the section are panes side by side, the tabs at the foot on a phone; one button leads from reading to the
 * note (the keyboard up), and from the note to the next section. The note also offers the text's comprehension
 * questions, which no word leads to. On a wide screen the text stays on the left and the note on the right.
 */

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChapterLines } from '../../frame/ChapterLines'
import { Markdown } from '../../frame/Markdown'
import { Panes, useWide, type Pane } from '../../frame/Panes'
import { passageOf } from '../../frame/PlacePicker'
import { glossedPlaces, useWordHelps } from '../../frame/TouchWords'
import { readGlossary } from '../../projects/glossary'
import { studyNoteOn, studyNotesAbout, writeStudyNote } from '../../projects/work'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type MiniAppCenterProps } from '../contract'
import { StudyNotes, withLine } from './StudyNotes'

function Center({ context }: MiniAppCenterProps) {
  const { position, data, t, marked, textAbbreviation, frame, shown, person } = context
  const wide = useWide()
  const unitKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const read = () => studyNoteOn(position.book, position.chapter, shown)
  const [key, setKey] = useState(unitKey)
  const [note, setNote] = useState(() => ({ text: read()?.text ?? '', by: read()?.by ?? null }))
  const [pane, setPane] = useState('')
  const [open, setOpen] = useState<{ id: string } | undefined>(undefined)
  if (key !== unitKey) {
    setKey(unitKey)
    setNote({ text: read()?.text ?? '', by: read()?.by ?? null })
    // Each section starts at its reading.
    setOpen({ id: data.texts.find((x) => x.abbreviation === textAbbreviation)?.abbreviation ?? data.texts[0].abbreviation })
  }
  const box = useRef<HTMLTextAreaElement>(null)
  const write = (text: string) => {
    writeStudyNote(position.book, position.chapter, shown, text, person.name)
    setNote({ text, by: text.trim() ? person.name : null })
  }
  // To the note, the keyboard up: at once, so the box takes the focus while the touch lasts (a phone opens its
  // keyboard only then).
  const toNote = (text?: string) => {
    flushSync(() => {
      if (text !== undefined) write(text)
      setOpen({ id: 'nota' })
    })
    const el = box.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }
  // A word that will be hard to translate goes into the note when it is found, on a line of its own.
  const noteWord = (word: string) => toNote(withLine(note.text, `«${word}»: `))
  // The glossary is looked up while studying too: how the team already decided to translate a word.
  const glossary = readGlossary(context.project.id)
  const glossed = glossedPlaces(data, glossary)
  const { lit, touch, card } = useWordHelps({
    data,
    resetKey: unitKey,
    marked,
    bridge: textAbbreviation,
    verses: shown,
    onNote: noteWord,
    glossary,
  })

  const intro = position.verse === BOOK_INTRO ? data.bookIntro : position.verse === CHAPTER_INTRO ? data.intro : undefined
  if (intro !== undefined) {
    // An introduction is read whole, across the screen: it is about the book or the chapter, not about words in it.
    return (
      <div className="study">
        <article className="study-intro" aria-label={t(position.verse === BOOK_INTRO ? 'marco.introLibro' : 'marco.introCapitulo')}>
          <Markdown text={intro} />
        </article>
        <button type="button" className="button-primary study-next" onClick={frame.next}>
          {t('estudio.seguir')}
        </button>
      </div>
    )
  }

  // Notes on a whole verse quote no words, so no word leads to them: they wait folded under their verse.
  const general = (verse: number, abbreviation: string) => {
    const notes = data.verses.find((v) => v.verse === verse)?.notes.filter((n) => !n.places[abbreviation]?.length) ?? []
    if (!notes.length) return null
    return (
      <details className="general-notes">
        <summary>{t('estudio.notasGenerales', { n: notes.length })}</summary>
        {notes.map((n) => (
          <Markdown key={n.id} text={n.note} />
        ))}
      </details>
    )
  }
  const hint = t('estudio.toquePalabra')
  const questions = data.verses.filter((v) => shown.includes(v.verse)).flatMap((v) => v.questions)
  const others = studyNotesAbout(position.book, position.chapter, shown).filter((n) => n.verses.join(',') !== shown.join(','))
  const panes: Pane[] = [
    ...data.texts.map(
      (x): Pane => ({
        id: x.abbreviation,
        label: x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation,
        content: (
          <ChapterLines
            text={x}
            shown={shown}
            at={shown[0]}
            line={null}
            only
            glossed={glossed[x.abbreviation]}
            lit={lit(x.abbreviation)}
            hint={hint}
            onWord={(verse, place) => touch(x.abbreviation, verse, place)}
            under={(verse) => (
              <>
                {card(x.abbreviation, verse)}
                {!x.original && general(verse, x.abbreviation)}
              </>
            )}
          />
        ),
      })
    ),
    {
      id: 'nota',
      label: t('estudio.miNota'),
      content: (
        <StudyNotes
          ref={box}
          passage={passageOf(data.book.name, position.chapter, shown, t)}
          verses={shown}
          text={note.text}
          by={note.by}
          others={others}
          questions={questions}
          onChange={write}
        />
      ),
    },
  ]

  // Writing the note (or, wide, beside it): the button goes on; reading: it leads to the note, unless there is one.
  const atNote = wide || pane === 'nota'
  const button =
    atNote || note.text.trim()
      ? { label: atNote ? 'estudio.guardarSeguir' : 'estudio.seguir', run: frame.next }
      : { label: 'estudio.escribirNota', run: () => toNote() }

  return (
    <div className="study">
      <Panes panes={panes} label={t('estudio.paneles')} fixed="nota" open={open} onPane={setPane} holdFocus={false} />
      <button type="button" className="button-primary study-next" onClick={button.run}>
        {t(button.label)}
      </button>
    </div>
  )
}

export const estudio: MiniApp = {
  id: 'estudio',
  needs: ['text', 'notes', 'questions', 'words', 'academy'],
  phase: 'estudio',
  // A passage is understood a section at a time, as translationCore 4's study goes.
  unit: 'section',
  sections: true,
  intros: true,
  // A verse is studied when the team left a note on it, or on a section holding it.
  done: (at) => studyNotesAbout(at.book, at.chapter, [at.verse]).length > 0,
  helps: false,
  fills: true,
  writes: false,
  Center,
  texts: {
    es: {
      nombre: 'Estudio',
      descripcion: 'Leer el libro con sus introducciones, notas, preguntas y palabras clave antes de traducir',
      seguir: 'Seguir leyendo',
      escribirNota: 'Escribir mi nota →',
      miNota: 'Mi nota',
      notasGenerales: 'Notas sobre todo el versículo ({n})',
      verRespuestas: 'Ver las respuestas',
      guardarSeguir: 'Guardar y seguir',
      toquePalabra: 'toque una palabra para ver sus notas',
      paneles: 'Lo que se lee',
      notaDe: 'Notas de comprensión · {pasaje}',
      preguntaSeccion: '¿Qué dice esta sección? ¿Quién habla, a quién, y qué será difícil de traducir?',
      preguntaVersiculo: '¿Qué significa este versículo y qué será difícil de traducir?',
      preguntaQueDice: '¿Qué dice?',
      preguntaQuienHabla: '¿Quién habla?',
      preguntaAQuien: '¿A quién?',
      preguntaDificil: '¿Qué será difícil?',
      notaGuardada: 'Guardada en este teléfono · la escribió {nombre}. Se verá al traducir estos versículos.',
      notaVacia: 'Todavía no hay nota. Lo que escriba se verá al traducir estos versículos.',
      otrasNotas: 'Otras notas sobre estos versículos',
      notaSobre: 'Versículos {versiculos} · {nombre}',
      'lengua.hbo': 'Hebreo',
      'lengua.grc': 'Griego',
      'lengua.original': 'Original',
    },
    pt: {
      nombre: 'Estudo',
      descripcion: 'Ler o livro com suas introduções, notas, perguntas e palavras-chave antes de traduzir',
      seguir: 'Continuar lendo',
      escribirNota: 'Escrever minha nota →',
      miNota: 'Minha nota',
      notasGenerales: 'Notas sobre todo o versículo ({n})',
      verRespuestas: 'Ver as respostas',
      guardarSeguir: 'Salvar e seguir',
      toquePalabra: 'toque uma palavra para ver suas notas',
      paneles: 'O que se lê',
      notaDe: 'Notas de compreensão · {pasaje}',
      preguntaSeccion: 'O que diz esta seção? Quem fala, a quem, e o que será difícil de traduzir?',
      preguntaVersiculo: 'O que significa este versículo e o que será difícil de traduzir?',
      preguntaQueDice: 'O que diz?',
      preguntaQuienHabla: 'Quem fala?',
      preguntaAQuien: 'A quem?',
      preguntaDificil: 'O que será difícil?',
      notaGuardada: 'Salva neste telefone · escrita por {nombre}. Será vista ao traduzir estes versículos.',
      notaVacia: 'Ainda não há nota. O que você escrever será visto ao traduzir estes versículos.',
      otrasNotas: 'Outras notas sobre estes versículos',
      notaSobre: 'Versículos {versiculos} · {nombre}',
      'lengua.hbo': 'Hebraico',
      'lengua.grc': 'Grego',
      'lengua.original': 'Original',
    },
    en: {
      nombre: 'Study',
      descripcion: 'Read the book with its introductions, notes, questions, and key words before translating',
      seguir: 'Keep reading',
      escribirNota: 'Write my note →',
      miNota: 'My note',
      notasGenerales: 'Notes on the whole verse ({n})',
      verRespuestas: 'See the answers',
      guardarSeguir: 'Save and continue',
      toquePalabra: 'touch a word to see its notes',
      paneles: 'What is read',
      notaDe: 'Comprehension notes · {pasaje}',
      preguntaSeccion: 'What does this section say? Who speaks, to whom, and what will be hard to translate?',
      preguntaVersiculo: 'What does this verse mean and what will be hard to translate?',
      preguntaQueDice: 'What does it say?',
      preguntaQuienHabla: 'Who speaks?',
      preguntaAQuien: 'To whom?',
      preguntaDificil: 'What will be hard?',
      notaGuardada: 'Saved on this phone · written by {nombre}. It will be seen when these verses are translated.',
      notaVacia: 'No note yet. What you write will be seen when these verses are translated.',
      otrasNotas: 'Other notes on these verses',
      notaSobre: 'Verses {versiculos} · {nombre}',
      'lengua.hbo': 'Hebrew',
      'lengua.grc': 'Greek',
      'lengua.original': 'Original',
    },
  },
}
