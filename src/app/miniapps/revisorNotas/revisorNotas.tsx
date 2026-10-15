/**
 * Checking with the notes: for each note that sends to a Translation Academy article (a phrase that may be misread or
 * is hard to translate), the translator makes sure their verse says it as the note explains. The note and its article
 * come first, whole; then the phrase, lit in a reference text (the literal bridge text, or the simple one, or the
 * original); then the translator touches the words of their verse that translate it, as translationCore 3 and 4 and
 * Taller ask; and answers: it is right; correct it now (in the editor, the same one the verse was written in, and back
 * here); or correct it later (with the team, or after looking into it). Only «it is right» resolves a note, and only
 * while the verse stays as it was.
 *
 * Notes come in the order of the verses, or grouped by category and figure (all the metaphors of the book), as
 * translationCore groups them.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { chapterOf, type PrototypeData } from '../../../prototype/data'
import { useT } from '../../i18n/i18n'
import { Markdown } from '../../frame/Markdown'
import { Sheet } from '../../frame/Sheet'
import { WordLines } from '../../frame/TouchWords'
import { WordPicker } from '../../frame/WordPicker'
import { readDraft } from '../../projects/work'
import {
  CATEGORY_ORDER,
  checksOf,
  readCheck,
  slugOf,
  stateOf,
  wordsOfVerse,
  writeCheck,
  type CheckItem,
  type CheckState,
  type NoteCheck,
} from '../../projects/noteChecks'
import type { MiniApp, MiniAppCenterProps } from '../contract'

/** What the notes are gone through by: all in the order of the verses, a category, a figure, or those left in a state. */
type Filter = { kind: 'todas' } | { kind: 'categoria'; id: string } | { kind: 'figura'; id: string } | { kind: 'estado'; id: CheckState }

const verseTextOf = (book: string, chapter: number, verse: number) => readDraft(book, chapter, verse).replace(/\n/g, ' ')

const sameFilter = (a: Filter, b: Filter) => a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '')

