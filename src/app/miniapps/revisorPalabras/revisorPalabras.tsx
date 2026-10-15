/**
 * Checking with the words (Translation Words): every use of a word the words list links to an article, in the three
 * steps of `checking`: read the word and its article; find it in the translation; answer whether it is translated
 * right there. What the third step adds is the book: how the same word was translated at the other places checked,
 * each rendering with its verses. A word need not be translated the same everywhere; where it means the same it
 * should be, and where it means something else it should say that, and the renderings side by side are what show it.
 *
 * The uses go word by word (all of «Yahweh», then all of «Jonah»…), so they are compared one after the other; or in
 * the order of the verses; or one kind or one word at a time, as Taller's «Revisar palabras clave» groups them.
 */

import { useEffect, useState } from 'react'
import { Markdown } from '../../frame/Markdown'
import { Sheet } from '../../frame/Sheet'
import { useT } from '../../i18n/i18n'
import { readGlossaryFor, type GlossaryEntry } from '../../projects/glossary'
import { byWord, renderingsOf, WORD_KINDS, wordChecksOf, type WordItem } from '../../projects/wordChecks'
import type { PrototypeData } from '../../../prototype/data'
import { checkingCenter, checkingTexts, doneOf, type AgainstProps, type Checkable, type CheckKind, type Lookup, type StepProps } from '../checking/Checking'
import type { MiniApp } from '../contract'

type Use = Checkable & WordItem

/** The words whose article was read this visit: their other uses start at finding them, not at reading again. */
const read = new Set<string>()

/** A word's name: its article's first title (`God` of «God, gods, godly…»), with a capital, as some come without. */
const wordName = (item: Use, lookup: Lookup) => {
  const name = lookup.words(item.article)?.title.split(',')[0].trim() || item.article.split('/').pop()!
  return name.charAt(0).toLocaleUpperCase() + name.slice(1)
}

