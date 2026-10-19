/**
 * Checking a translation against one kind of help at a time, the notes or the words: each thing to check (a note, a
 * use of a word) in four steps shown one at a time, each with one thing to do and one button on. Read the source text,
 * its words lit; understand what the help says of them; mark the words of the translation that say them; and confirm
 * that they say it right (for a word, comparing with how it was translated elsewhere): yes; improve it now (in the
 * editor the verse was written in, and back here); or leave it for later (with the team, or after looking into it).
 * Only «yes» resolves it, and only while the verse stays as it was, as translationCore 3 and 4 and Taller do.
 *
 * What differs between the kinds is given by a `CheckKind`: what there is to check, how it is grouped, what is read
 * in the second step and what the marked words are weighed against in the fourth.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { chapterOf, type Places, type PrototypeData, type PrototypeText } from '../../../prototype/data'
import { useT } from '../../i18n/i18n'
import { RowButton } from '../../frame/Actions'
import { KEYS, useKey } from '../../frame/keys'
import { useWide, useWider } from '../../frame/Panes'
import { Sheet } from '../../frame/Sheet'
import { WordLines, wordsOf } from '../../frame/TouchWords'
import { WordPicker } from '../../frame/WordPicker'
import { answersToChoose, readCheck, stateOf, wordsOfVerse, writeCheck, type CheckState, type NoteCheck } from '../../projects/noteChecks'
import { renderingOf } from '../../projects/wordChecks'
import { textOf } from '../../projects/work'
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
  /** What the help is about, lit, in the source text chosen in the first step. */
  quote: ReactNode
  lookup: Lookup
  context: MiniAppContext
  /**
   * In a wide window, from the third step: `Read` is the column of what was read, without asking for anything; and
   * `Against` stands beside that column, so what is in it need not be said again.
   */
  aside?: boolean
  /** For a kind whose reading must be done before going on (`gated`): whether it is. */
  onReady?(ready: boolean): void
}

export interface AgainstProps<I extends Checkable> extends StepProps<I> {
  /** What the translator marked here, as it reads. */
  here: string
  all: I[]
  /** What was marked at another place, while its verse is as it was then. */
  renderingAt(item: I): string | null
  go(item: I): void
  book: string
}

/** What is asked in the last step: a text key of the kind's, with what fills it. */
export interface Question {
  key: string
  values?: Record<string, string>
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
  /** Words of the source shown on each side of what is lit when it is recalled: a word is told from its others by them. */
  around?: number
  /** Whether the second step must be read through (an article unfolded) before going on. */
  gated?: boolean
  /** The last step's question. */
  question(item: I, at: { all: I[]; renderingAt: (item: I) => string | null; here: string; notThere: boolean; lookup: Lookup; language: string }): Question
  /** The second step: what the help says. */
  Read: ComponentType<StepProps<I>>
  /** The last step, under the words marked: what they are weighed against. */
  Against: ComponentType<AgainstProps<I>>
}

type Step = 1 | 2 | 3 | 4
const STEPS = [1, 2, 3, 4] as const

/** What the things are gone through by: all, a group, a subgroup, or those left in a state. */
type Filter = { kind: 'todas' } | { kind: 'categoria'; id: string } | { kind: 'figura'; id: string } | { kind: 'estado'; id: CheckState }

const sameFilter = (a: Filter, b: Filter) => a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '')

