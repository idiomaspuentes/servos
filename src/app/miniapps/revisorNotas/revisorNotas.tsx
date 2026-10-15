/**
 * Checking with the notes: for each note that sends to a Translation Academy article (a phrase that may be misread or
 * is hard to translate), the translator makes sure their verse says it as the note explains, in the three steps of
 * `checking` (read the note, find the phrase, answer). Notes come in the order of the verses, or grouped by category
 * and figure (all the metaphors of the book), as translationCore groups them.
 */

import { useState } from 'react'
import { Markdown } from '../../frame/Markdown'
import { Sheet } from '../../frame/Sheet'
import { useT } from '../../i18n/i18n'
import { CATEGORY_ORDER, checksOf, slugOf, type CheckItem } from '../../projects/noteChecks'
import { checkingCenter, checkingTexts, doneOf, type AgainstProps, type Checkable, type CheckKind, type StepProps } from '../checking/Checking'
import type { MiniApp } from '../contract'

type NoteItem = Checkable & CheckItem

const notes: CheckKind<NoteItem> = {
  app: 'revisorNotas',
  store: 'revisionNota',
  itemsOf: (chapters) => checksOf(chapters).map((c) => ({ ...c, id: c.note.id, places: c.note.places, group: c.category, subgroup: slugOf(c.academy) })),
  groups: CATEGORY_ORDER,
  subgroupName: (item, lookup) => lookup.academy(item.academy)?.title ?? item.subgroup,
  quoteOf: (item, text) => (text.original ? item.note.quote : text.abbreviation === 'TPS' ? item.note.gst : item.note.glt) ?? '',
  Read,
  Against,
}

/** The first step: what the note is about, then the note and its article. */
function Read({ item, quote, lookup }: StepProps<NoteItem>) {
  const t = useT()
  const academy = lookup.academy(item.academy)
  const [article, setArticle] = useState(false)
  return (
    <>
      <p className="word-help-kind">
        {t(`revisorNotas.cat.${item.category}`)} · {item.chapter}:{item.verse}
      </p>
      <p className="review-instruction">{t('revisorNotas.hablaDe')}</p>
      {quote}
      <h2 className="review-figure">{academy?.title ?? item.subgroup}</h2>
      <div className="review-note">
        <Markdown text={item.note.note} />
      </div>
      {academy && (
        <button type="button" className="button-secondary review-article" onClick={() => setArticle(true)}>
          {t('revisorNotas.leerArticulo', { titulo: academy.title })}
        </button>
      )}
      {article && academy && (
        <Sheet title={academy.title} onClose={() => setArticle(false)}>
          <Markdown text={academy.markdown} skipFirstHeading />
        </Sheet>
      )}
    </>
  )
}

/** The third step: the note again, with its phrase, under the words marked: what they are weighed against. */
function Against({ item, quote, lookup }: AgainstProps<NoteItem>) {
  const t = useT()
  const academy = lookup.academy(item.academy)
  const [article, setArticle] = useState(false)
  return (
    <section className="review-again" aria-label={t('revisorNotas.loQueExplica')}>
      <h3>{t('revisorNotas.loQueExplica')}</h3>
      {quote}
      <p className="review-again-figure">{academy?.title ?? item.subgroup}</p>
      <div className="review-note">
        <Markdown text={item.note.note} />
      </div>
      {academy && (
        <button type="button" className="button-quiet review-again-article" onClick={() => setArticle(true)}>
          {t('revisorNotas.leerArticulo', { titulo: academy.title })}
        </button>
      )}
      {article && academy && (
        <Sheet title={academy.title} onClose={() => setArticle(false)}>
          <Markdown text={academy.markdown} skipFirstHeading />
        </Sheet>
      )}
    </section>
  )
}

