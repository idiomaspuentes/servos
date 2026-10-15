/**
 * Checking a translation against one kind of help at a time, the notes or the words: each thing to check (a note, a
 * use of a word) in three steps shown one at a time, each with one thing to do and one button on. Read what the help
 * says; find it in the translation (touch the words that say it); answer whether it is right: yes; improve it now (in
 * the editor the verse was written in, and back here); or improve it later (with the team, or after looking into
 * it). Only «yes» resolves it, and only while the verse stays as it was, as translationCore 3 and 4 and Taller do.
 *
 * What differs between the kinds is given by a `CheckKind`: what there is to check, how it is grouped, what is read
 * in the first step and what the marked words are weighed against in the third.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { chapterOf, type Places, type PrototypeData, type PrototypeText } from '../../../prototype/data'
import { useT } from '../../i18n/i18n'
import { Sheet } from '../../frame/Sheet'
import { WordLines, wordsOf } from '../../frame/TouchWords'
import { WordPicker } from '../../frame/WordPicker'
import { readCheck, stateOf, wordsOfVerse, writeCheck, type CheckState, type NoteCheck } from '../../projects/noteChecks'
import { renderingOf } from '../../projects/wordChecks'
import { readDraft } from '../../projects/work'
import type { MiniAppCenterProps, MiniAppContext, Position } from '../contract'

/** A thing to check: where it is, its words in each text, and the group and subgroup it is gone through by. */
export interface Checkable {
  id: string
  chapter: number
  verse: number
  places: Places
  /** A category (figures of speech; key terms): its name is `{app}.cat.{group}`. */
  group: string
  /** Within it, one figure, or one word. */
  subgroup: string
}

/** The articles a kind may need to name and show. */
export interface Lookup {
  academy(path: string): { title: string; markdown: string } | undefined
  words(path: string): { title: string; markdown: string } | undefined
}

export interface StepProps<I extends Checkable> {
  item: I
  data: PrototypeData
  /** What the help is about, in the text chosen (tabs and a swipe change it). */
  quote: ReactNode
  lookup: Lookup
  context: MiniAppContext
}

export interface AgainstProps<I extends Checkable> extends StepProps<I> {
  /** What the translator marked here, as it reads. */
  here: string
  all: I[]
  /** What was marked at another place, while its verse is as it was then. */
  renderingAt(item: I): string | null
  go(item: I): void
}

export interface CheckKind<I extends Checkable> {
  /** The mini app's id: the group of its texts. */
  app: string
  /** Where its checks are kept (`readCheck`). */
  store: string
  itemsOf(chapters: PrototypeData[]): I[]
  /** The groups, in their order. */
  groups: string[]
  /** All of them, in the order they are gone through: the verses' (notes), or word by word. */
  order?(items: I[]): I[]
  subgroupName(item: I, lookup: Lookup): string
  /** What the help is about in a text where its words are not known. */
  quoteOf(item: I, text: PrototypeText): string
  /** Where a check not answered starts: reading, or (a word read at another place) finding it. */
  firstStep?(item: I, all: I[], answered: (item: I) => boolean): Step
  /**
   * The third step's question, a text key of its own (`pregunta` when not given): words ask to compare with the other
   * places only once there are some checked to compare with.
   */
  question?(item: I, all: I[], renderingAt: (item: I) => string | null): string
  /** The first step: what the help says. */
  Read: ComponentType<StepProps<I>>
  /** The third step, under the words marked: what they are weighed against. */
  Against: ComponentType<AgainstProps<I>>
}

type Step = 1 | 2 | 3

/** What the things are gone through by: all, a group, a subgroup, or those left in a state. */
type Filter = { kind: 'todas' } | { kind: 'categoria'; id: string } | { kind: 'figura'; id: string } | { kind: 'estado'; id: CheckState }

const sameFilter = (a: Filter, b: Filter) => a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '')

export const verseTextOf = (book: string, chapter: number, verse: number) => readDraft(book, chapter, verse).replace(/\n/g, ' ')

/**
 * Each reviewer's own state, kept while the app is open: going to the editor and back draws the reviewer anew, and it
 * comes back to the same thing, in the same group, in the same text, at the step it was left on.
 */