// A verse joined to others is said by their text together.
export const verseTextOf = (book: string, chapter: number, verse: number) => textOf(book, chapter, verse).replace(/\n/g, ' ')

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
    // The last one left answered «right»: the end is said, with the way on, instead of staying on it.
    const [finished, setFinished] = useState(false)

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
      setFinished(false)
      setCurrentId(c.id)
      if (c.chapter !== position.chapter || c.verse !== position.verse) goTo({ book, chapter: c.chapter, verse: c.verse })
    }
    // From 1280 px the groups are a column at the left, always in sight, as translationCore 4's groups menu
    // (principle 13); on a narrower screen they are chosen in a sheet.
    const wider = useWider()
    // The window grown wide shows the column, and the sheet is done with: narrowed again, it does not come back by itself.
    useEffect(() => {
      if (wider) setChoosing(false)
    }, [wider])
    // From one note (or word) to the next by the keyboard: here they are what the position line is elsewhere.
    useKey('previous', previous ? () => go(previous) : null)
    useKey('next', following ? () => go(following) : null)
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
        {wider ? (
          <span className="review-filter-name">{filterLabel}</span>
        ) : (
          <button type="button" className="chip review-filter" onClick={() => setChoosing(true)}>
            {filterLabel} ▾
          </button>
        )}
        <div className="review-steps">
          <button type="button" className="pager-arrow" disabled={!previous} onClick={() => go(previous)} aria-label={t(k('anterior'))} title={t('marco.conAtajo', { accion: t(k('anterior')), atajo: KEYS.previous })}>
            ‹
          </button>
          <span className="quiet">{item ? t(k('notaN'), { n: at + 1, total: list.length }) : list.length}</span>
          <button type="button" className="pager-arrow" disabled={!following} onClick={() => go(following)} aria-label={t(k('siguiente'))} title={t('marco.conAtajo', { accion: t(k('siguiente')), atajo: KEYS.next })}>
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
    const groups = (
        <div className="review-groups">
          {row({ kind: 'todas' }, t(k('todasVersiculos')))}
          {(['elegir', 'despues', 'cambio'] as const).map((s) => all.some((c) => stateFor(c) === s) && row({ kind: 'estado', id: s }, t(k(`estado.${s}`))))}
          {kind.groups
            .filter((g) => all.some((c) => c.group === g))
            .map((g) => {
              const subs = [...new Set(all.filter((c) => c.group === g).map((c) => c.subgroup))]
              // A category with one figure of its own name («Numbers») would show the same row twice: once is enough.
              const same = subs.length === 1 && kind.subgroupName(subgroupOf(subs[0])!, lookup) === t(k(`cat.${g}`))
              return (
                <section key={g} className="review-category">
                  {row({ kind: 'categoria', id: g }, t(k(`cat.${g}`)))}
                  {!same && subs.map((sub) => row({ kind: 'figura', id: sub }, kind.subgroupName(subgroupOf(sub)!, lookup)))}
                </section>
              )
            })}
        </div>
    )
    const picker = choosing && !wider && (
      <Sheet title={t(k('revisarPor'))} onClose={() => setChoosing(false)}>
        {groups}
      </Sheet>
    )
    // The reviewer, with the groups beside it where the window is wide enough. The same elements at every width (the
    // narrow wrapper is `display: contents`): a window widened or narrowed past 1280 px keeps the step and the words
    // marked, rather than starting the check again.
    const withGroups = (body: ReactNode) => (
      <div className={wider ? 'review-with-groups' : 'review-alone'}>
        {wider ? (
          <nav className="review-side" aria-label={t(k('revisarPor'))}>
            <h2 className="pane-side-title">{t(k('revisarPor'))}</h2>
            {groups}
          </nav>
        ) : null}
        {body}
      </div>
    )

    if (finished) {
      const missing = all.filter((c) => stateFor(c) !== 'bien')
      return withGroups(
        <div className="review">
          {header}
          <div className="review-empty">
            <p className="review-done">
              ✓ {filter.kind === 'todas' ? t(k('listas'), { n: list.length }) : t(k('grupoListo'), { grupo: filterLabel, n: list.length })}
            </p>
            {/* A group done, with others left in the book: on to them. All done: back to the book, to its next step. */}
            {filter.kind !== 'todas' && missing.length > 0 ? (
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setFilter({ kind: 'todas' })
                  setFinished(false)
                  go(missing[0])
                }}
              >
                {t(k('seguirFaltan'), { n: missing.length })}
              </button>
            ) : (
              <button type="button" className="button-primary" onClick={frame.back}>
                {t('marco.listoVolver', { libro: context.bookTitle })}
              </button>
            )}
            <button type="button" className="button-secondary" onClick={() => setFinished(false)}>
              {t(k('verUltima'))}
            </button>
          </div>
          {picker}
        </div>
      )
    }

    const data = item ? chapterData(item.chapter) : null
    if (!item || !data) {
      return withGroups(
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

    return withGroups(
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
            // «Right» goes on to the next one left (after it, or else one passed over before it); the others stay on
            // screen, to be seen as saved. None left: the end.
            if (check.status !== 'bien') return
            const rest = [...list.slice(at + 1), ...list.slice(0, at)].find((c) => c.id !== item.id && stateFor(c) !== 'bien')
            if (rest) go(rest)
            else setFinished(true)
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
  // Its note changed since it was answered (a newer pack), the verse being the same: the words marked still stand,
  // and the note is read again from the start.
  const noteChanged = Boolean(before?.noteChanged) && before!.verseText.trim() === verseText.trim()
  // The words chosen before still point at the same words only while the verse is the same.
  const kept = before && (state !== 'cambio' || noteChanged) ? before : null
  // Back from the editor: at the step it was opened from, with the words marked, if the verse is the same; at marking
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
  // Answered, it opens at its answer; its verse changed, at marking the words again; else at reading the source.
  const [step, setStep] = useState<Step>(back ? (back.same ? back.step : 3) : noteChanged ? 1 : kept ? 4 : state === 'cambio' ? 3 : 1)
  const [reached, setReached] = useState<Step>(step)
  // The second step of a kind that asks it read through is not done until it says so.
  const [ready, setReady] = useState(!kind.gated)
  const [later, setLater] = useState(false)
  const [reason, setReason] = useState<'equipo' | 'investigar'>(before?.reason ?? 'equipo')
  const [comment, setComment] = useState(before?.comment ?? '')
  // Two answers given apart on this verse: which stays is chosen first, as two versions of a verse are.
  const options = answersToChoose(before, verseText)
  const [choice, setChoice] = useState<number | null>(null)
  const chosen = notThere || picked.length > 0
  const correct = () => {
    leftAt.set(leftKey, { step, picked, notThere, verseText })
    onCorrect()
  }
  const goStep = (s: Step) => {
    setStep(s)
    setLater(false)
    setReached((r) => (s > r ? s : r))
  }
  // Each step is read from its top.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [step, scroller])
  // Why it waits is asked under what was compared: brought into sight when asked.
  const laterBox = useRef<HTMLElement>(null)
  useEffect(() => {
    if (later) laterBox.current?.scrollIntoView({ block: 'nearest' })
  }, [later])
  // From the third step on, a wide window keeps what was read beside what is done (principle 13).
  const wide = useWide()
  const beside = wide && step >= 3

  // The source is a bridge text: the original is read in the study.
  const sources = data.texts.filter((x) => !x.original)
  const shown = sources.find((x) => x.abbreviation === refText) ?? sources[0] ?? data.texts[0]
  const name = kind.subgroupName(item, lookup)
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
  // The answer chosen is the one shown from now on: its words marked, its reason and comment.
  const keep = (o: NoteCheck) => {
    setPicked(o.words)
    setNotThere(Boolean(o.notThere))
    setReason(o.reason ?? 'equipo')
    setComment(o.comment ?? '')
    setChoice(null)
    onAnswer(o)
  }
  const lit = (around: number) => (
    <Lit text={shown} verse={item.verse} places={item.places[shown.abbreviation]} around={around} fallback={kind.quoteOf(item, shown)} />
  )
  const props = { item, data, quote: lit(0), lookup, context }
  const source = (
    <SourceBox
      app={kind.app}
      texts={sources}
      shown={shown}
      onShow={onRefText}
      chapter={item.chapter}
      verse={item.verse}
      places={item.places}
      section={data.sections.find((s) => s.includes(item.verse))}
    />
  )
  const here = notThere ? '' : renderingOf(words, picked)
  const question = kind.question(item, { all, renderingAt, here, notThere, lookup, language: context.project.languageName })
  const mine = (
    <p className="review-mine-verse">
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {picked.includes(i) && !notThere ? <mark>{w}</mark> : w}
        </span>
      ))}
    </p>
  )

  // The one button on, at the foot: what leads to the next step; at the last, the answer most given. While writing why
  // it waits, saving that is the one thing.
  const foot: { label: string; run(): void; off: boolean; hint?: string } =
    step === 1
      ? { label: t(k('aEntender'), { palabra: name }), run: () => goStep(2), off: false }
      : step === 2
        ? { label: t(k('aBuscar')), run: () => goStep(3), off: !ready, hint: t(k('primeroArticulo')) }
        : step === 3
          ? words.length
            ? { label: t(k('aDecidir')), run: () => goStep(4), off: !chosen, hint: t(k('primeroElija')) }
            : { label: t(k('traducirAhora')), run: correct, off: false }
          : later
            ? {
                label: t(k('guardarDespues')),
                run: () => {
                  answer('despues')
                  setLater(false)
                },
                off: false,
              }
            : // With two answers given apart to choose from, keeping the one touched is the one thing.
              options.length
              ? { label: t(k('quedarseCon')), run: () => choice !== null && keep(options[choice]), off: choice === null }
              : { label: t(k('siBien')), run: () => answer('bien'), off: false }

  const read = (
    <>
      {noteChanged && <p className="notice">{t('cambios.revisionNota')}</p>}
      <p className="review-instruction">{t(k('leaTexto'))}</p>
      {source}
    </>
  )
  const mark = (
    <>
      <p className="review-instruction">{t(k('marqueAqui'))}</p>
      {/* What to look for, in a line: beside the source in a wide window, it is not needed. */}
      {!beside && (
        <p className="review-recall">
          <span className="review-recall-text">{shown.abbreviation}</span>
          {lit(kind.around ?? 0)}
        </p>
      )}
      {state === 'cambio' && !noteChanged && <p className="notice">{t(k('cambio'))}</p>}
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
    </>
  )
  const confirm = (
    <>
      <p className="review-instruction">{t(k(question.key), question.values)}</p>
      <dl className="review-pair">
        <dt>{shown.abbreviation}</dt>
        <dd>{lit(kind.around ?? 0)}</dd>
        <dt>{context.project.languageName}</dt>
        <dd>{notThere ? <span className="quiet">{t(k('marcoNoEsta'))}</span> : <mark className="review-pair-mine">{here}</mark>}</dd>
      </dl>
      <kind.Against {...props} aside={beside} here={here} all={all} renderingAt={renderingAt} go={go} book={book} />
      <Fold label={t(k('verVersiculo'))}>{mine}</Fold>
      {state === 'bien' && before && <p className="review-done">✓ {t(k('quedoBien'), { nombre: before.by })}</p>}
      {state === 'despues' && before && (
        <p className="status">
          {t(k('paraDespues'), { razon: t(k(`razon.${before.reason ?? 'equipo'}`)), nombre: before.by })}
          {before.comment ? ` «${before.comment}»` : ''}
        </p>
      )}
      {/* The other answers, under what they answer: the foot keeps only the one most given, so what is compared has the
          room of the screen. */}
      {!later && (
        <div className="review-other-answers">
          <button type="button" className="button-secondary" onClick={correct}>
            {t(k('corregirAhora'))}
          </button>
          <button type="button" className="button-secondary" onClick={() => setLater(true)}>
            {t(k('corregirDespues'))}
          </button>
        </div>
      )}
      {later && (
        <section className="review-later" ref={laterBox} aria-label={t(k('porQue'))}>
          <RowButton label={t(k('corregirDespues'))} kind="fold" expanded onClick={() => setLater(false)} />
          <div className="unit-switch" role="radiogroup" aria-label={t(k('porQue'))}>
            {(['equipo', 'investigar'] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className="unit-switch-option" onClick={() => setReason(r)}>
                {t(k(`razon.${r}`))}
              </button>
            ))}
          </div>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t(k('queVio'))} />
        </section>
      )}
    </>
  )
  // Two answers given apart on this verse, on two devices: which stays is chosen first, as two versions of a verse are.
  const choose = (
    <section className="versions" aria-label={t(k('elegirTitulo'))}>
      <p className="versions-ask">{t(k('elegirPregunta'))}</p>
      {options.map((o, i) => {
        const marked = new Set(o.words)
        return (
          <button key={i} type="button" className={choice === i ? 'version is-on' : 'version'} aria-pressed={choice === i} onClick={() => setChoice(i)}>
            <span className="version-who">
              <span className="version-dot" aria-hidden="true" />
              {o.by}
            </span>
            <span className="version-text">
              <strong>{o.status === 'bien' ? t(k('siBien')) : t(k('paraDespues'), { razon: t(k(`razon.${o.reason ?? 'equipo'}`)), nombre: o.by })}</strong>
              {o.comment ? ` «${o.comment}»` : ''}
            </span>
            <span className="version-text quiet">
              {o.notThere
                ? t(k('marcoNoEsta'))
                : words.map((w, j) => (
                    <span key={j}>
                      {j > 0 && ' '}
                      {marked.has(j) ? <mark>{w}</mark> : w}
                    </span>
                  ))}
            </span>
          </button>
        )
      })}
      <p className="quiet versions-after">{t(k('elegirDespues'))}</p>
    </section>
  )
  const body = step === 1 ? read : step === 2 ? <kind.Read {...props} onReady={setReady} /> : step === 3 ? mark : options.length ? choose : confirm

  return (
    <>
      <div className="review-scroll" ref={scroller}>
        <ol className="review-stepper">
          {STEPS.map((s) => (
            <li key={s}>
              <button
                type="button"
                aria-current={s === step ? 'step' : undefined}
                className={s < reached || (s === 4 && state === 'bien') ? 'is-done' : undefined}
                disabled={s > reached}
                onClick={() => goStep(s)}
              >
                <span className="review-stepper-n">{s}</span>
                {t(k(`paso${s}`))}
              </button>
            </li>
          ))}
        </ol>
        {beside ? (
          <div className="review-beside">
            <section className="review-read" aria-label={t(k('loLeido'))}>
              {source}
              <kind.Read {...props} aside />
            </section>
            <section className="review-do">{body}</section>
          </div>
        ) : (
          body
        )}
      </div>
      <div className="review-next">
        <button type="button" className="button-primary" disabled={foot.off} onClick={foot.run}>
          {foot.label}
        </button>
        {foot.off && foot.hint && <p className="quiet review-hint">{foot.hint}</p>}
      </div>
    </>
  )
}