function Center({ context }: MiniAppCenterProps) {
  const { position, t, frame, chapters, chapterData, goTo, person } = context
  const book = position.book
  const all = checksOf(chapters.map(chapterData).filter((d): d is PrototypeData => Boolean(d)))
  const [filter, setFilter] = useState<Filter>({ kind: 'todas' })
  const [choosing, setChoosing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [refText, setRefText] = useState('TPL')
  const [article, setArticle] = useState(false)
  // Only so the screen is drawn again after an answer is written.
  const [, setAnswered] = useState(0)

  const stateFor = (c: CheckItem): CheckState => stateOf(readCheck(book, c.note.id), verseTextOf(book, c.chapter, c.verse))
  const inFilter = (c: CheckItem, f: Filter) =>
    f.kind === 'todas'
      ? true
      : f.kind === 'categoria'
        ? c.category === f.id
        : f.kind === 'figura'
          ? slugOf(c.academy) === f.id
          : stateFor(c) === f.id
  const list = all.filter((c) => inFilter(c, filter))
  const atOrAfter = (c: CheckItem) => c.chapter > position.chapter || (c.chapter === position.chapter && c.verse >= position.verse)
  // The note is always one of the verse the position line is on: the one chosen, or its first. A verse the person
  // went to by the position line's arrows may have none; it says so and offers the next one.
  const here = list.filter((c) => c.chapter === position.chapter && c.verse === position.verse)
  const item = here.find((c) => c.note.id === currentId) ?? here[0]
  const at = item ? list.indexOf(item) : -1
  const following = item ? list[at + 1] : list.find(atOrAfter)
  const previous = item ? list[at - 1] : list.filter((c) => !atOrAfter(c)).pop()
  // Each note is read from its top, whatever was scrolled on the one before.
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [item?.note.id])
  const go = (c: CheckItem | undefined) => {
    if (!c) return
    setCurrentId(c.note.id)
    setArticle(false)
    if (c.chapter !== position.chapter || c.verse !== position.verse) goTo({ book, chapter: c.chapter, verse: c.verse })
  }
  // Opened on a verse without notes (where the person left the translation), it starts at the next note.
  useEffect(() => {
    if (!item) go(list.find(atOrAfter) ?? list[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const academyOf = (path: string) => {
    for (const c of chapters) {
      const found = chapterData(c)?.academy[path]
      if (found) return found
    }
    return undefined
  }
  const figureName = (path: string) => academyOf(path)?.title ?? slugOf(path)
  const filterLabel =
    filter.kind === 'todas'
      ? t('revisorNotas.todas')
      : filter.kind === 'categoria'
        ? t(`revisorNotas.cat.${filter.id}`)
        : filter.kind === 'figura'
          ? figureName(all.find((c) => slugOf(c.academy) === filter.id)?.academy ?? filter.id)
          : t(`revisorNotas.estado.${filter.id}`)

  const header = (
    <div className="review-head">
      <button type="button" className="chip review-filter" onClick={() => setChoosing(true)}>
        {filterLabel} ▾
      </button>
      <div className="review-steps">
        <button type="button" className="button-quiet" disabled={!previous} onClick={() => go(previous)} aria-label={t('revisorNotas.anterior')}>
          ‹
        </button>
        <span className="quiet">{item ? t('revisorNotas.notaN', { n: at + 1, total: list.length }) : list.length}</span>
        <button type="button" className="button-quiet" disabled={!following} onClick={() => go(following)} aria-label={t('revisorNotas.siguiente')}>
          ›
        </button>
      </div>
    </div>
  )

  const row = (f: Filter, label: string) => {
    const items = all.filter((c) => inFilter(c, f))
    const done = items.filter((c) => stateFor(c) === 'bien').length
    return (
      <button
        key={`${f.kind}.${'id' in f ? f.id : ''}`}
        type="button"
        className={sameFilter(f, filter) ? 'review-group is-current' : 'review-group'}
        onClick={() => {
          setFilter(f)
          setChoosing(false)
          // To the group's first note from here on, so the position line says where it is.
          go(items.find(atOrAfter) ?? items[0])
        }}
      >
        <span>{label}</span>
        {/* Of those left in a state, how many; of the others, how many are right. */}
        <span className="quiet">{f.kind === 'estado' ? items.length : t('revisorNotas.hechas', { hechas: done, total: items.length })}</span>
      </button>
    )
  }
  const picker = choosing && (
    <Sheet title={t('revisorNotas.revisarPor')} onClose={() => setChoosing(false)}>
      <div className="review-groups">
        {row({ kind: 'todas' }, t('revisorNotas.todasVersiculos'))}
        {(['despues', 'cambio'] as const).map((s) => all.some((c) => stateFor(c) === s) && row({ kind: 'estado', id: s }, t(`revisorNotas.estado.${s}`)))}
        {CATEGORY_ORDER.filter((cat) => all.some((c) => c.category === cat)).map((cat) => (
          <section key={cat} className="review-category">
            {row({ kind: 'categoria', id: cat }, t(`revisorNotas.cat.${cat}`))}
            {[...new Set(all.filter((c) => c.category === cat).map((c) => c.academy))].map((path) =>
              row({ kind: 'figura', id: slugOf(path) }, figureName(path))
            )}
          </section>
        ))}
      </div>
    </Sheet>
  )

  const data = item ? chapterData(item.chapter) : null
  if (!item || !data) {
    return (
      <div className="review">
        {header}
        <div className="review-empty">
          <p className="quiet">
            {!list.length ? t('revisorNotas.ninguna') : filter.kind === 'todas' ? t('revisorNotas.ningunaAqui') : t('revisorNotas.ningunaDelGrupo', { grupo: filterLabel })}
          </p>
          {following && (
            <button type="button" className="button-primary" onClick={() => go(following)}>
              {t('revisorNotas.irSiguiente', { lugar: `${following.chapter}:${following.verse}` })}
            </button>
          )}
        </div>
        {picker}
      </div>
    )
  }
  const academy = academyOf(item.academy)

  return (
    <div className="review">
      {header}
      <div className="review-scroll" ref={scroller}>
        <p className="word-help-kind">
          {t(`revisorNotas.cat.${item.category}`)} · {item.chapter}:{item.verse}
        </p>
        <h2 className="review-figure">{figureName(item.academy)}</h2>
        <div className="review-note">
          <Markdown text={item.note.note} />
        </div>
        {academy && (
          <button type="button" className="button-secondary review-article" onClick={() => setArticle(true)}>
            {t('revisorNotas.leerArticulo', { titulo: academy.title })}
          </button>
        )}
        <Check
          key={item.note.id}
          item={item}
          data={data}
          book={book}
          person={person.name}
          refText={refText}
          onRefText={setRefText}
          onAnswer={(check) => {
            writeCheck(book, item.note.id, check)
            setAnswered((n) => n + 1)
            // «It is right» goes on to the next note left; the others stay on screen, to be seen as saved.
            if (check.status === 'bien') go(list.slice(at + 1).find((c) => stateFor(c) !== 'bien'))
          }}
          onCorrect={() => frame.open('editor', { book, chapter: item.chapter, verse: item.verse })}
        />
      </div>
      {article && academy && (
        <Sheet title={academy.title} onClose={() => setArticle(false)}>
          <Markdown text={academy.markdown} skipFirstHeading />
        </Sheet>
      )}
      {picker}
    </div>
  )
}

/** One note's check: the phrase lit in the reference, the translator's words to touch, the answer. */
function Check({
  item,
  data,
  book,
  person,
  refText,
  onRefText,
  onAnswer,
  onCorrect,
}: {
  item: CheckItem
  data: PrototypeData
  book: string
  person: string
  refText: string
  onRefText(abbreviation: string): void
  onAnswer(check: NoteCheck): void
  onCorrect(): void
}) {
  const t = useT()
  const verseText = verseTextOf(book, item.chapter, item.verse)
  const words = wordsOfVerse(verseText)
  const before = readCheck(book, item.note.id)
  const state = stateOf(before, verseText)
  // The words chosen before still point at the same words only while the verse is the same.
  const kept = before && state !== 'cambio' ? before : null
  const [picked, setPicked] = useState<number[]>(kept?.words ?? [])
  const [notThere, setNotThere] = useState(Boolean(kept?.notThere))
  const [later, setLater] = useState(false)
  const [reason, setReason] = useState<'equipo' | 'investigar'>(before?.reason ?? 'equipo')
  const [comment, setComment] = useState(before?.comment ?? '')
  const text = data.texts.find((x) => x.abbreviation === refText) ?? data.texts[0]
  const lit = new Set(item.note.places[text.abbreviation] ?? [])
  const chosen = notThere || picked.length > 0
  const answer = (status: NoteCheck['status']) =>
    onAnswer({
      status,
      words: notThere ? [] : picked,
      ...(notThere ? { notThere: true } : {}),
      ...(status === 'despues' ? { reason, comment: comment.trim() } : {}),
      verseText,
      by: person,
      at: new Date().toISOString(),
    })

  return (
    <>
      <section className="review-ref">
        <div className="unit-switch" role="radiogroup" aria-label={t('revisorNotas.textoReferencia')}>
          {data.texts.map((x) => (
            <button
              key={x.abbreviation}
              type="button"
              role="radio"
              aria-checked={x.abbreviation === text.abbreviation}
              className="unit-switch-option"
              onClick={() => onRefText(x.abbreviation)}
            >
              {x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation}
            </button>
          ))}
        </div>
        <div className={text.original ? 'review-ref-text is-original' : 'review-ref-text'} dir={text.dir ?? 'ltr'} lang={text.lang}>
          <WordLines lines={text.lines[item.verse] ?? []} verse={item.verse} lit={lit} onWord={() => {}} />
        </div>
        {!lit.size && <p className="quiet">{t('revisorNotas.sinAlinear', { texto: text.abbreviation })}</p>}
      </section>

      <section className="review-mine">
        <h3>{t('revisorNotas.queDice')}</h3>
        {state === 'cambio' && <p className="notice">{t('revisorNotas.cambio')}</p>}
        {state === 'despues' && before && (
          <p className="notice">
            {t('revisorNotas.paraDespues', { razon: t(`revisorNotas.razon.${before.reason ?? 'equipo'}`), nombre: before.by })}
            {before.comment ? ` «${before.comment}»` : ''}
          </p>
        )}
        {state === 'bien' && before && <p className="review-done">✓ {t('revisorNotas.quedoBien', { nombre: before.by })}</p>}
        {words.length === 0 ? (
          <p className="notice">{t('revisorNotas.sinTraducir')}</p>
        ) : (
          <>
            <WordPicker
              words={words}
              picked={picked}
              off={notThere}
              onChange={(now) => {
                setNotThere(false)
                setPicked(now)
              }}
            />
            <label className="check">
              <input type="checkbox" checked={notThere} onChange={(e) => setNotThere(e.target.checked)} />
              {t('revisorNotas.noEsta')}
            </label>
          </>
        )}
      </section>

      <section className="review-answer">
        <h3>{t('revisorNotas.pregunta')}</h3>
        {words.length > 0 && (
          <>
            <button type="button" className="button-primary" disabled={!chosen} onClick={() => answer('bien')}>
              {t('revisorNotas.siBien')}
            </button>
            {!chosen && <p className="quiet review-hint">{t('revisorNotas.primeroElija')}</p>}
          </>
        )}
        <div className="glossary-actions">
          <button type="button" className="button-secondary" onClick={onCorrect}>
            {t(words.length ? 'revisorNotas.corregirAhora' : 'revisorNotas.traducirAhora')}
          </button>
          <button type="button" className="button-secondary" aria-expanded={later} onClick={() => setLater((l) => !l)}>
            {t('revisorNotas.corregirDespues')}
          </button>
        </div>
        {later && (
          <div className="review-later">
            <div className="unit-switch" role="radiogroup" aria-label={t('revisorNotas.porQue')}>
              {(['equipo', 'investigar'] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={reason === r} className="unit-switch-option" onClick={() => setReason(r)}>
                  {t(`revisorNotas.razon.${r}`)}
                </button>
              ))}
            </div>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('revisorNotas.queVio')} />
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                answer('despues')
                setLater(false)
              }}
            >
              {t('revisorNotas.guardarDespues')}
            </button>
          </div>
        )}
      </section>
    </>
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
  // A verse is checked when each of its notes is marked right, for the verse as it is now.
  done: (at) => {
    const data = chapterOf(at.book, at.chapter)
    const text = verseTextOf(at.book, at.chapter, at.verse)
    return (data ? checksOf([data]) : []).filter((c) => c.verse === at.verse).every((c) => stateOf(readCheck(at.book, c.note.id), text) === 'bien')
  },
  Center,
  texts: {
    es: {
      nombre: 'Revisar con las notas',
      descripcion: 'Comprobar que cada frase difícil quedó traducida como explica su nota',
      revisa: 'Notas',
      todas: 'Todas las notas',
      todasVersiculos: 'Todas, en el orden de los versículos',
      revisarPor: 'Revisar por',
      hechas: '{hechas} de {total}',
      notaN: '{n} de {total}',
      anterior: 'Nota anterior',
      siguiente: 'Nota siguiente',
      ninguna: 'No hay notas para revisar aquí.',
      ningunaAqui: 'Este versículo no tiene notas para revisar.',
      ningunaDelGrupo: 'Este versículo no tiene notas de «{grupo}».',
      irSiguiente: 'Ir a la siguiente nota ({lugar})',
      leerArticulo: 'Leer el artículo: {titulo}',
      textoReferencia: 'Texto de referencia',
      sinAlinear: 'No se sabe qué palabras del {texto} son: guíese por la nota.',
      queDice: '¿Qué palabras de su traducción dicen esto?',
      noEsta: 'No está en mi traducción',
      sinTraducir: 'Este versículo todavía no está traducido.',
      pregunta: '¿Lo tradujo como explica la nota?',
      siBien: 'Sí, quedó bien',
      primeroElija: 'Primero toque las palabras de su traducción, o marque que no está.',
      corregirAhora: 'Corregir ahora',
      traducirAhora: 'Traducirlo ahora',
      corregirDespues: 'Corregir después',
      porQue: 'Por qué después',
      'razon.equipo': 'Con el equipo',
      'razon.investigar': 'Investigarlo',
      queVio: 'Qué vio (opcional)',
      guardarDespues: 'Dejarla para después',
      paraDespues: 'Para corregir después: {razon} ({nombre}).',
      quedoBien: 'Quedó bien ({nombre})',
      cambio: 'El versículo cambió desde que se revisó: revíselo otra vez.',
      'estado.despues': 'Para corregir después',
      'estado.cambio': 'Por revisar otra vez',
      'estado.pendiente': 'Sin revisar',
      'estado.bien': 'Quedaron bien',
      'cat.figures': 'Figuras retóricas',
      'cat.grammar': 'Gramática',
      'cat.culture': 'Cultura',
      'cat.discourse': 'Discurso',
      'cat.numbers': 'Números',
      'cat.other': 'Otras',
    },
    pt: {
      nombre: 'Revisar com as notas',
      descripcion: 'Conferir que cada frase difícil ficou traduzida como explica sua nota',
      revisa: 'Notas',
      todas: 'Todas as notas',
      todasVersiculos: 'Todas, na ordem dos versículos',
      revisarPor: 'Revisar por',
      hechas: '{hechas} de {total}',
      notaN: '{n} de {total}',
      anterior: 'Nota anterior',
      siguiente: 'Próxima nota',
      ninguna: 'Não há notas para revisar aqui.',
      ningunaAqui: 'Este versículo não tem notas para revisar.',
      ningunaDelGrupo: 'Este versículo não tem notas de «{grupo}».',
      irSiguiente: 'Ir para a próxima nota ({lugar})',
      leerArticulo: 'Ler o artigo: {titulo}',
      textoReferencia: 'Texto de referência',
      sinAlinear: 'Não se sabe que palavras do {texto} são: guie-se pela nota.',
      queDice: 'Que palavras da sua tradução dizem isto?',
      noEsta: 'Não está na minha tradução',
      sinTraducir: 'Este versículo ainda não está traduzido.',
      pregunta: 'Traduziu como a nota explica?',
      siBien: 'Sim, ficou bem',
      primeroElija: 'Primeiro toque as palavras da sua tradução, ou marque que não está.',
      corregirAhora: 'Corrigir agora',
      traducirAhora: 'Traduzir agora',
      corregirDespues: 'Corrigir depois',
      porQue: 'Por que depois',
      'razon.equipo': 'Com a equipe',
      'razon.investigar': 'Pesquisar',
      queVio: 'O que viu (opcional)',
      guardarDespues: 'Deixar para depois',
      paraDespues: 'Para corrigir depois: {razon} ({nombre}).',
      quedoBien: 'Ficou bem ({nombre})',
      cambio: 'O versículo mudou desde que foi revisado: revise-o de novo.',
      'estado.despues': 'Para corrigir depois',
      'estado.cambio': 'Para revisar de novo',
      'estado.pendiente': 'Sem revisar',
      'estado.bien': 'Ficaram bem',
      'cat.figures': 'Figuras de linguagem',
      'cat.grammar': 'Gramática',
      'cat.culture': 'Cultura',
      'cat.discourse': 'Discurso',
      'cat.numbers': 'Números',
      'cat.other': 'Outras',
    },
    en: {
      nombre: 'Check with the notes',
      descripcion: 'Make sure each hard phrase was translated as its note explains',
      revisa: 'Notes',
      todas: 'All the notes',
      todasVersiculos: 'All, in the order of the verses',
      revisarPor: 'Check by',
      hechas: '{hechas} of {total}',
      notaN: '{n} of {total}',
      anterior: 'Previous note',
      siguiente: 'Next note',
      ninguna: 'No notes to check here.',
      ningunaAqui: 'This verse has no notes to check.',
      ningunaDelGrupo: 'This verse has no notes of «{grupo}».',
      irSiguiente: 'Go to the next note ({lugar})',
      leerArticulo: 'Read the article: {titulo}',
      textoReferencia: 'Reference text',
      sinAlinear: 'Which words of the {texto} these are is unknown: go by the note.',
      queDice: 'Which words of your translation say this?',
      noEsta: 'It is not in my translation',
      sinTraducir: 'This verse is not translated yet.',
      pregunta: 'Did you translate it as the note explains?',
      siBien: 'Yes, it is right',
      primeroElija: 'First touch the words of your translation, or mark that it is not there.',
      corregirAhora: 'Correct it now',
      traducirAhora: 'Translate it now',
      corregirDespues: 'Correct it later',
      porQue: 'Why later',
      'razon.equipo': 'With the team',
      'razon.investigar': 'Look into it',
      queVio: 'What you saw (optional)',
      guardarDespues: 'Leave it for later',
      paraDespues: 'To correct later: {razon} ({nombre}).',
      quedoBien: 'It is right ({nombre})',
      cambio: 'The verse changed since it was checked: check it again.',
      'estado.despues': 'To correct later',
      'estado.cambio': 'To check again',
      'estado.pendiente': 'Not checked',
      'estado.bien': 'Right',
      'cat.figures': 'Figures of speech',
      'cat.grammar': 'Grammar',
      'cat.culture': 'Culture',
      'cat.discourse': 'Discourse',
      'cat.numbers': 'Numbers',
      'cat.other': 'Other',
    },
  },
}
