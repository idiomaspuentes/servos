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

import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChapterLines } from '../../frame/ChapterLines'
import { Markdown } from '../../frame/Markdown'
import { Panes, useWide, useWider, type Pane } from '../../frame/Panes'
import { passageOf } from '../../frame/PlacePicker'
import { SideBySide, type SideText } from '../../frame/SideBySide'
import { glossedPlaces, useWordHelps } from '../../frame/TouchWords'
import { readGlossaryFor } from '../../projects/glossary'
import { joinStartOf, studyNoteOn, studyNotesAbout, textOf, writeStudyNote } from '../../projects/work'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type MiniAppCenterProps } from '../contract'
import { StudyNotes, withLine } from './StudyNotes'

function Center({ context }: MiniAppCenterProps) {
  const { position, data, t, marked, textAbbreviation, frame, shown, person } = context
  const wide = useWide()
  // From 1280 px the texts can be read side by side, up to three, the team's own among them (principle 13).
  const wider = useWider()
  const unitKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const read = () => studyNoteOn(position.book, position.chapter, shown)
  const [key, setKey] = useState(unitKey)
  const [note, setNote] = useState(() => ({ text: read()?.text ?? '', by: read()?.by ?? null }))
  const [, setPane] = useState('')
  const [open, setOpen] = useState<{ id: string } | undefined>(undefined)
  if (key !== unitKey) {
    setKey(unitKey)
    setNote({ text: read()?.text ?? '', by: read()?.by ?? null })
    // Each section starts at its reading.
    setOpen({ id: data.texts.find((x) => x.abbreviation === textAbbreviation)?.abbreviation ?? data.texts[0].abbreviation })
  }
  const box = useRef<HTMLTextAreaElement>(null)
  // A new section or introduction is read from its beginning: what was scrolled to the end of the last one (its
  // text, its note, the introduction before it) goes back to the top. After the texts have placed their verse.
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('.study-intro, .pane').forEach((el) => (el.scrollTop = 0))
  }, [unitKey])
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
  const glossary = readGlossaryFor(
    context.project.id,
    (data.texts.find((x) => x.original)?.words ?? []).map((w) => w.strong)
  )
  const glossed = glossedPlaces(data, glossary)
  const { lit, touch, card, helpsOpened } = useWordHelps({
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
      <div className="study" ref={root}>
        <article className="study-intro" aria-label={t(position.verse === BOOK_INTRO ? 'marco.introLibro' : 'marco.introCapitulo')}>
          <Markdown text={intro} />
        </article>
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
  const inShown = data.verses.filter((v) => shown.includes(v.verse))
  const notesCount = inShown.reduce((n, v) => n + v.notes.length, 0)
  const wordsCount = inShown.reduce((n, v) => n + v.words.length, 0)
  const helpsCount = notesCount + wordsCount
  const questions = data.verses.filter((v) => shown.includes(v.verse)).flatMap((v) => v.questions)
  const others = studyNotesAbout(position.book, position.chapter, shown).filter((n) => n.verses.join(',') !== shown.join(','))
  const texts: Pane[] = data.texts.map(
    (x): Pane => ({
      id: x.abbreviation,
      label: x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation,
      content: (
        <>
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
        {/* The helps reached by touching words, also all together and counted, folded under the text: whoever does
            not know which words to touch sees that there are notes, and goes through them one at a time. */}
        {/* The note on the section, offered where the reading ends (principle 5): not the one thing to do. */}
        {!x.original && !wide && !note.text.trim() && (
          <button type="button" className="button-secondary study-write" onClick={() => toNote()}>
            ✎ {t('estudio.escribirNota')}
          </button>
        )}
        {!x.original && helpsCount > 0 && (
          // Open, the note shown lights its words in the text above, as in the editor.
          <details className="advanced study-helps" onToggle={(e) => e.currentTarget.open && helpsOpened()}>
            <summary>{t('estudio.ayudasAqui', { notas: notesCount, palabras: wordsCount })}</summary>
            {frame.helps(shown, { comments: false, glossary })}
          </details>
        )}
        </>
      ),
    })
  )
  // The team's own text is one more to read beside the others, where some of it is written already.
  const book = position.book
  const chapter = position.chapter
  const ownWritten = shown.some((v) => textOf(book, chapter, v).trim())
  const sideTexts: SideText[] = [
    ...data.texts.map((x, i) => ({ id: x.abbreviation, label: texts[i].label, text: x })),
    ...(ownWritten ? [{ id: 'suyo', label: t('marco.lado.suyo'), own: { textOf: (v: number) => textOf(book, chapter, v), startOf: (v: number) => joinStartOf(book, chapter, v) } }] : []),
  ]
  const together: Pane = {
    id: 'textos',
    label: t('marco.lado.textos'),
    content: (
      <SideBySide
        app="estudio"
        texts={sideTexts}
        max={3}
        initial={textAbbreviation}
        single={(id) => texts.find((p) => p.id === id)?.content ?? null}
        verses={shown}
        open={shown}
        at={shown[0]}
        line={null}
        lit={lit}
        glossed={glossed}
        onWord={(id, verse, place) => touch(id, verse, place)}
        under={(ids, verse) => {
          const cards = ids.map((id) => [id, card(id, verse)] as const).filter(([, c]) => c).map(([id, c]) => <Fragment key={id}>{c}</Fragment>)
          // The notes on a whole verse, once, from the first bridge text shown.
          const bridge = ids.find((id) => data.texts.some((x) => x.abbreviation === id && !x.original))
          const notes = bridge ? general(verse, bridge) : null
          return cards.length || notes ? (
            <>
              {cards}
              {notes}
            </>
          ) : null
        }}
        after={
          helpsCount > 0 && (
            <details className="advanced study-helps" onToggle={(e) => e.currentTarget.open && helpsOpened()}>
              <summary>{t('estudio.ayudasAqui', { notas: notesCount, palabras: wordsCount })}</summary>
              {frame.helps(shown, { comments: false, glossary })}
            </details>
          )
        }
      />
    ),
  }
  const panes: Pane[] = [
    ...(wider ? [together] : texts),
    {
      id: 'nota',
      label: t('estudio.miNota'),
      content: (
        <StudyNotes
          ref={box}
          passage={passageOf(context.bookTitle, position.chapter, shown, t)}
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

  return (
    <div className="study" ref={root}>
      <Panes panes={panes} label={t('estudio.paneles')} fixed="nota" open={open} onPane={setPane} holdFocus={false} />
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
      escribirNota: 'Escribir mi nota',
      miNota: 'Mi nota',
      notasGenerales: 'Notas sobre todo el versículo ({n})',
      verRespuestas: 'Ver las respuestas',
      guardarSeguir: 'Guardar y seguir',
      toquePalabra: 'toque una palabra para ver sus notas',
      'toquePalabra.computadora': 'haga clic en una palabra para ver sus notas',
      ayudasAqui: 'Todas las notas ({notas}) y palabras clave ({palabras}) de estos versículos',
      paneles: 'Lo que se lee',
      notaDe: 'Notas de comprensión · {pasaje}',
      preguntaSeccion: '¿Qué dice esta sección? ¿Quién habla, a quién, y qué será difícil de traducir?',
      preguntaVersiculo: '¿Qué significa este versículo y qué será difícil de traducir?',
      preguntaQueDice: '¿Qué dice?',
      preguntaQuienHabla: '¿Quién habla?',
      preguntaAQuien: '¿A quién?',
      preguntaDificil: '¿Qué será difícil?',
      notaGuardada: 'Guardada en este teléfono · la escribió {nombre}. Se verá al traducir estos versículos.',
      'notaGuardada.computadora': 'Guardada en esta computadora · la escribió {nombre}. Se verá al traducir estos versículos.',
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
      escribirNota: 'Escrever minha nota',
      miNota: 'Minha nota',
      notasGenerales: 'Notas sobre todo o versículo ({n})',
      verRespuestas: 'Ver as respostas',
      guardarSeguir: 'Salvar e seguir',
      toquePalabra: 'toque uma palavra para ver suas notas',
      'toquePalabra.computadora': 'clique numa palavra para ver suas notas',
      ayudasAqui: 'Todas as notas ({notas}) e palavras-chave ({palabras}) destes versículos',
      paneles: 'O que se lê',
      notaDe: 'Notas de compreensão · {pasaje}',
      preguntaSeccion: 'O que diz esta seção? Quem fala, a quem, e o que será difícil de traduzir?',
      preguntaVersiculo: 'O que significa este versículo e o que será difícil de traduzir?',
      preguntaQueDice: 'O que diz?',
      preguntaQuienHabla: 'Quem fala?',
      preguntaAQuien: 'A quem?',
      preguntaDificil: 'O que será difícil?',
      notaGuardada: 'Salva neste telefone · escrita por {nombre}. Será vista ao traduzir estes versículos.',
      'notaGuardada.computadora': 'Salva neste computador · escrita por {nombre}. Será vista ao traduzir estes versículos.',
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
      escribirNota: 'Write my note',
      miNota: 'My note',
      notasGenerales: 'Notes on the whole verse ({n})',
      verRespuestas: 'See the answers',
      guardarSeguir: 'Save and continue',
      toquePalabra: 'touch a word to see its notes',
      'toquePalabra.computadora': 'click a word to see its notes',
      ayudasAqui: 'All the notes ({notas}) and key words ({palabras}) of these verses',
      paneles: 'What is read',
      notaDe: 'Comprehension notes · {pasaje}',
      preguntaSeccion: 'What does this section say? Who speaks, to whom, and what will be hard to translate?',
      preguntaVersiculo: 'What does this verse mean and what will be hard to translate?',
      preguntaQueDice: 'What does it say?',
      preguntaQuienHabla: 'Who speaks?',
      preguntaAQuien: 'To whom?',
      preguntaDificil: 'What will be hard?',
      notaGuardada: 'Saved on this phone · written by {nombre}. It will be seen when these verses are translated.',
      'notaGuardada.computadora': 'Saved on this computer · written by {nombre}. It will be seen when these verses are translated.',
      notaVacia: 'No note yet. What you write will be seen when these verses are translated.',
      otrasNotas: 'Other notes on these verses',
      notaSobre: 'Verses {versiculos} · {nombre}',
      'lengua.hbo': 'Hebrew',
      'lengua.grc': 'Greek',
      'lengua.original': 'Original',
    },
  },
}