/** Something more to read, unfolded here: a row with ▾, and what it holds under it. */
export function Fold({ label, open: initially = false, onOpen, children }: { label: ReactNode; open?: boolean; onOpen?(): void; children: ReactNode }) {
  const [open, setOpen] = useState(initially)
  return (
    <div className="review-fold">
      <RowButton
        label={label}
        kind="fold"
        expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen(!open)
        }}
      />
      {open && <div className="review-fold-body">{children}</div>}
    </div>
  )
}

/**
 * What a help is about, lit, in a source text: its words alone, or with a few on each side (`around`), so one use of
 * a word is told from another in the same verse. Where its words in this text are not known, what the help says.
 */
export function Lit({ text, verse, places, around, fallback }: { text: PrototypeText; verse: number; places: number[] | undefined; around: number; fallback: string }) {
  const lit = new Set(places ?? [])
  const pieces = (text.lines[verse] ?? []).flatMap((line, i) => (i > 0 ? [{ text: ' ' }, ...line.pieces] : line.pieces))
  const at = pieces.flatMap((p, i) => (p.word !== undefined && lit.has(p.word) ? [i] : []))
  if (!at.length) {
    const said = wordsOf(text, places) || fallback
    return said ? (
      <span className="review-lit" lang={text.lang} dir={text.dir ?? 'ltr'}>
        <mark>{said}</mark>
      </span>
    ) : null
  }
  // From `around` words before the first lit to as many after the last.
  const reach = (from: number, by: -1 | 1) => {
    let i = from
    for (let n = 0; n < around; ) {
      const next = i + by
      if (next < 0 || next >= pieces.length) break
      i = next
      if (pieces[i].word !== undefined) n++
    }
    return i
  }
  const first = reach(at[0], -1)
  const last = reach(at[at.length - 1], 1)
  const shown = pieces.slice(first, last + 1)
  // The words alone: those left out between two lit ones are said by «…», as everywhere else.
  if (!around) {
    return (
      <span className="review-lit" lang={text.lang} dir={text.dir ?? 'ltr'}>
        <mark>{wordsOf(text, places)}</mark>
      </span>
    )
  }
  return (
    <span className="review-lit" lang={text.lang} dir={text.dir ?? 'ltr'}>
      {first > 0 && '… '}
      {shown.map((p, i) => (p.word !== undefined && lit.has(p.word) ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
      {last < pieces.length - 1 && ' …'}
    </span>
  )
}

/**
 * The source text of a verse, its words lit: pills choose the bridge text, and a finger slid sideways over the box
 * takes the words along with it and brings the next text in from the side it goes to, as the panes do. One going up
 * or down still scrolls (touch-action: pan-y). The rest of its section unfolds under it, the verse lit among them.
 */
export function SourceBox({
  app,
  texts,
  shown,
  onShow,
  chapter,
  verse,
  places,
  section,
}: {
  app: string
  texts: PrototypeText[]
  shown: PrototypeText
  onShow(abbreviation: string): void
  chapter: number
  verse: number
  places: Places
  /** The verses of the section the verse is in. */
  section?: number[]
}) {
  const t = useT()
  const [drag, setDrag] = useState(0)
  const [enter, setEnter] = useState<'next' | 'back' | null>(null)
  const [whole, setWhole] = useState(false)
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null)
  // A swipe begun on a pill ends in a click on it, which is not a choice of its own.
  const swiped = useRef(false)
  const at = texts.indexOf(shown)
  const show = (to: number) => {
    const x = texts[to]
    if (!x || to === at) return
    setEnter(to > at ? 'next' : 'back')
    onShow(x.abbreviation)
  }
  const lit = new Set(places[shown.abbreviation] ?? [])
  const others = section && section.length > 1 ? section : null
  const verses = whole && others ? others : [verse]
  return (
    <section
      className="review-quote"
      aria-label={t(`${app}.textoFuente`)}
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
        const edge = (dx > 0 && at === 0) || (dx < 0 && at === texts.length - 1)
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
      {texts.length > 1 && (
        <div className="review-quote-switch" role="radiogroup" aria-label={t(`${app}.textoFuente`)}>
          {texts.map((x, i) => (
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
              {x.abbreviation}
            </button>
          ))}
        </div>
      )}
      <div
        key={shown.abbreviation}
        className={['review-quote-text', 'is-verse', enter && `is-entering-${enter}`].filter(Boolean).join(' ')}
        dir={shown.dir ?? 'ltr'}
        lang={shown.lang}
        style={drag ? { transform: `translateX(${drag}px)`, opacity: 1 - Math.min(Math.abs(drag) / 400, 0.4), transition: 'none' } : undefined}
      >
        {verses.map((v) => (
          <div key={v} className={v === verse ? 'review-verse' : 'review-verse is-context'}>
            <WordLines lines={shown.lines[v] ?? []} verse={v} lit={v === verse ? lit : new Set()} onWord={() => {}} tabbable={false} />
          </div>
        ))}
        {!lit.size && <p className="quiet">{t(`${app}.sinAlinear`, { texto: shown.abbreviation })}</p>}
      </div>
      {others && (
        <RowButton
          label={t(`${app}.seccion`, { lugar: `${chapter}:${others[0]}–${others[others.length - 1]}` })}
          kind="fold"
          expanded={whole}
          onClick={() => setWhole(!whole)}
        />
      )}
    </section>
  )
}

/** The texts both reviewers share; each adds what is its own, and may say these its own way. */
export const checkingTexts = {
  es: {
    paso1: 'Leer',
    paso2: 'Entender',
    paso3: 'Marcar',
    paso4: 'Confirmar',
    leaTexto: 'Lea el texto con especial atención en lo resaltado.',
    textoFuente: 'Texto fuente',
    seccion: 'Leer toda la sección ({lugar})',
    marqueAqui: 'Toque o deslice el dedo sobre las palabras de su traducción que dicen esto:',
    'marqueAqui.computadora': 'Haga clic o arrastre el ratón sobre las palabras de su traducción que dicen esto:',
    verVersiculo: 'Ver el versículo entero',
    loLeido: 'Lo que leyó',
    primeroArticulo: 'Primero despliegue el artículo entero.',
    todas: 'Todas',
    revisarPor: 'Revisar por',
    hechas: '{hechas} de {total}',
    notaN: '{n} de {total}',
    ningunaAqui: 'Este versículo no tiene nada que revisar aquí.',
    ningunaDelGrupo: 'Este versículo no tiene nada de «{grupo}».',
    irSiguiente: 'Ir al siguiente ({lugar})',
    listas: 'Quedaron revisadas todas: {n}.',
    grupoListo: 'Quedaron revisadas todas las de «{grupo}»: {n}.',
    seguirFaltan: 'Seguir con las que faltan ({n})',
    verUltima: 'Volver a la última',
    sinAlinear: 'No se sabe qué palabras del {texto} son.',
    noEsta: 'No está en mi traducción',
    sinTraducir: 'Este versículo todavía no está traducido.',
    primeroElija: 'Primero marque las palabras de su traducción, o que no está.',
    corregirAhora: 'Mejorarla ahora',
    traducirAhora: 'Traducirlo ahora',
    corregirDespues: 'Dejarla para después',
    porQue: 'Por qué después',
    'razon.equipo': 'Con el equipo',
    'razon.investigar': 'Investigarlo',
    queVio: 'Qué vio (opcional)',
    guardarDespues: 'Guardar para después',
    paraDespues: 'Para mejorar después: {razon} ({nombre}).',
    cambio: 'El versículo cambió desde que se revisó: revíselo otra vez.',
    'estado.despues': 'Para mejorar después',
    'estado.cambio': 'Por revisar otra vez',
    'estado.pendiente': 'Sin revisar',
    'estado.bien': 'Quedaron bien',
    aDecidir: 'Seguir',
    marcoNoEsta: 'Marcó que no está en su traducción.',
    'estado.elegir': 'Respondidas de dos maneras',
    elegirTitulo: 'Dos respuestas',
    elegirPregunta: 'Se respondió de dos maneras, en aparatos distintos. ¿Cuál queda?',
    quedarseCon: 'Quedarse con esta respuesta',
    elegirDespues: 'La que quede se puede cambiar después, como cualquier respuesta.',
  },
  pt: {
    paso1: 'Ler',
    paso2: 'Entender',
    paso3: 'Marcar',
    paso4: 'Confirmar',
    leaTexto: 'Leia o texto com atenção especial ao destacado.',
    textoFuente: 'Texto fonte',
    seccion: 'Ler toda a seção ({lugar})',
    marqueAqui: 'Toque ou deslize o dedo sobre as palavras da sua tradução que dizem isto:',
    'marqueAqui.computadora': 'Clique ou arraste o mouse sobre as palavras da sua tradução que dizem isto:',
    verVersiculo: 'Ver o versículo inteiro',
    loLeido: 'O que leu',
    primeroArticulo: 'Primeiro abra o artigo inteiro.',
    todas: 'Todas',
    revisarPor: 'Revisar por',
    hechas: '{hechas} de {total}',
    notaN: '{n} de {total}',
    ningunaAqui: 'Este versículo não tem nada para revisar aqui.',
    ningunaDelGrupo: 'Este versículo não tem nada de «{grupo}».',
    irSiguiente: 'Ir para o próximo ({lugar})',
    listas: 'Ficaram todas revisadas: {n}.',
    grupoListo: 'Ficaram revisadas todas as de «{grupo}»: {n}.',
    seguirFaltan: 'Seguir com as que faltam ({n})',
    verUltima: 'Voltar à última',
    sinAlinear: 'Não se sabe que palavras do {texto} são.',
    noEsta: 'Não está na minha tradução',
    sinTraducir: 'Este versículo ainda não está traduzido.',
    primeroElija: 'Primeiro marque as palavras da sua tradução, ou que não está.',
    corregirAhora: 'Melhorar agora',
    traducirAhora: 'Traduzir agora',
    corregirDespues: 'Deixar para depois',
    porQue: 'Por que depois',
    'razon.equipo': 'Com a equipe',
    'razon.investigar': 'Pesquisar',
    queVio: 'O que viu (opcional)',
    guardarDespues: 'Guardar para depois',
    paraDespues: 'Para melhorar depois: {razon} ({nombre}).',
    cambio: 'O versículo mudou desde que foi revisado: revise-o de novo.',
    'estado.despues': 'Para melhorar depois',
    'estado.cambio': 'Para revisar de novo',
    'estado.pendiente': 'Sem revisar',
    'estado.bien': 'Ficaram bem',
    aDecidir: 'Seguir',
    marcoNoEsta: 'Marcou que não está na sua tradução.',
    'estado.elegir': 'Respondidas de dois jeitos',
    elegirTitulo: 'Duas respostas',
    elegirPregunta: 'Foi respondida de dois jeitos, em aparelhos diferentes. Qual fica?',
    quedarseCon: 'Ficar com esta resposta',
    elegirDespues: 'A que ficar pode ser mudada depois, como qualquer resposta.',
  },
  en: {
    paso1: 'Read',
    paso2: 'Understand',
    paso3: 'Mark',
    paso4: 'Confirm',
    leaTexto: 'Read the text with special attention to what is highlighted.',
    textoFuente: 'Source text',
    seccion: 'Read the whole section ({lugar})',
    marqueAqui: 'Touch or slide your finger over the words of your translation that say this:',
    'marqueAqui.computadora': 'Click or drag the mouse over the words of your translation that say this:',
    verVersiculo: 'See the whole verse',
    loLeido: 'What you read',
    primeroArticulo: 'First open the whole article.',
    todas: 'All',
    revisarPor: 'Check by',
    hechas: '{hechas} of {total}',
    notaN: '{n} of {total}',
    ningunaAqui: 'This verse has nothing to check here.',
    ningunaDelGrupo: 'This verse has nothing of «{grupo}».',
    irSiguiente: 'Go to the next ({lugar})',
    listas: 'All checked: {n}.',
    grupoListo: 'All of «{grupo}» checked: {n}.',
    seguirFaltan: 'Go on with the ones left ({n})',
    verUltima: 'Back to the last one',
    sinAlinear: 'Which words of the {texto} these are is unknown.',
    noEsta: 'It is not in my translation',
    sinTraducir: 'This verse is not translated yet.',
    primeroElija: 'First mark the words of your translation, or that it is not there.',
    corregirAhora: 'Improve it now',
    traducirAhora: 'Translate it now',
    corregirDespues: 'Leave it for later',
    porQue: 'Why later',
    'razon.equipo': 'With the team',
    'razon.investigar': 'Look into it',
    queVio: 'What you saw (optional)',
    guardarDespues: 'Save for later',
    paraDespues: 'To improve later: {razon} ({nombre}).',
    cambio: 'The verse changed since it was checked: check it again.',
    'estado.despues': 'To improve later',
    'estado.cambio': 'To check again',
    'estado.pendiente': 'Not checked',
    'estado.bien': 'Right',
    aDecidir: 'Continue',
    marcoNoEsta: 'You marked that it is not in your translation.',
    'estado.elegir': 'Answered two ways',
    elegirTitulo: 'Two answers',
    elegirPregunta: 'It was answered two ways, on different devices. Which one stays?',
    quedarseCon: 'Keep this answer',
    elegirDespues: 'The one that stays can be changed later, as any answer.',
  },
}
