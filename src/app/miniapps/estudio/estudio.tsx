/**
 * Estudio: read the book before translating it. It begins with the book's introduction, then each chapter's, then
 * the verses or sections (as the person chooses), the way translationCore 4's Understand step goes.
 *
 * Each verse or section is three short steps, one button leading from each to the next: read it alone (the TPS and
 * the original a swipe away; a word touched brings its helps under its verse), read its helps one at a time with
 * their words marked in it, and leave the team's note on it, which the editor shows again while those verses are
 * translated. The steps can be taken in any order from their marks above; a section that already has a note offers to
 * go on. On a wide screen the text stays on the left and the helps and the note share the right.
 */

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChapterLines } from '../../frame/ChapterLines'
import { Markdown } from '../../frame/Markdown'
import { Panes, useWide, type Pane } from '../../frame/Panes'
import { passageOf } from '../../frame/PlacePicker'
import { useWordHelps } from '../../frame/TouchWords'
import { studyNoteOn, studyNotesAbout, writeStudyNote } from '../../projects/work'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type MiniAppCenterProps } from '../contract'
import { StudyNotes, withLine } from './StudyNotes'

type Step = 'leer' | 'ayudas' | 'nota'

function Center({ context }: MiniAppCenterProps) {
  const { position, data, t, marked, textAbbreviation, frame, shown, person } = context
  const wide = useWide()
  const unitKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const read = () => studyNoteOn(position.book, position.chapter, shown)
  const [key, setKey] = useState(unitKey)
  const [step, setStep] = useState<Step>('leer')
  const [note, setNote] = useState(() => ({ text: read()?.text ?? '', by: read()?.by ?? null }))
  if (key !== unitKey) {
    setKey(unitKey)
    setStep('leer')
    setNote({ text: read()?.text ?? '', by: read()?.by ?? null })
  }
  const box = useRef<HTMLTextAreaElement>(null)
  const write = (text: string) => {
    writeStudyNote(position.book, position.chapter, shown, text, person.name)
    setNote({ text, by: text.trim() ? person.name : null })
  }
  // A word that will be hard to translate goes into the note when it is found: the note opens with it on a line.
  const noteWord = (word: string) => {
    const next = withLine(note.text, `«${word}»: `)
    // At once, so the box is there to take the focus while the touch lasts: a phone opens its keyboard only then.
    flushSync(() => {
      write(next)
      setStep('nota')
    })
    box.current?.focus()
    box.current?.setSelectionRange(next.length, next.length)
  }
  const { lit, touch, card, helpsOpened } = useWordHelps({
    data,
    resetKey: unitKey,
    marked,
    bridge: textAbbreviation,
    verses: shown,
    onNote: noteWord,
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

  const hint = t('estudio.toquePalabra')
  const textPane = (x: (typeof data.texts)[number]) => (
    <ChapterLines
      text={x}
      shown={shown}
      at={shown[0]}
      line={null}
      only
      lit={lit(x.abbreviation)}
      hint={hint}
      onWord={(verse, place) => touch(x.abbreviation, verse, place)}
      under={(verse) => card(x.abbreviation, verse)}
    />
  )
  const reading = (
    <Panes
      panes={data.texts.map(
        (x): Pane => ({ id: x.abbreviation, label: x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation, content: textPane(x) })
      )}
      label={t('estudio.paneles')}
    />
  )
  const bridge = data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts[0]
  // The helps with the section above them, so the words of the help being read are seen marked where they stand.
  const helps = (
    <div className="study-scroll">
      {!wide && <div className="study-helps-text">{textPane(bridge)}</div>}
      {frame.helps(shown, { comments: false })}
    </div>
  )
  const passage = passageOf(data.book.name, position.chapter, shown, t)
  const others = studyNotesAbout(position.book, position.chapter, shown).filter((n) => n.verses.join(',') !== shown.join(','))
  const notes = (
    <div className="study-scroll">
      <StudyNotes ref={box} passage={passage} verses={shown} text={note.text} by={note.by} others={others} onChange={write} />
    </div>
  )

  const go = (next: Step) => {
    // At once, so the box of the note is there to take the focus while the touch lasts: the keyboard comes up with
    // the step that is for writing.
    flushSync(() => setStep(next))
    if (next === 'ayudas') helpsOpened()
    if (next === 'nota') box.current?.focus()
  }
  const hasNote = Boolean(note.text.trim())
  // On a wide screen the text is always in sight: the steps are the helps and the note, beside it.
  const shownStep: Step = wide && step === 'leer' ? 'ayudas' : step
  const button =
    shownStep === 'nota'
      ? { label: 'estudio.guardarSeguir', run: frame.next }
      : hasNote
        ? { label: 'estudio.seguir', run: frame.next }
        : shownStep === 'leer'
          ? { label: 'estudio.verAyudas', run: () => go('ayudas') }
          : { label: 'estudio.escribirNota', run: () => go('nota') }
  const steps: Step[] = wide ? ['ayudas', 'nota'] : ['leer', 'ayudas', 'nota']

  const stepper = (
    <ol className="study-steps" aria-label={t('estudio.pasos')}>
      {steps.map((s, i) => (
        <li key={s}>
          <button type="button" className="study-step" aria-current={s === shownStep ? 'step' : undefined} onClick={() => go(s)}>
            <span className="study-step-n">{i + 1}</span> {t(`estudio.paso.${s}`)}
            {s === 'nota' && hasNote && <span className="study-step-done"> ✓</span>}
          </button>
        </li>
      ))}
    </ol>
  )
  const stepContent = shownStep === 'leer' ? reading : shownStep === 'ayudas' ? helps : notes
  const next = (
    <button type="button" className="button-primary study-next" onClick={button.run}>
      {t(button.label)}
    </button>
  )

  if (wide) {
    return (
      <div className="study study-wide">
        <div className="study-left">{reading}</div>
        <div className="study-right">
          {stepper}
          <div className="study-body">{stepContent}</div>
          {next}
        </div>
      </div>
    )
  }
  return (
    <div className="study">
      {stepper}
      <div className="study-body">{stepContent}</div>
      {next}
    </div>
  )
}

export const estudio: MiniApp = {
  id: 'estudio',
  needs: ['text', 'notes', 'questions', 'words', 'academy'],
  phase: 'estudio',
  unit: 'verse',
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
      verAyudas: 'Ver las ayudas →',
      escribirNota: 'Escribir mi nota →',
      guardarSeguir: 'Guardar y seguir',
      pasos: 'Pasos',
      'paso.leer': 'Leer',
      'paso.ayudas': 'Ayudas',
      'paso.nota': 'Mi nota',
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
      verAyudas: 'Ver as ajudas →',
      escribirNota: 'Escrever minha nota →',
      guardarSeguir: 'Salvar e seguir',
      pasos: 'Passos',
      'paso.leer': 'Ler',
      'paso.ayudas': 'Ajudas',
      'paso.nota': 'Minha nota',
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
      verAyudas: 'See the helps →',
      escribirNota: 'Write my note →',
      guardarSeguir: 'Save and continue',
      pasos: 'Steps',
      'paso.leer': 'Read',
      'paso.ayudas': 'Helps',
      'paso.nota': 'My note',
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
