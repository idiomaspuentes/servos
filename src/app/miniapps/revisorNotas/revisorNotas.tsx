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
import { WordLines, wordsOf } from '../../frame/TouchWords'
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
      <NoteSteps
        key={item.note.id}
        item={item}
        data={data}
        academy={academy}
        figure={figureName(item.academy)}
        book={book}
        person={person.name}
        refText={refText}
        onRefText={setRefText}
        scroller={scroller}
        onAnswer={(check) => {
          writeCheck(book, item.note.id, check)
          setAnswered((n) => n + 1)
          // «It reads well» goes on to the next note left; the others stay on screen, to be seen as saved.
          if (check.status === 'bien') go(list.slice(at + 1).find((c) => stateFor(c) !== 'bien'))
        }}
        onCorrect={() => frame.open('editor', { book, chapter: item.chapter, verse: item.verse })}
      />
      {picker}
    </div>
  )
}

type Step = 1 | 2 | 3

/**
 * One note's check, in three steps shown one at a time, each with one thing to do and one button on: read the note
 * (and what it is about); find it in the translation (touch the words that say it); answer whether it says it and
 * reads well. The steps are numbered at the top, so the person sees where they are and can go back to one done.
 */
function NoteSteps({
  item,
  data,
  academy,
  figure,
  book,
  person,
  refText,
  onRefText,
  scroller,
  onAnswer,
  onCorrect,
}: {
  item: CheckItem
  data: PrototypeData
  academy: { title: string; markdown: string } | undefined
  figure: string
  book: string
  person: string
  refText: string
  onRefText(abbreviation: string): void
  scroller: React.RefObject<HTMLDivElement>
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
  // A note answered opens at its answer; one whose verse changed, at finding the words again; any other, at reading.
  const [step, setStep] = useState<Step>(kept ? 3 : state === 'cambio' ? 2 : 1)
  const [reached, setReached] = useState<Step>(step)
  const [article, setArticle] = useState(false)
  const [later, setLater] = useState(false)
  const [reason, setReason] = useState<'equipo' | 'investigar'>(before?.reason ?? 'equipo')
  const [comment, setComment] = useState(before?.comment ?? '')
  const chosen = notThere || picked.length > 0
  const goStep = (s: Step) => {
    setStep(s)
    setReached((r) => (s > r ? s : r))
  }
  // Each step is read from its top.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [step, scroller])

  const text = data.texts.find((x) => x.abbreviation === refText) ?? data.texts[0]
  const lit = new Set(item.note.places[text.abbreviation] ?? [])
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
  const quote = <QuoteBox data={data} note={item.note} shown={text} onShow={onRefText} />

  // The one button on, at the foot: what leads to the next step. The third step's answers are its own buttons.
  const next =
    step === 1
      ? { label: 'revisorNotas.aBuscar', run: () => goStep(2), off: false }
      : step === 2
        ? words.length
          ? { label: 'revisorNotas.aDecidir', run: () => goStep(3), off: !chosen }
          : { label: 'revisorNotas.traducirAhora', run: onCorrect, off: false }
        : null

  return (
    <>
      <div className="review-scroll" ref={scroller}>
        <ol className="review-stepper">
          {([1, 2, 3] as const).map((s) => (
            <li key={s}>
              <button
                type="button"
                aria-current={s === step ? 'step' : undefined}
                className={s < reached || (s === 3 && state === 'bien') ? 'is-done' : undefined}
                disabled={s > reached}
                onClick={() => goStep(s)}
              >
                <span className="review-stepper-n">{s}</span>
                {t(`revisorNotas.paso${s}`)}
              </button>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <>
            <p className="word-help-kind">
              {t(`revisorNotas.cat.${item.category}`)} · {item.chapter}:{item.verse}
            </p>
            <p className="review-instruction">{t('revisorNotas.hablaDe')}</p>
            {quote}
            <h2 className="review-figure">{figure}</h2>
            <div className="review-note">
              <Markdown text={item.note.note} />
            </div>
            {academy && (
              <button type="button" className="button-secondary review-article" onClick={() => setArticle(true)}>
                {t('revisorNotas.leerArticulo', { titulo: academy.title })}
              </button>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <p className="review-instruction">{t('revisorNotas.busque')}</p>
            {quote}
            <div className={text.original ? 'review-ref-text is-original' : 'review-ref-text'} dir={text.dir ?? 'ltr'} lang={text.lang}>
              <WordLines lines={text.lines[item.verse] ?? []} verse={item.verse} lit={lit} onWord={() => {}} />
            </div>
            <section className="review-mine">
              <h3>{t('revisorNotas.suTraduccion')}</h3>
              {state === 'cambio' && <p className="notice">{t('revisorNotas.cambio')}</p>}
              {words.length === 0 ? (
                <p className="notice">{t('revisorNotas.sinTraducir')}</p>
              ) : (
                <>
                  <p className="quiet review-hint">{t('revisorNotas.toqueODeslice')}</p>
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
          </>
        )}

        {step === 3 && (
          <>
            <p className="review-instruction">{t('revisorNotas.pregunta')}</p>
            <p className="review-reminder">
              <span className="quiet">{figure}</span>
              <button type="button" className="button-quiet" onClick={() => goStep(1)}>
                {t('revisorNotas.releer')}
              </button>
            </p>
            {quote}
            <section className="review-mine">
              <h3>{t('revisorNotas.suTraduccion')}</h3>
              {notThere ? (
                <p className="quiet">{t('revisorNotas.marcoNoEsta')}</p>
              ) : (
                <p className="review-mine-verse">
                  {words.map((w, i) => (
                    <span key={i}>
                      {i > 0 && ' '}
                      {picked.includes(i) ? <mark>{w}</mark> : w}
                    </span>
                  ))}
                </p>
              )}
            </section>
            {state === 'bien' && before && <p className="review-done">✓ {t('revisorNotas.quedoBien', { nombre: before.by })}</p>}
            {state === 'despues' && before && (
              <p className="notice">
                {t('revisorNotas.paraDespues', { razon: t(`revisorNotas.razon.${before.reason ?? 'equipo'}`), nombre: before.by })}
                {before.comment ? ` «${before.comment}»` : ''}
              </p>
            )}
            <section className="review-answer">
              <button type="button" className="button-primary" onClick={() => answer('bien')}>
                {t('revisorNotas.siBien')}
              </button>
              <div className="glossary-actions">
                <button type="button" className="button-secondary" onClick={onCorrect}>
                  {t('revisorNotas.corregirAhora')}
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
        )}
      </div>
      {next && (
        <div className="review-next">
          <button type="button" className="button-primary" disabled={next.off} onClick={next.run}>
            {t(next.label)}
          </button>
          {next.off && <p className="quiet review-hint">{t('revisorNotas.primeroElija')}</p>}
        </div>
      )}
      {article && academy && (
        <Sheet title={academy.title} onClose={() => setArticle(false)}>
          <Markdown text={academy.markdown} skipFirstHeading />
        </Sheet>
      )}
    </>
  )
}

/**
 * What a note is about, in one text at a time: small tabs choose the text, and a finger slid sideways over the box
 * takes the phrase along with it and brings the next text in from the side it goes to, as the panes do. One going up
 * or down still scrolls (touch-action: pan-y).
 */
function QuoteBox({
  data,
  note,
  shown,
  onShow,
}: {
  data: PrototypeData
  note: CheckItem['note']
  shown: PrototypeData['texts'][number]
  onShow(abbreviation: string): void
}) {
  const t = useT()
  const [drag, setDrag] = useState(0)
  const [enter, setEnter] = useState<'next' | 'back' | null>(null)
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null)
  // A swipe begun on a tab ends in a click on it, which is not a choice of its own.
  const swiped = useRef(false)
  const at = data.texts.indexOf(shown)
  const show = (to: number) => {
    const x = data.texts[to]
    if (!x || to === at) return
    setEnter(to > at ? 'next' : 'back')
    onShow(x.abbreviation)
  }
  const quoteIn = (x: PrototypeData['texts'][number]) =>
    wordsOf(x, note.places[x.abbreviation]) || (x.original ? note.quote : x.abbreviation === 'TPS' ? note.gst : note.glt) || ''
  const quote = quoteIn(shown)
  return (
    <section
      className="review-quote"
      aria-label={t('revisorNotas.cita')}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, on: false }
        swiped.current = false
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s || (e.pointerType === 'mouse' && e.buttons === 0)) return
        const dx = e.clientX - s.x
        if (!s.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - s.y)) s.on = true
        if (!s.on) return
        // Past the first or the last text, the phrase only gives a little.
        const edge = (dx > 0 && at === 0) || (dx < 0 && at === data.texts.length - 1)
        setDrag(edge ? dx / 4 : dx)
      }}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        if (!s?.on) return
        swiped.current = true
        const dx = e.clientX - s.x
        setDrag(0)
        if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1))
      }}
      onPointerCancel={() => {
        start.current = null
        setDrag(0)
      }}
    >
      <div className="review-quote-switch" role="radiogroup" aria-label={t('revisorNotas.textoReferencia')}>
        {data.texts.map((x, i) => (
          <button
            key={x.abbreviation}
            type="button"
            role="radio"
            aria-checked={x === shown}
            onClick={() => {
              if (swiped.current) swiped.current = false
              else show(i)
            }}
          >
            {x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation}
          </button>
        ))}
      </div>
      <p
        key={shown.abbreviation}
        className={['review-quote-text', shown.original && 'is-original', enter && `is-entering-${enter}`].filter(Boolean).join(' ')}
        dir={shown.dir ?? 'ltr'}
        lang={shown.lang}
        style={drag ? { transform: `translateX(${drag}px)`, opacity: 1 - Math.min(Math.abs(drag) / 400, 0.4), transition: 'none' } : undefined}
      >
        {quote || <span className="quiet">{t('revisorNotas.sinAlinear', { texto: shown.abbreviation })}</span>}
      </p>
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
      cita: 'De qué habla la nota',
      sinAlinear: 'No se sabe qué palabras del {texto} son: guíese por la nota.',
      paso1: 'Leer la nota',
      paso2: 'Buscarlo',
      paso3: '¿Se entiende?',
      hablaDe: 'La nota habla de esto:',
      aBuscar: 'Ya la leí: buscarlo en mi traducción',
      busque: 'Busque esto en su traducción.',
      suTraduccion: 'Su traducción',
      toqueODeslice: 'Toque las palabras que lo dicen, o deslice el dedo sobre ellas.',
      aDecidir: 'Seguir',
      releer: 'Leer la nota otra vez',
      marcoNoEsta: 'Marcó que no está en su traducción.',
      noEsta: 'No está en mi traducción',
      sinTraducir: 'Este versículo todavía no está traducido.',
      pregunta: '¿Su traducción dice esto como explica la nota, y se entiende bien en su idioma?',
      siBien: 'Sí, se entiende bien',
      primeroElija: 'Primero marque las palabras de su traducción, o que no está.',
      corregirAhora: 'Mejorarla ahora',
      traducirAhora: 'Traducirlo ahora',
      corregirDespues: 'Mejorarla después',
      porQue: 'Por qué después',
      'razon.equipo': 'Con el equipo',
      'razon.investigar': 'Investigarlo',
      queVio: 'Qué vio (opcional)',
      guardarDespues: 'Dejarla para después',
      paraDespues: 'Para corregir después: {razon} ({nombre}).',
      quedoBien: 'Se entiende bien ({nombre})',
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
      cita: 'Do que a nota fala',
      sinAlinear: 'Não se sabe que palavras do {texto} são: guie-se pela nota.',
      paso1: 'Ler a nota',
      paso2: 'Encontrar',
      paso3: 'Dá para entender?',
      hablaDe: 'A nota fala disto:',
      aBuscar: 'Já li: encontrar na minha tradução',
      busque: 'Encontre isto na sua tradução.',
      suTraduccion: 'Sua tradução',
      toqueODeslice: 'Toque as palavras que dizem isto, ou deslize o dedo sobre elas.',
      aDecidir: 'Seguir',
      releer: 'Ler a nota de novo',
      marcoNoEsta: 'Marcou que não está na sua tradução.',
      noEsta: 'Não está na minha tradução',
      sinTraducir: 'Este versículo ainda não está traduzido.',
      pregunta: 'Sua tradução diz isto como a nota explica, e dá para entender bem na sua língua?',
      siBien: 'Sim, dá para entender bem',
      primeroElija: 'Primeiro marque as palavras da sua tradução, ou que não está.',
      corregirAhora: 'Melhorar agora',
      traducirAhora: 'Traduzir agora',
      corregirDespues: 'Melhorar depois',
      porQue: 'Por que depois',
      'razon.equipo': 'Com a equipe',
      'razon.investigar': 'Pesquisar',
      queVio: 'O que viu (opcional)',
      guardarDespues: 'Deixar para depois',
      paraDespues: 'Para corrigir depois: {razon} ({nombre}).',
      quedoBien: 'Dá para entender bem ({nombre})',
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
      cita: 'What the note is about',
      sinAlinear: 'Which words of the {texto} these are is unknown: go by the note.',
      paso1: 'Read the note',
      paso2: 'Find it',
      paso3: 'Does it read well?',
      hablaDe: 'The note is about this:',
      aBuscar: 'I read it: find it in my translation',
      busque: 'Find this in your translation.',
      suTraduccion: 'Your translation',
      toqueODeslice: 'Touch the words that say it, or slide your finger over them.',
      aDecidir: 'Continue',
      releer: 'Read the note again',
      marcoNoEsta: 'You marked that it is not in your translation.',
      noEsta: 'It is not in my translation',
      sinTraducir: 'This verse is not translated yet.',
      pregunta: 'Does your translation say this as the note explains, and does it read well in your language?',
      siBien: 'Yes, it reads well',
      primeroElija: 'First mark the words of your translation, or that it is not there.',
      corregirAhora: 'Improve it now',
      traducirAhora: 'Translate it now',
      corregirDespues: 'Improve it later',
      porQue: 'Why later',
      'razon.equipo': 'With the team',
      'razon.investigar': 'Look into it',
      queVio: 'What you saw (optional)',
      guardarDespues: 'Leave it for later',
      paraDespues: 'To correct later: {razon} ({nombre}).',
      quedoBien: 'It reads well ({nombre})',
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
