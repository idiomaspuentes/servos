/**
 * Checking with the notes: for each note that sends to a Translation Academy article (a phrase that may be misread or
 * is hard to translate), the translator makes sure their verse says it as the note explains, in the four steps of
 * `checking`: read the source, the phrase lit; understand the note and its article; mark the words of the translation
 * that say it; confirm they say it as the note explains. Notes come in the order of the verses, or grouped by category
 * and figure (all the metaphors of the book), as translationCore groups them.
 */

import { useState } from 'react'
import { Markdown } from '../../frame/Markdown'
import { RowButton } from '../../frame/Actions'
import { Sheet } from '../../frame/Sheet'
import { useT } from '../../i18n/i18n'
import { CATEGORY_ORDER, checksOf, slugOf, type CheckItem } from '../../projects/noteChecks'
import { checkingCenter, checkingTexts, doneOf, Fold, type AgainstProps, type Checkable, type CheckKind, type StepProps } from '../checking/Checking'
import type { MiniApp } from '../contract'

type NoteItem = Checkable & CheckItem

const notes: CheckKind<NoteItem> = {
  app: 'revisorNotas',
  store: 'revisionNota',
  itemsOf: (chapters) => checksOf(chapters).map((c) => ({ ...c, id: c.note.id, places: c.note.places, group: c.category, subgroup: slugOf(c.academy) })),
  groups: CATEGORY_ORDER,
  subgroupName: (item, lookup) => lookup.academy(item.academy)?.title ?? item.subgroup,
  quoteOf: (item, text) => (text.original ? item.note.quote : text.abbreviation === 'TPS' ? item.note.gst : item.note.glt) ?? '',
  question: (_item, { notThere, language }) => ({ key: notThere ? 'preguntaNoEsta' : 'pregunta', values: { idioma: language } }),
  Read,
  Against,
}

/** The note and, a touch away, its article. */
function Note({ item, lookup }: Pick<StepProps<NoteItem>, 'item' | 'lookup'>) {
  const t = useT()
  const academy = lookup.academy(item.academy)
  const [article, setArticle] = useState(false)
  return (
    <>
      <div className="review-note">
        <Markdown text={item.note.note} />
      </div>
      {academy && <RowButton label={t('revisorNotas.leerArticulo', { titulo: academy.title })} onClick={() => setArticle(true)} />}
      {article && academy && (
        <Sheet title={academy.title} onClose={() => setArticle(false)}>
          <Markdown text={academy.markdown} skipFirstHeading />
        </Sheet>
      )}
    </>
  )
}

/** The second step: what kind of note, the phrase, the note and its article. */
function Read({ item, quote, lookup, aside }: StepProps<NoteItem>) {
  const t = useT()
  const academy = lookup.academy(item.academy)
  return (
    <>
      <p className="word-help-kind">
        {t(`revisorNotas.cat.${item.category}`)} · {academy?.title ?? item.subgroup} · {item.chapter}:{item.verse}
      </p>
      {!aside && <p className="review-phrase">{quote}</p>}
      <Note item={item} lookup={lookup} />
      {!aside && <p className="review-instruction is-soft">{t('revisorNotas.entiende')}</p>}
    </>
  )
}

/** The last step: the note again, folded, for looking back at what the marked words are weighed against. */
function Against({ item, lookup, aside }: AgainstProps<NoteItem>) {
  const t = useT()
  if (aside) return null
  return (
    <Fold label={t('revisorNotas.loQueExplica')}>
      <Note item={item} lookup={lookup} />
    </Fold>
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
      aEntender: 'Ya lo leí: leer la nota',
      entiende: '¿Entiende qué problema explica la nota? Si no, lea el artículo.',
      aBuscar: 'Lo entiendo: buscarlo en mi traducción',
      pregunta: '¿Lo que marcó dice bien el sentido que explica la nota, y se entiende en {idioma}?',
      preguntaNoEsta: 'Marcó que no está en su traducción. ¿Así se entiende bien en {idioma} lo que explica la nota?',
      siBien: 'Sí, traduce bien el sentido',
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
      aEntender: 'Já li: ler a nota',
      entiende: 'Entende o problema que a nota explica? Se não, leia o artigo.',
      aBuscar: 'Entendo: encontrar na minha tradução',
      pregunta: 'O que marcou diz bem o sentido que a nota explica, e dá para entender em {idioma}?',
      preguntaNoEsta: 'Marcou que não está na sua tradução. Assim dá para entender bem em {idioma} o que a nota explica?',
      siBien: 'Sim, traduz bem o sentido',
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
      aEntender: 'I read it: read the note',
      entiende: 'Do you understand the problem the note explains? If not, read the article.',
      aBuscar: 'I understand: find it in my translation',
      pregunta: 'Do the words you marked say well the meaning the note explains, and do they read well in {idioma}?',
      preguntaNoEsta: 'You marked that it is not in your translation. Does what the note explains still come across well in {idioma}?',
      siBien: 'Yes, it says the meaning well',
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
