/**
 * Checking with the words (Translation Words): every use of a word the words list links to an article, in the four
 * steps of `checking`: read the source, the word lit; understand the word, its whole article unfolded, for a word may
 * mean other things and the one meant here must be told from them; mark how it was translated; and compare: whether it
 * is translated right here, and how it was translated at the other places, each rendering with its verses. A word need
 * not be translated the same everywhere; where it means the same it should be, and where it means something else it
 * should say that, and the renderings side by side are what show it.
 *
 * The uses go word by word (all of «Yahweh», then all of «Jonah»…), so they are compared one after the other; or in
 * the order of the verses; or one kind or one word at a time, as Taller's «Revisar palabras clave» groups them.
 */

import { useEffect, useState } from 'react'
import { Markdown } from '../../frame/Markdown'
import { useT } from '../../i18n/i18n'
import { readGlossaryFor, type GlossaryEntry } from '../../projects/glossary'
import { byWord, renderingsOf, WORD_KINDS, wordChecksOf, type WordItem } from '../../projects/wordChecks'
import type { PrototypeData } from '../../../prototype/data'
import { checkingCenter, checkingTexts, doneOf, Fold, verseTextOf, type AgainstProps, type Checkable, type CheckKind, type Lookup, type Question, type StepProps } from '../checking/Checking'
import type { MiniApp } from '../contract'

type Use = Checkable & WordItem

/** The words whose article was unfolded this visit: at their other uses it comes unfolded, to be read again there. */
const read = new Set<string>()

/** A word's name: its article's first title (`God` of «God, gods, godly…»), with a capital, as some come without. */
const wordName = (item: Use, lookup: Lookup) => {
  const name = lookup.words(item.article)?.title.split(',')[0].trim() || item.article.split('/').pop()!
  return name.charAt(0).toLocaleUpperCase() + name.slice(1)
}

