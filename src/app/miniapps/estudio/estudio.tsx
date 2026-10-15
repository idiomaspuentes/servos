/**
 * Estudio: read the book before translating it. It begins with the book's introduction, then each chapter's, then
 * the verses or sections (as the person chooses), the way translationCore 4's Understand step goes. The texts are
 * panes side by side, one in sight on a phone (TPL, TPS, the original, the helps): a word touched in any of them
 * brings its notes and translation words under its verse, as in the editor, and the helps pane holds those of the
 * whole verse or section. What the study leaves is the team's note on each verse or section (`StudyNotes`), a pane
 * of its own; the editor shows it again while those verses are translated. On a wide screen the notes stay beside the
 * text, and the helps are one of its tabs.
 */

import { ChapterLines } from '../../frame/ChapterLines'
import { Markdown } from '../../frame/Markdown'
import { Panes, type Pane } from '../../frame/Panes'
import { useWordHelps } from '../../frame/TouchWords'
import { studyNotesAbout } from '../../projects/work'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type MiniAppCenterProps } from '../contract'
import { StudyNotes } from './StudyNotes'

function Center({ context }: MiniAppCenterProps) {
  const { position, data, t, marked, textAbbreviation, frame, shown } = context
  const resetKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const { lit, touch, card, helpsOpened } = useWordHelps({ data, resetKey, marked, bridge: textAbbreviation, verses: shown })

  const intro = position.verse === BOOK_INTRO ? data.bookIntro : position.verse === CHAPTER_INTRO ? data.intro : undefined
  if (intro !== undefined) {
    // An introduction is read whole, across the screen: it is about the book or the chapter, not about words in it.
    return (
      <article className="study-intro" aria-label={t(position.verse === BOOK_INTRO ? 'marco.introLibro' : 'marco.introCapitulo')}>
        <Markdown text={intro} />
      </article>
    )
  }

  const hint = t('estudio.toquePalabra')
  const panes: Pane[] = [
    ...data.texts.map((x) => ({
      id: x.abbreviation,
      label: x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation,
      content: (
        <ChapterLines
          text={x}
          shown={shown}
          at={shown[0]}
          line={null}
          lit={lit(x.abbreviation)}
          hint={hint}
          onWord={(verse, place) => touch(x.abbreviation, verse, place)}
          under={(verse) => card(x.abbreviation, verse)}
        />
      ),
    })),
    { id: 'ayudas', label: t('estudio.ayudas'), content: frame.helps(shown, { comments: false }) },
    {
      id: 'notas',
      label: t('estudio.misNotas'),
      content: (
        <StudyNotes book={position.book} chapter={position.chapter} verses={shown} bookName={data.book.name} person={context.person.name} />
      ),
    },
  ]
  return <Panes panes={panes} label={t('estudio.paneles')} fixed="notas" onPane={(id) => id === 'ayudas' && helpsOpened()} />
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
  primary: {
    label: 'estudio.seguir',
    run: (c) => c.frame.next(),
  },
  texts: {
    es: {
      nombre: 'Estudio',
      descripcion: 'Leer el libro con sus introducciones, notas, preguntas y palabras clave antes de traducir',
      seguir: 'Seguir leyendo',
      toquePalabra: 'toque una palabra para ver sus notas',
      paneles: 'Lo que se lee',
      ayudas: 'Ayudas',
      misNotas: 'Mis notas',
      notaDe: 'Notas de comprensión · {pasaje}',
      preguntaSeccion: '¿Qué dice esta sección? ¿Quién habla, a quién, y qué será difícil de traducir?',
      preguntaVersiculo: '¿Qué significa este versículo y qué será difícil de traducir?',
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
      toquePalabra: 'toque uma palavra para ver suas notas',
      paneles: 'O que se lê',
      ayudas: 'Ajudas',
      misNotas: 'Minhas notas',
      notaDe: 'Notas de compreensão · {pasaje}',
      preguntaSeccion: 'O que diz esta seção? Quem fala, a quem, e o que será difícil de traduzir?',
      preguntaVersiculo: 'O que significa este versículo e o que será difícil de traduzir?',
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
      toquePalabra: 'touch a word to see its notes',
      paneles: 'What is read',
      ayudas: 'Helps',
      misNotas: 'My notes',
      notaDe: 'Comprehension notes · {pasaje}',
      preguntaSeccion: 'What does this section say? Who speaks, to whom, and what will be hard to translate?',
      preguntaVersiculo: 'What does this verse mean and what will be hard to translate?',
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