const held = new Map<string, { filter: Filter; currentId: string | null; refText: string }>()
const leftAt = new Map<string, { step: Step; picked: number[]; notThere: boolean; verseText: string }>()

/** Whether a verse's checks of a kind are all answered «right», for the verse as it is now: what the book counts. */
export function doneOf<I extends Checkable>(kind: CheckKind<I>) {
  return (at: Position) => {
    const data = chapterOf(at.book, at.chapter)
    const text = verseTextOf(at.book, at.chapter, at.verse)
    // A verse not translated yet is not checked, whether or not it has anything to check.
    if (!text.trim()) return false
    return (data ? kind.itemsOf([data]) : []).filter((c) => c.verse === at.verse).every((c) => stateOf(readCheck(at.book, c.id, kind.store), text) === 'bien')
  }
}

export function checkingCenter<I extends Checkable>(kind: CheckKind<I>) {
  const k = (key: string) => `${kind.app}.${key}`

  return function Center({ context }: MiniAppCenterProps) {
    const { position, t, frame, chapters, chapterData, goTo, person } = context
    const book = position.book
    const datas = chapters.map(chapterData).filter((d): d is PrototypeData => Boolean(d))
    const items = kind.itemsOf(datas)
    const all = kind.order ? kind.order(items) : items
    const kept = held.get(kind.app) ?? { filter: { kind: 'todas' } as Filter, currentId: null, refText: 'TPL' }
    const [filter, setFilter] = useState<Filter>(kept.filter)
    const [choosing, setChoosing] = useState(false)
    const [currentId, setCurrentId] = useState<string | null>(kept.currentId)
    const [refText, setRefText] = useState(kept.refText)
    held.set(kind.app, { filter, currentId, refText })
    // Only so the screen is drawn again after an answer is written.
    const [, setAnswered] = useState(0)

    const lookup: Lookup = {
      academy: (path) => datas.map((d) => d.academy[path]).find(Boolean),
      words: (path) => datas.map((d) => d.words[path]).find(Boolean),
    }
    const checkOf = (c: I) => readCheck(book, c.id, kind.store)
    const stateFor = (c: I): CheckState => stateOf(checkOf(c), verseTextOf(book, c.chapter, c.verse))
    const inFilter = (c: I, f: Filter) =>
      f.kind === 'todas' ? true : f.kind === 'categoria' ? c.group === f.id : f.kind === 'figura' ? c.subgroup === f.id : stateFor(c) === f.id
    const list = all.filter((c) => inFilter(c, filter))
    const atOrAfter = (c: I) => c.chapter > position.chapter || (c.chapter === position.chapter && c.verse >= position.verse)
    // The thing checked is always one of the verse the position line is on: the one chosen, or its first. A verse the
    // person went to by the position line's arrows may have none; it says so and offers the next one.
    const here = list.filter((c) => c.chapter === position.chapter && c.verse === position.verse)
    const item = here.find((c) => c.id === currentId) ?? here[0]
    const at = item ? list.indexOf(item) : -1
    const inVerses = [...list].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
    const following = item ? list[at + 1] : inVerses.find(atOrAfter)
    const previous = item ? list[at - 1] : inVerses.filter((c) => !atOrAfter(c)).pop()
    const scroller = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
      if (scroller.current) scroller.current.scrollTop = 0
    }, [item?.id])
    const go = (c: I | undefined) => {
      if (!c) return
      setCurrentId(c.id)
      if (c.chapter !== position.chapter || c.verse !== position.verse) goTo({ book, chapter: c.chapter, verse: c.verse })
    }
    // Opened on a verse with nothing to check (where the person left the translation), it starts at the next one.
    useEffect(() => {
      if (!item) go(inVerses.find(atOrAfter) ?? list[0])
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const subgroupOf = (id: string) => all.find((c) => c.subgroup === id)
    const filterLabel =
      filter.kind === 'todas'
        ? t(k('todas'))
        : filter.kind === 'categoria'
          ? t(k(`cat.${filter.id}`))
          : filter.kind === 'figura'
            ? subgroupOf(filter.id)
              ? kind.subgroupName(subgroupOf(filter.id)!, lookup)
              : filter.id
            : t(k(`estado.${filter.id}`))

    const header = (
      <div className="review-head">
        <button type="button" className="chip review-filter" onClick={() => setChoosing(true)}>
          {filterLabel} ▾
        </button>
        <div className="review-steps">
          <button type="button" className="button-quiet" disabled={!previous} onClick={() => go(previous)} aria-label={t(k('anterior'))}>
            ‹
          </button>
          <span className="quiet">{item ? t(k('notaN'), { n: at + 1, total: list.length }) : list.length}</span>
          <button type="button" className="button-quiet" disabled={!following} onClick={() => go(following)} aria-label={t(k('siguiente'))}>
            ›
          </button>
        </div>
      </div>
    )

    const row = (f: Filter, label: string) => {
      const inIt = all.filter((c) => inFilter(c, f))
      const done = inIt.filter((c) => stateFor(c) === 'bien').length
      return (
        <button
          key={`${f.kind}.${'id' in f ? f.id : ''}`}
          type="button"
          className={sameFilter(f, filter) ? 'review-group is-current' : 'review-group'}
          onClick={() => {
            setFilter(f)
            setChoosing(false)
            // To the group's first from here on (its first, word by word), so the position line says where it is.
            go(f.kind === 'figura' || (f.kind === 'todas' && kind.order) ? inIt[0] : (inIt.find(atOrAfter) ?? inIt[0]))
          }}
        >
          <span>{label}</span>
          {/* Of those left in a state, how many; of the others, how many are right. */}
          <span className="quiet">{f.kind === 'estado' ? inIt.length : t(k('hechas'), { hechas: done, total: inIt.length })}</span>
        </button>
      )
    }
    const picker = choosing && (
      <Sheet title={t(k('revisarPor'))} onClose={() => setChoosing(false)}>
        <div className="review-groups">
          {row({ kind: 'todas' }, t(k('todasVersiculos')))}
          {(['despues', 'cambio'] as const).map((s) => all.some((c) => stateFor(c) === s) && row({ kind: 'estado', id: s }, t(k(`estado.${s}`))))}
          {kind.groups
            .filter((g) => all.some((c) => c.group === g))
            .map((g) => (
              <section key={g} className="review-category">
                {row({ kind: 'categoria', id: g }, t(k(`cat.${g}`)))}
                {[...new Set(all.filter((c) => c.group === g).map((c) => c.subgroup))].map((sub) =>
                  row({ kind: 'figura', id: sub }, kind.subgroupName(subgroupOf(sub)!, lookup))
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
              {!list.length ? t(k('ninguna')) : filter.kind === 'todas' ? t(k('ningunaAqui')) : t(k('ningunaDelGrupo'), { grupo: filterLabel })}
            </p>
            {following && (
              <button type="button" className="button-primary" onClick={() => go(following)}>
                {t(k('irSiguiente'), { lugar: `${following.chapter}:${following.verse}` })}
              </button>
            )}
          </div>
          {picker}
        </div>
      )
    }

    return (
      <div className="review">
        {header}
        <CheckSteps<I>
          key={item.id}
          kind={kind}
          item={item}
          all={all}
          data={data}
          lookup={lookup}
          context={context}
          book={book}
          person={person.name}
          refText={refText}
          onRefText={setRefText}
          scroller={scroller}
          answered={(c) => Boolean(checkOf(c))}
          renderingAt={(c) => {
            const check = checkOf(c)
            const text = verseTextOf(book, c.chapter, c.verse)
            if (!check || check.notThere || stateOf(check, text) === 'cambio') return null
            return renderingOf(wordsOfVerse(text), check.words) || null
          }}
          go={go}
          onAnswer={(check) => {
            writeCheck(book, item.id, check, kind.store)
            setAnswered((n) => n + 1)
            // «Right» goes on to the next one left; the others stay on screen, to be seen as saved.
            if (check.status === 'bien') go(list.slice(at + 1).find((c) => stateFor(c) !== 'bien'))
          }}
          onCorrect={() => frame.open('editor', { book, chapter: item.chapter, verse: item.verse })}
        />
        {picker}
      </div>
    )
  }
}

function CheckSteps<I extends Checkable>({
  kind,
  item,
  all,
  data,
  lookup,
  context,
  book,
  person,
  refText,
  onRefText,
  scroller,
  answered,
  renderingAt,
  go,
  onAnswer,
  onCorrect,
}: {
  kind: CheckKind<I>
  item: I
  all: I[]
  data: PrototypeData
  lookup: Lookup
  context: MiniAppContext
  book: string
  person: string
  refText: string
  onRefText(abbreviation: string): void
  scroller: React.RefObject<HTMLDivElement>
  answered(item: I): boolean
  renderingAt(item: I): string | null
  go(item: I): void
  onAnswer(check: NoteCheck): void
  onCorrect(): void
}) {
  const t = useT()
  const k = (key: string) => `${kind.app}.${key}`
  const leftKey = `${kind.app}.${item.id}`
  const verseText = verseTextOf(book, item.chapter, item.verse)
  const words = wordsOfVerse(verseText)
  const before = readCheck(book, item.id, kind.store)
  const state = stateOf(before, verseText)
  // The words chosen before still point at the same words only while the verse is the same.
  const kept = before && state !== 'cambio' ? before : null
  // Back from the editor: at the step it was opened from, with the words marked, if the verse is the same; at finding
  // the words again if it was changed. Then it is as any other.
  const [back] = useState(() => {
    const left = leftAt.get(leftKey)
    return left ? { ...left, same: left.verseText.trim() === verseText.trim() } : null
  })
  // Forgotten once read, in an effect: React may call the initializer above twice.
  useEffect(() => {
    leftAt.delete(leftKey)
  }, [leftKey])
  const [picked, setPicked] = useState<number[]>(back ? (back.same ? back.picked : []) : (kept?.words ?? []))
  const [notThere, setNotThere] = useState(back ? back.same && back.notThere : Boolean(kept?.notThere))
  // Answered, it opens at its answer; its verse changed, at finding the words again; else where the kind says.
  const [step, setStep] = useState<Step>(
    back ? (back.same ? back.step : 2) : kept ? 3 : state === 'cambio' ? 2 : (kind.firstStep?.(item, all, answered) ?? 1)
  )
  const [reached, setReached] = useState<Step>(step)
  const [later, setLater] = useState(false)
  const [reason, setReason] = useState<'equipo' | 'investigar'>(before?.reason ?? 'equipo')
  const [comment, setComment] = useState(before?.comment ?? '')
  const chosen = notThere || picked.length > 0
  const correct = () => {
    leftAt.set(leftKey, { step, picked, notThere, verseText })
    onCorrect()
  }
  const goStep = (s: Step) => {
    setStep(s)
    setReached((r) => (s > r ? s : r))
  }
  // Each step is read from its top.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [step, scroller])

  const text = data.texts.find((x) => x.abbreviation === refText) ?? data.texts[0]
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
  const quote = <QuoteBox app={kind.app} data={data} places={item.places} quoteOf={(x) => kind.quoteOf(item, x)} shown={text} onShow={onRefText} />
  const props = { item, data, quote, lookup, context }

  // The one button on, at the foot: what leads to the next step. The third step's answers are its own buttons.
  const next =
    step === 1
      ? { label: k('aBuscar'), run: () => goStep(2), off: false }
      : step === 2
        ? words.length
          ? { label: k('aDecidir'), run: () => goStep(3), off: !chosen }
          : { label: k('traducirAhora'), run: correct, off: false }
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
                {t(k(`paso${s}`))}
              </button>
            </li>
          ))}
        </ol>

        {step === 1 && <kind.Read {...props} />}

        {step === 2 && (
          <>
            {/* The verse it is in, its words lit, in the box the quote is in (tabs, or a swipe, change the text): it is
                seen where it stands, and the translation comes right under it. */}
            <QuoteBox app={kind.app} data={data} places={item.places} quoteOf={(x) => kind.quoteOf(item, x)} shown={text} onShow={onRefText} verse={item.verse} />
            <section className="review-mine">
              <h3>{t(k('marqueAqui'))}</h3>
              {state === 'cambio' && <p className="notice">{t(k('cambio'))}</p>}
              {words.length === 0 ? (
                <p className="notice">{t(k('sinTraducir'))}</p>
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
                    {t(k('noEsta'))}
                  </label>
                </>
              )}
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <p className="review-instruction">{t(k(kind.question?.(item, all, renderingAt) ?? 'pregunta'))}</p>
            <section className="review-mine">
              <h3>{t(k('suTraduccion'))}</h3>
              {notThere ? (
                <p className="quiet">{t(k('marcoNoEsta'))}</p>
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
            <kind.Against {...props} here={notThere ? '' : renderingOf(words, picked)} all={all} renderingAt={renderingAt} go={go} />
            {state === 'bien' && before && <p className="review-done">✓ {t(k('quedoBien'), { nombre: before.by })}</p>}
            {state === 'despues' && before && (
              <p className="notice">
                {t(k('paraDespues'), { razon: t(k(`razon.${before.reason ?? 'equipo'}`)), nombre: before.by })}
                {before.comment ? ` «${before.comment}»` : ''}
              </p>
            )}
            <section className="review-answer">
              <button type="button" className="button-primary" onClick={() => answer('bien')}>
                {t(k('siBien'))}
              </button>
              <div className="glossary-actions">
                <button type="button" className="button-secondary" onClick={correct}>
                  {t(k('corregirAhora'))}
                </button>
                <button type="button" className="button-secondary" aria-expanded={later} onClick={() => setLater((l) => !l)}>
                  {t(k('corregirDespues'))}
                </button>
              </div>
              {later && (
                <div className="review-later">
                  <div className="unit-switch" role="radiogroup" aria-label={t(k('porQue'))}>
                    {(['equipo', 'investigar'] as const).map((r) => (
                      <button key={r} type="button" role="radio" aria-checked={reason === r} className="unit-switch-option" onClick={() => setReason(r)}>
                        {t(k(`razon.${r}`))}
                      </button>
                    ))}
                  </div>
                  <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t(k('queVio'))} />
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      answer('despues')
                      setLater(false)
                    }}
                  >
                    {t(k('guardarDespues'))}
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
          {next.off && <p className="quiet review-hint">{t(k('primeroElija'))}</p>}
        </div>
      )}
    </>
  )
}

/**
 * What a help is about, in one text at a time, or the verse it is in with its words lit: small tabs choose the text,
 * and a finger slid sideways over the box takes the words along with it and brings the next text in from the side it
 * goes to, as the panes do. One going up or down still scrolls (touch-action: pan-y).
 */
export function QuoteBox({
  app,
  data,
  places,
  quoteOf,
  shown,
  onShow,
  verse,
}: {
  app: string
  data: PrototypeData
  places: Places
  /** The words, in a text where their places are not known. */
  quoteOf(text: PrototypeText): string
  shown: PrototypeText
  onShow(abbreviation: string): void
  /** Show the whole verse, the words lit in it, rather than the words alone. */
  verse?: number
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
  const quote = wordsOf(shown, places[shown.abbreviation]) || quoteOf(shown)
  const missing = <span className="quiet">{t(`${app}.sinAlinear`, { texto: shown.abbreviation })}</span>
  return (
    <section
      className="review-quote"
      aria-label={t(`${app}.cita`)}
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
        // Past the first or the last text, the words only give a little.
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
      <div className="review-quote-switch" role="radiogroup" aria-label={t(`${app}.textoReferencia`)}>
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
      <div
        key={shown.abbreviation}
        className={['review-quote-text', verse !== undefined && 'is-verse', shown.original && 'is-original', enter && `is-entering-${enter}`]
          .filter(Boolean)
          .join(' ')}
        dir={shown.dir ?? 'ltr'}
        lang={shown.lang}
        style={drag ? { transform: `translateX(${drag}px)`, opacity: 1 - Math.min(Math.abs(drag) / 400, 0.4), transition: 'none' } : undefined}
      >
        {verse !== undefined ? (
          <>
            <WordLines lines={shown.lines[verse] ?? []} verse={verse} lit={new Set(places[shown.abbreviation] ?? [])} onWord={() => {}} />
            {!places[shown.abbreviation]?.length && <p className="quiet">{t(`${app}.sinAlinear`, { texto: shown.abbreviation })}</p>}
          </>
        ) : (
          quote || missing
        )}
      </div>
    </section>
  )
}

/** The texts both reviewers share; each adds what is its own, and may say these its own way. */
export const checkingTexts = {
  es: {
    todas: 'Todas',
    revisarPor: 'Revisar por',
    hechas: '{hechas} de {total}',
    notaN: '{n} de {total}',
    ningunaAqui: 'Este versículo no tiene nada que revisar aquí.',
    ningunaDelGrupo: 'Este versículo no tiene nada de «{grupo}».',
    irSiguiente: 'Ir al siguiente ({lugar})',
    textoReferencia: 'Texto de referencia',
    sinAlinear: 'No se sabe qué palabras del {texto} son.',
    noEsta: 'No está en mi traducción',
    sinTraducir: 'Este versículo todavía no está traducido.',
    primeroElija: 'Primero marque las palabras de su traducción, o que no está.',
    corregirAhora: 'Mejorarla ahora',
    traducirAhora: 'Traducirlo ahora',
    corregirDespues: 'Mejorarla después',
    porQue: 'Por qué después',
    'razon.equipo': 'Con el equipo',
    'razon.investigar': 'Investigarlo',
    queVio: 'Qué vio (opcional)',
    guardarDespues: 'Dejarla para después',
    paraDespues: 'Para mejorar después: {razon} ({nombre}).',
    cambio: 'El versículo cambió desde que se revisó: revíselo otra vez.',
    'estado.despues': 'Para mejorar después',
    'estado.cambio': 'Por revisar otra vez',
    'estado.pendiente': 'Sin revisar',
    'estado.bien': 'Quedaron bien',
    suTraduccion: 'Su traducción',
    aDecidir: 'Seguir',
    marcoNoEsta: 'Marcó que no está en su traducción.',
  },
  pt: {
    todas: 'Todas',
    revisarPor: 'Revisar por',
    hechas: '{hechas} de {total}',
    notaN: '{n} de {total}',
    ningunaAqui: 'Este versículo não tem nada para revisar aqui.',
    ningunaDelGrupo: 'Este versículo não tem nada de «{grupo}».',
    irSiguiente: 'Ir para o próximo ({lugar})',
    textoReferencia: 'Texto de referência',
    sinAlinear: 'Não se sabe que palavras do {texto} são.',
    noEsta: 'Não está na minha tradução',
    sinTraducir: 'Este versículo ainda não está traduzido.',
    primeroElija: 'Primeiro marque as palavras da sua tradução, ou que não está.',
    corregirAhora: 'Melhorar agora',
    traducirAhora: 'Traduzir agora',
    corregirDespues: 'Melhorar depois',
    porQue: 'Por que depois',
    'razon.equipo': 'Com a equipe',
    'razon.investigar': 'Pesquisar',
    queVio: 'O que viu (opcional)',
    guardarDespues: 'Deixar para depois',
    paraDespues: 'Para melhorar depois: {razon} ({nombre}).',
    cambio: 'O versículo mudou desde que foi revisado: revise-o de novo.',
    'estado.despues': 'Para melhorar depois',
    'estado.cambio': 'Para revisar de novo',
    'estado.pendiente': 'Sem revisar',
    'estado.bien': 'Ficaram bem',
    suTraduccion: 'Sua tradução',
    aDecidir: 'Seguir',
    marcoNoEsta: 'Marcou que não está na sua tradução.',
  },
  en: {
    todas: 'All',
    revisarPor: 'Check by',
    hechas: '{hechas} of {total}',
    notaN: '{n} of {total}',
    ningunaAqui: 'This verse has nothing to check here.',
    ningunaDelGrupo: 'This verse has nothing of «{grupo}».',
    irSiguiente: 'Go to the next ({lugar})',
    textoReferencia: 'Reference text',
    sinAlinear: 'Which words of the {texto} these are is unknown.',
    noEsta: 'It is not in my translation',
    sinTraducir: 'This verse is not translated yet.',
    primeroElija: 'First mark the words of your translation, or that it is not there.',
    corregirAhora: 'Improve it now',
    traducirAhora: 'Translate it now',
    corregirDespues: 'Improve it later',
    porQue: 'Why later',
    'razon.equipo': 'With the team',
    'razon.investigar': 'Look into it',
    queVio: 'What you saw (optional)',
    guardarDespues: 'Leave it for later',
    paraDespues: 'To improve later: {razon} ({nombre}).',
    cambio: 'The verse changed since it was checked: check it again.',
    'estado.despues': 'To improve later',
    'estado.cambio': 'To check again',
    'estado.pendiente': 'Not checked',
    'estado.bien': 'Right',
    suTraduccion: 'Your translation',
    aDecidir: 'Continue',
    marcoNoEsta: 'You marked that it is not in your translation.',
  },
}