/** The article without its references and word data: what it means, and how it may be translated. */
const articleCore = (markdown: string) => markdown.split(/\n#{1,3}\s*(Referencias bíblicas|Datos de la palabra|Bible References|Word Data)/i)[0]

/** The article's first paragraph: what the word is, said before its senses. */
const firstParagraph = (markdown: string) =>
  articleCore(markdown)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#')) ?? ''

/** What the project's glossary says of the words of the original here. */
function glossaryOf(item: Use, data: PrototypeData, project: string): GlossaryEntry[] {
  const original = data.texts.find((x) => x.original)
  const strongs = (item.places[original?.abbreviation ?? ''] ?? []).map((p) => original?.words?.[p]?.strong).filter((s): s is string => Boolean(s))
  return strongs.length ? readGlossaryFor(project, strongs) : []
}

const words: CheckKind<Use> = {
  app: 'revisorPalabras',
  store: 'revisionPalabra',
  itemsOf: (chapters) => wordChecksOf(chapters).map((w) => ({ ...w, group: w.kind, subgroup: w.article })),
  groups: WORD_KINDS,
  order: byWord,
  subgroupName: wordName,
  quoteOf: (item, text) => (text.original ? item.original : ''),
  // A word is told from its other uses in the same verse by the words around it.
  around: 3,
  // Its other meanings are in the article: it is unfolded before going on.
  gated: true,
  question: (item, { all, here, notThere, lookup }): Question => {
    const palabra = wordName(item, lookup)
    if (notThere) return { key: 'preguntaNoEsta', values: { palabra } }
    const elsewhere = all.some((o) => o.article === item.article && o.id !== item.id)
    return { key: elsewhere ? 'pregunta' : 'preguntaSola', values: { palabra, marcado: here } }
  },
  Read,
  Against,
}

function Glossary({ entries }: { entries: GlossaryEntry[] }) {
  const t = useT()
  if (!entries.length) return null
  return (
    <p className="review-glossary">
      <span className="quiet">{t('revisorPalabras.enGlosario')}</span>{' '}
      {entries.map((e) => (
        <strong key={e.id}>{e.rendering}</strong>
      ))}
      {entries.some((e) => e.alternatives.length > 0) && (
        <span className="quiet"> · {t('ayudas.tambien', { formas: entries.flatMap((e) => e.alternatives).join(', ') })}</span>
      )}
    </p>
  )
}

/**
 * The second step: the word and what it means. Its first paragraph is in sight; the whole article unfolds here, and
 * until it is unfolded the step is not done: a translator who does not know the word's other senses may not see that
 * the one translated is not the one meant here. Beside the later steps, the article is shown whole.
 */
function Read({ item, data, lookup, context, aside, onReady }: StepProps<Use>) {
  const t = useT()
  const article = lookup.words(item.article)
  const [open, setOpen] = useState(() => read.has(item.article) || !article)
  useEffect(() => {
    if (open && article) read.add(item.article)
    onReady?.(open)
  }, [open, article, item.article, onReady])
  const whole = aside || open
  return (
    <>
      <p className="word-help-kind">
        {t(`revisorPalabras.cat.${item.kind}`)} · {item.chapter}:{item.verse}
      </p>
      <p className="review-word-name">{wordName(item, lookup)}</p>
      {!aside && article && <p className="review-instruction is-soft">{t('revisorPalabras.variosSentidos')}</p>}
      {article && (
        <div className="review-note">
          <Markdown text={whole ? articleCore(article.markdown) : firstParagraph(article.markdown)} skipFirstHeading />
        </div>
      )}
      {!aside && article && !open && <Fold label={t('revisorPalabras.articuloEntero')} onOpen={() => setOpen(true)}>{null}</Fold>}
      <Glossary entries={glossaryOf(item, data, context.project.id)} />
    </>
  )
}

/**
 * The last step: how the word was translated at the other places, here among them. The places not checked yet are
 * listed too, each verse of the translation a touch away, for a word is compared before it is checked everywhere.
 */
function Against({ item, lookup, here, all, renderingAt, go, book }: AgainstProps<Use>) {
  const t = useT()
  // A word used all through the book has many places still to check: the first few, and the rest a touch away.
  const [allPlaces, setAllPlaces] = useState(false)
  const uses = all.filter((u) => u.article === item.article)
  const others = uses.filter((u) => u.id !== item.id)
  if (!others.length) return <p className="quiet">{t('revisorPalabras.unaSolaVez')}</p>
  const renderings = renderingsOf(uses.map((u) => ({ use: u, text: u.id === item.id ? here : (renderingAt(u) ?? '') })))
  // A verse once: «1:14 ×3» rather than the same verse three times.
  const byVerse = (list: Use[]) => [...new Map(list.map((u) => [`${u.chapter}:${u.verse}`, u])).values()]
  const left = others.filter((u) => !renderingAt(u))
  const unchecked = byVerse(left)
  const times = (u: Use) => left.filter((o) => o.chapter === u.chapter && o.verse === u.verse).length
  const FEW = 8
  return (
    <section className="review-again" aria-label={t('revisorPalabras.enElLibro', { palabra: wordName(item, lookup) })}>
      <h3>{t('revisorPalabras.enElLibro', { palabra: wordName(item, lookup) })}</h3>
      {renderings.length > 0 && (
        <ul className="review-renderings">
          {renderings.map((r) => (
            <li key={r.text}>
              <strong>{r.text}</strong>
              <span className="review-places">
                {r.places.some(({ use }) => use.id === item.id) && <span className="review-here">{t('revisorPalabras.aqui')}</span>}
                {byVerse(r.places.map(({ use }) => use).filter((u) => u.id !== item.id)).map((u) => (
                  <button key={u.id} type="button" className="review-place" onClick={() => go(u)}>
                    {u.chapter}:{u.verse}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {unchecked.length > 0 && (
        <div className="review-unchecked">
          <p className="quiet">{t('revisorPalabras.sinRevisar', { n: unchecked.length })}</p>
          {(allPlaces ? unchecked : unchecked.slice(0, FEW)).map((u) => (
            <Fold key={u.id} label={`${u.chapter}:${u.verse}${times(u) > 1 ? ` ×${times(u)}` : ''}`}>
              {verseTextOf(book, u.chapter, u.verse) ? (
                <p className="review-mine-verse">{verseTextOf(book, u.chapter, u.verse)}</p>
              ) : (
                <p className="quiet">{t('revisorPalabras.sinTraducir')}</p>
              )}
              <button type="button" className="chip" onClick={() => go(u)}>
                {t('revisorPalabras.revisarAlli', { lugar: `${u.chapter}:${u.verse}` })}
              </button>
            </Fold>
          ))}
          {!allPlaces && unchecked.length > FEW && (
            <button type="button" className="chip review-more-places" onClick={() => setAllPlaces(true)}>
              {t('revisorPalabras.verTodos', { n: unchecked.length - FEW })}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export const revisorPalabras: MiniApp = {
  id: 'revisorPalabras',
  phase: 'revision',
  checks: 'revisorPalabras.revisa',
  needs: ['text', 'words'],
  unit: 'verse',
  helps: false,
  fills: true,
  writes: false,
  // Its own way on, note by note (or word by word), at the foot: the verse line would be a second one.
  positionLine: false,
  // A verse is checked when each of its words is marked right there, for the verse as it is now.
  done: doneOf(words),
  Center: checkingCenter(words),
  texts: {
    es: {
      ...checkingTexts.es,
      nombre: 'Revisar con las palabras',
      descripcion: 'Comprobar cómo se tradujo cada palabra en cada lugar, y que concuerde donde dice lo mismo',
      revisa: 'Palabras',
      todas: 'Todas las palabras',
      todasVersiculos: 'Todas, palabra por palabra',
      anterior: 'Anterior',
      siguiente: 'Siguiente',
      ninguna: 'No hay palabras para revisar aquí.',
      ningunaAqui: 'Este versículo no tiene palabras para revisar.',
      ningunaDelGrupo: 'Este versículo no tiene «{grupo}».',
      irSiguiente: 'Ir a la siguiente ({lugar})',
      aBuscar: 'Lo entiendo: buscarla en mi traducción',
      pregunta: '¿«{marcado}» dice bien «{palabra}» aquí, y concuerda con los otros lugares donde significa lo mismo?',
      siBien: 'Sí, está bien y concuerda',
      quedoBien: 'Está bien aquí ({nombre})',
      enElLibro: 'Cómo tradujo «{palabra}» en el libro',
      preguntaSola: '¿«{marcado}» dice bien «{palabra}» en este versículo?',
      sinRevisar: 'Sin revisar todavía ({n}):',
      verTodos: 'y {n} más',
      unaSolaVez: 'Es el único lugar del libro donde aparece.',
      enGlosario: 'En el glosario del proyecto:',
      articuloEntero: 'Leer el artículo entero',
      'cat.kt': 'Términos clave',
      'cat.other': 'Otros términos',
      'cat.names': 'Nombres',
      paso4: 'Comparar',
      aEntender: 'Ya lo leí: qué significa «{palabra}»',
      variosSentidos: 'Una palabra puede tener varios sentidos. Lea el artículo entero y piense cuál es el de este versículo.',
      preguntaNoEsta: 'Marcó que «{palabra}» no está en su traducción aquí. ¿Está bien así?',
      aqui: 'aquí',
      revisarAlli: 'Revisar en {lugar} ›',
    },
    pt: {
      ...checkingTexts.pt,
      nombre: 'Revisar com as palavras',
      descripcion: 'Conferir como cada palavra foi traduzida em cada lugar, e que concorde onde diz o mesmo',
      revisa: 'Palavras',
      todas: 'Todas as palavras',
      todasVersiculos: 'Todas, palavra por palavra',
      anterior: 'Anterior',
      siguiente: 'Próxima',
      ninguna: 'Não há palavras para revisar aqui.',
      ningunaAqui: 'Este versículo não tem palavras para revisar.',
      ningunaDelGrupo: 'Este versículo não tem «{grupo}».',
      irSiguiente: 'Ir para a próxima ({lugar})',
      aBuscar: 'Entendo: encontrá-la na minha tradução',
      pregunta: '«{marcado}» diz bem «{palabra}» aqui, e concorda com os outros lugares onde significa o mesmo?',
      siBien: 'Sim, está bem e concorda',
      quedoBien: 'Está bem aqui ({nombre})',
      enElLibro: 'Como traduziu «{palabra}» no livro',
      preguntaSola: '«{marcado}» diz bem «{palabra}» neste versículo?',
      sinRevisar: 'Ainda sem revisar ({n}):',
      verTodos: 'e mais {n}',
      unaSolaVez: 'É o único lugar do livro onde aparece.',
      enGlosario: 'No glossário do projeto:',
      articuloEntero: 'Ler o artigo inteiro',
      'cat.kt': 'Termos-chave',
      'cat.other': 'Outros termos',
      'cat.names': 'Nomes',
      paso4: 'Comparar',
      aEntender: 'Já li: o que significa «{palabra}»',
      variosSentidos: 'Uma palavra pode ter vários sentidos. Leia o artigo inteiro e pense qual é o deste versículo.',
      preguntaNoEsta: 'Marcou que «{palabra}» não está na sua tradução aqui. Está bem assim?',
      aqui: 'aqui',
      revisarAlli: 'Revisar em {lugar} ›',
    },
    en: {
      ...checkingTexts.en,
      nombre: 'Check with the words',
      descripcion: 'Make sure how each word was translated at each place, and that it agrees where it says the same',
      revisa: 'Words',
      todas: 'All the words',
      todasVersiculos: 'All, word by word',
      anterior: 'Previous',
      siguiente: 'Next',
      ninguna: 'No words to check here.',
      ningunaAqui: 'This verse has no words to check.',
      ningunaDelGrupo: 'This verse has no «{grupo}».',
      irSiguiente: 'Go to the next ({lugar})',
      aBuscar: 'I understand: find it in my translation',
      pregunta: 'Does «{marcado}» say «{palabra}» well here, and does it agree with the other places where it means the same?',
      siBien: 'Yes, it is right and agrees',
      quedoBien: 'Right here ({nombre})',
      enElLibro: 'How you translated «{palabra}» in the book',
      preguntaSola: 'Does «{marcado}» say «{palabra}» well in this verse?',
      sinRevisar: 'Not checked yet ({n}):',
      verTodos: 'and {n} more',
      unaSolaVez: 'It is the only place in the book where it appears.',
      enGlosario: 'In the project glossary:',
      articuloEntero: 'Read the whole article',
      'cat.kt': 'Key terms',
      'cat.other': 'Other terms',
      'cat.names': 'Names',
      paso4: 'Compare',
      aEntender: 'I read it: what «{palabra}» means',
      variosSentidos: 'A word can have several meanings. Read the whole article and think which one this verse has.',
      preguntaNoEsta: 'You marked that «{palabra}» is not in your translation here. Is that right?',
      aqui: 'here',
      revisarAlli: 'Check at {lugar} ›',
    },
  },
}
