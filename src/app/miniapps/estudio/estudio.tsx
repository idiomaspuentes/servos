/**
 * Estudio: read the book before translating it. It begins with the book's introduction, then each chapter's, then
 * the verses or sections (as the person chooses), the way translationCore 4's Understand step goes. The texts are
 * panes side by side, one in sight on a phone (TPL, TPS, the original, the helps): a word touched in any of them
 * brings its notes and translation words under its verse, as in the editor, and the helps pane holds those of the
 * whole verse or section. On a wide screen the helps stay beside the text.
 */

import { ChapterLines } from '../../frame/ChapterLines'
import { Markdown } from '../../frame/Markdown'
import { Panes, type Pane } from '../../frame/Panes'
import { useWordHelps } from '../../frame/TouchWords'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type MiniAppCenterProps } from '../contract'

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
    { id: 'ayudas', label: t('estudio.ayudas'), content: frame.helps(shown) },
  ]
  return <Panes panes={panes} label={t('estudio.paneles')} fixed="ayudas" onPane={(id) => id === 'ayudas' && helpsOpened()} />
}

export const estudio: MiniApp = {
  id: 'estudio',
  needs: ['text', 'notes', 'questions', 'words', 'academy'],
  phase: 'estudio',
  unit: 'verse',
  sections: true,
  intros: true,
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
      'lengua.hbo': 'Hebrew',
      'lengua.grc': 'Greek',
      'lengua.original': 'Original',
    },
  },
}