export const revisorNotas: MiniApp = {
  id: 'revisorNotas',
  phase: 'revision',
  checks: 'revisorNotas.revisa',
  needs: ['text', 'notes', 'academy'],
  unit: 'verse',
  helps: false,
  fills: true,
  writes: false,
  // Its own way on, note by note (or word by word), at the foot: the verse line would be a second one.
  positionLine: false,
  // A verse is checked when each of its notes is marked right, for the verse as it is now.
  done: doneOf(notes),
  Center: checkingCenter(notes),
  texts: {
    es: {
      ...checkingTexts.es,
      nombre: 'Revisar con las notas',
      descripcion: 'Comprobar que cada frase difícil quedó traducida como explica su nota',
      revisa: 'Notas',
      todas: 'Todas las notas',
      todasVersiculos: 'Todas, en el orden de los versículos',
      anterior: 'Nota anterior',
      siguiente: 'Nota siguiente',
      ninguna: 'No hay notas para revisar aquí.',
      ningunaAqui: 'Este versículo no tiene notas para revisar.',
      ningunaDelGrupo: 'Este versículo no tiene notas de «{grupo}».',
      irSiguiente: 'Ir a la siguiente nota ({lugar})',
      sinAlinear: 'No se sabe qué palabras del {texto} son: guíese por la nota.',
      cita: 'De qué habla la nota',
      paso1: 'Leer la nota',
      paso2: 'Buscarlo',
      paso3: '¿Se entiende?',
      hablaDe: 'La nota habla de esto:',
      aBuscar: 'Ya la leí: buscarlo en mi traducción',
      marqueAqui: 'En su traducción, toque o deslice el dedo sobre las palabras que dicen lo resaltado:',
      pregunta: '¿Su traducción dice esto como explica la nota, y se entiende bien en su idioma?',
      siBien: 'Sí, se entiende bien',
      quedoBien: 'Se entiende bien ({nombre})',
      leerArticulo: 'Leer el artículo: {titulo}',
      loQueExplica: 'Lo que explica la nota',
      'cat.figures': 'Figuras retóricas',
      'cat.grammar': 'Gramática',
      'cat.culture': 'Cultura',
      'cat.discourse': 'Discurso',
      'cat.numbers': 'Números',
      'cat.other': 'Otras',
    },
    pt: {
      ...checkingTexts.pt,
      nombre: 'Revisar com as notas',
      descripcion: 'Conferir que cada frase difícil ficou traduzida como explica sua nota',
      revisa: 'Notas',
      todas: 'Todas as notas',
      todasVersiculos: 'Todas, na ordem dos versículos',
      anterior: 'Nota anterior',
      siguiente: 'Próxima nota',
      ninguna: 'Não há notas para revisar aqui.',
      ningunaAqui: 'Este versículo não tem notas para revisar.',
      ningunaDelGrupo: 'Este versículo não tem notas de «{grupo}».',
      irSiguiente: 'Ir para a próxima nota ({lugar})',
      sinAlinear: 'Não se sabe que palavras do {texto} são: guie-se pela nota.',
      cita: 'Do que a nota fala',
      paso1: 'Ler a nota',
      paso2: 'Encontrar',
      paso3: 'Dá para entender?',
      hablaDe: 'A nota fala disto:',
      aBuscar: 'Já li: encontrar na minha tradução',
      marqueAqui: 'Na sua tradução, toque ou deslize o dedo sobre as palavras que dizem o destacado:',
      pregunta: 'Sua tradução diz isto como a nota explica, e dá para entender bem na sua língua?',
      siBien: 'Sim, dá para entender bem',
      quedoBien: 'Dá para entender bem ({nombre})',
      leerArticulo: 'Ler o artigo: {titulo}',
      loQueExplica: 'O que a nota explica',
      'cat.figures': 'Figuras de linguagem',
      'cat.grammar': 'Gramática',
      'cat.culture': 'Cultura',
      'cat.discourse': 'Discurso',
      'cat.numbers': 'Números',
      'cat.other': 'Outras',
    },
    en: {
      ...checkingTexts.en,
      nombre: 'Check with the notes',
      descripcion: 'Make sure each hard phrase was translated as its note explains',
      revisa: 'Notes',
      todas: 'All the notes',
      todasVersiculos: 'All, in the order of the verses',
      anterior: 'Previous note',
      siguiente: 'Next note',
      ninguna: 'No notes to check here.',
      ningunaAqui: 'This verse has no notes to check.',
      ningunaDelGrupo: 'This verse has no notes of «{grupo}».',
      irSiguiente: 'Go to the next note ({lugar})',
      sinAlinear: 'Which words of the {texto} these are is unknown: go by the note.',
      cita: 'What the note is about',
      paso1: 'Read the note',
      paso2: 'Find it',
      paso3: 'Does it read well?',
      hablaDe: 'The note is about this:',
      aBuscar: 'I read it: find it in my translation',
      marqueAqui: 'In your translation, touch or slide your finger over the words that say what is lit:',
      pregunta: 'Does your translation say this as the note explains, and does it read well in your language?',
      siBien: 'Yes, it reads well',
      quedoBien: 'It reads well ({nombre})',
      leerArticulo: 'Read the article: {titulo}',
      loQueExplica: 'What the note explains',
      'cat.figures': 'Figures of speech',
      'cat.grammar': 'Grammar',
      'cat.culture': 'Culture',
      'cat.discourse': 'Discourse',
      'cat.numbers': 'Numbers',
      'cat.other': 'Other',
    },
  },
}