/** The article without its references and word data: what it means, and how it may be translated. */
const articleCore = (markdown: string) => markdown.split(/\n#{1,3}\s*(Referencias bíblicas|Datos de la palabra|Bible References|Word Data)/i)[0]

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
  // A word read, or checked, at another place starts at finding it: its article was read there.
  // Comparing with the other places asks for some: until the word is checked elsewhere, only whether it is right here.
  question: (item, all, renderingAt) => (all.some((o) => o.article === item.article && o.id !== item.id && renderingAt(o)) ? 'pregunta' : 'preguntaSola'),
  firstStep: (item, all, answered) => (read.has(item.article) || all.some((o) => o.article === item.article && o.id !== item.id && answered(o)) ? 2 : 1),
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

/** The first step: the word here, and what it means. */
function Read({ item, data, quote, lookup, context }: StepProps<Use>) {
  const t = useT()
  const article = lookup.words(item.article)
  const [whole, setWhole] = useState(false)
  useEffect(() => {
    read.add(item.article)
  }, [item.article])
  return (
    <>
      <p className="word-help-kind">
        {t(`revisorPalabras.cat.${item.kind}`)} · {item.chapter}:{item.verse}
      </p>
      <p className="review-instruction">{t('revisorPalabras.esta')}</p>
      {quote}
      <h2 className="review-figure">{article?.title ?? wordName(item, lookup)}</h2>
      <Glossary entries={glossaryOf(item, data, context.project.id)} />
      {article && (
        <>
          <div className="review-note">
            <Markdown text={articleCore(article.markdown)} skipFirstHeading />
          </div>
          <button type="button" className="button-secondary review-article" onClick={() => setWhole(true)}>
            {t('revisorPalabras.articuloEntero')}
          </button>
          {whole && (
            <Sheet title={article.title} onClose={() => setWhole(false)}>
              <Markdown text={article.markdown} skipFirstHeading />
            </Sheet>
          )}
        </>
      )}
    </>
  )
}

/** The third step: how the word was translated at the other places, here among them. */
function Against({ item, data, lookup, context, here, all, renderingAt, go }: AgainstProps<Use>) {
  const t = useT()
  const article = lookup.words(item.article)
  const [whole, setWhole] = useState(false)
  const uses = all.filter((u) => u.article === item.article)
  const others = uses.filter((u) => u.id !== item.id)
  const renderings = renderingsOf(uses.map((u) => ({ use: u, text: u.id === item.id ? here : (renderingAt(u) ?? '') })))
  const unchecked = others.filter((u) => !renderingAt(u))
  const compared = others.length - unchecked.length
  // A word used all through the book has many places still to check: the first few, and the rest a touch away, so the
  // answer is not pushed far down.
  const [allPlaces, setAllPlaces] = useState(false)
  const FEW = 8
  // Places to go to, a verse once: «1:14 ×3» rather than the same verse three times.
  const chips = (list: Use[]) =>
    [...new Map(list.map((u) => [`${u.chapter}:${u.verse}`, u])).values()].map((u) => {
      const times = list.filter((o) => o.chapter === u.chapter && o.verse === u.verse).length
      return (
        <button key={u.id} type="button" className="review-place" onClick={() => go(u)}>
          {u.chapter}:{u.verse}
          {times > 1 && ` ×${times}`}
        </button>
      )
    })
  return (
    <section className="review-again" aria-label={t('revisorPalabras.enElLibro')}>
      {/* No quote of the source here: the heading names the word, and a quote above the renderings read as one of them.
          Nothing to compare with until the word is checked at another place: then only where it is still to check. */}
      {others.length === 0 ? (
        <p className="quiet">{t('revisorPalabras.unaSolaVez')}</p>
      ) : compared === 0 ? (
        <div className="review-not-yet">
          <p className="quiet">{t('revisorPalabras.sinOtros')}</p>
          <span className="review-places">{chips(unchecked)}</span>
        </div>
      ) : (
        <>
        <h3>{t('revisorPalabras.enElLibro', { palabra: wordName(item, lookup) })}</h3>
        <ul className="review-renderings">
          {renderings.map((r) => (
            <li key={r.text}>
              <strong>{r.text}</strong>
              <span className="review-places">
                {r.places.some(({ use }) => use.id === item.id) && (
                  <span className="review-here">{t('revisorPalabras.esteVersiculo', { lugar: `${item.chapter}:${item.verse}` })}</span>
                )}
                {chips(r.places.map(({ use }) => use).filter((u) => u.id !== item.id))}
              </span>
            </li>
          ))}
          {unchecked.length > 0 && (
            <li className="review-unchecked">
              <span className="quiet">{t('revisorPalabras.sinRevisar', { n: unchecked.length })}</span>
              <span className="review-places">
                {allPlaces ? chips(unchecked) : chips(unchecked).slice(0, FEW)}
                {!allPlaces && chips(unchecked).length > FEW && (
                  <button type="button" className="button-quiet review-more-places" onClick={() => setAllPlaces(true)}>
                    {t('revisorPalabras.verTodos', { n: chips(unchecked).length - FEW })}
                  </button>
                )}
              </span>
            </li>
          )}
        </ul>
        </>
      )}
      <Glossary entries={glossaryOf(item, data, context.project.id)} />
      {article && (
        <button type="button" className="button-quiet review-again-article" onClick={() => setWhole(true)}>
          {t('revisorPalabras.leerArticulo', { titulo: article.title.split(',')[0] })}
        </button>
      )}
      {whole && article && (
        <Sheet title={article.title} onClose={() => setWhole(false)}>
          <Markdown text={article.markdown} skipFirstHeading />
        </Sheet>
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
      sinAlinear: 'No se sabe qué palabras del {texto} son: guíese por el original.',
      cita: 'La palabra',
      paso1: 'Leer la palabra',
      paso2: 'Buscarla',
      paso3: '¿Está bien?',
      esta: 'Esta es la palabra:',
      aBuscar: 'Ya la leí: buscarla en mi traducción',
      marqueAqui: 'En su traducción, toque o deslice el dedo sobre las palabras que traducen lo resaltado:',
      pregunta: '¿Tradujo bien esta palabra aquí? Compárela con los otros lugares: donde significa lo mismo, ¿la tradujo igual?',
      siBien: 'Sí, está bien aquí',
      quedoBien: 'Está bien aquí ({nombre})',
      enElLibro: 'Cómo tradujo «{palabra}» en el libro',
      esteVersiculo: '{lugar} (este versículo)',
      sinOtros: 'Todavía no ha revisado esta palabra en otros lugares del libro. Cuando lo haga, aquí verá cómo la tradujo en cada uno:',
      preguntaSola: '¿Tradujo bien esta palabra aquí, según lo que significa en este versículo?',
      sinRevisar: 'Sin revisar ({n}):',
      verTodos: 'y {n} más',
      unaSolaVez: 'Es el único lugar del libro donde aparece.',
      enGlosario: 'En el glosario del proyecto:',
      articuloEntero: 'Leer el artículo entero',
      leerArticulo: 'Leer el artículo: {titulo}',
      'cat.kt': 'Términos clave',
      'cat.other': 'Otros términos',
      'cat.names': 'Nombres',
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
      sinAlinear: 'Não se sabe que palavras do {texto} são: guie-se pelo original.',
      cita: 'A palavra',
      paso1: 'Ler a palavra',
      paso2: 'Encontrá-la',
      paso3: 'Está bem?',
      esta: 'Esta é a palavra:',
      aBuscar: 'Já li: encontrá-la na minha tradução',
      marqueAqui: 'Na sua tradução, toque ou deslize o dedo sobre as palavras que traduzem o destacado:',
      pregunta: 'Traduziu bem esta palavra aqui? Compare-a com os outros lugares: onde significa o mesmo, traduziu igual?',
      siBien: 'Sim, está bem aqui',
      quedoBien: 'Está bem aqui ({nombre})',
      enElLibro: 'Como traduziu «{palabra}» no livro',
      esteVersiculo: '{lugar} (este versículo)',
      sinOtros: 'Ainda não revisou esta palavra em outros lugares do livro. Quando o fizer, aqui verá como a traduziu em cada um:',
      preguntaSola: 'Traduziu bem esta palavra aqui, segundo o que significa neste versículo?',
      sinRevisar: 'Sem revisar ({n}):',
      verTodos: 'e mais {n}',
      unaSolaVez: 'É o único lugar do livro onde aparece.',
      enGlosario: 'No glossário do projeto:',
      articuloEntero: 'Ler o artigo inteiro',
      leerArticulo: 'Ler o artigo: {titulo}',
      'cat.kt': 'Termos-chave',
      'cat.other': 'Outros termos',
      'cat.names': 'Nomes',
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
      sinAlinear: 'Which words of the {texto} these are is unknown: go by the original.',
      cita: 'The word',
      paso1: 'Read the word',
      paso2: 'Find it',
      paso3: 'Is it right?',
      esta: 'This is the word:',
      aBuscar: 'I read it: find it in my translation',
      marqueAqui: 'In your translation, touch or slide your finger over the words that translate what is lit:',
      pregunta: 'Did you translate this word right here? Compare it with the other places: where it means the same, did you translate it the same?',
      siBien: 'Yes, it is right here',
      quedoBien: 'Right here ({nombre})',
      enElLibro: 'How you translated «{palabra}» in the book',
      esteVersiculo: '{lugar} (this verse)',
      sinOtros: 'You have not checked this word at other places in the book yet. When you do, here you will see how you translated it at each:',
      preguntaSola: 'Did you translate this word right here, by what it means in this verse?',
      sinRevisar: 'Not checked ({n}):',
      verTodos: 'and {n} more',
      unaSolaVez: 'It is the only place in the book where it appears.',
      enGlosario: 'In the project glossary:',
      articuloEntero: 'Read the whole article',
      leerArticulo: 'Read the article: {titulo}',
      'cat.kt': 'Key terms',
      'cat.other': 'Other terms',
      'cat.names': 'Names',
    },
  },
}
