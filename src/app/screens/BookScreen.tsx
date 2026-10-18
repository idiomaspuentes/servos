/**
 * A book, as translationCore 4 lays out where to go on (its home's «Continue →» and its screen for choosing a review
 * tool), with one thing to do in sight: the book's steps, from studying to publishing, in one row that slides, each with
 * how far it has gone; under the step chosen, the mini app to go on with as the one card, with where the person left it,
 * its progress in the whole book, the one filled button and, folded, its progress chapter by chapter (and, for the
 * translation, who wrote each chapter, since a team may split a book and gather it on one computer); the step's other
 * mini apps, one row each. What is used now and then (sharing the book, receiving work from another computer, the
 * project's glossary, naming the book, moving it on before its step is done) is in «More».
 * Moving the book on is said plainly at the foot of its step once the step is nearly done; no step is closed to the
 * person (philosophy, principle 5). A book whose texts and helps are not on the phone says so, and how to get them
 * (principle 8).
 */

import type { BookState } from '../projects/library'
import { useEffect, useRef, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { RowButton, Suggestion } from '../frame/Actions'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import type { MiniApp } from '../miniapps/contract'
import { miniApp } from '../miniapps/registry'
import { PHASES, bookName, titleOf, type BookEntry, type Phase, type Project } from '../projects/model'
import { doneIn as doneInBook, percent as pct, placeLabel, stepPercent, versesOf } from '../projects/progress'
import { namesTogether } from '../projects/mix'
import { sectionsToGather, versesToChoose, versionsFrom } from '../projects/versions'
import { workOf } from '../projects/work'
import { saveFile } from '../frame/saveFile'
import { bookUsfm } from '../projects/usfmExport'
import { ShareSheet } from './ShareSheet'

type Place = { chapter: number; verse: number }

export function BookScreen({
  project,
  book,
  chapters,
  onBack,
  onOpen,
  onPhase,
  onName,
  onReceive,
  state,
  onGlossary,
  onReceiveWork,
  onChooseVersions,
  onTogether,
  onTeamWork,
  person,
  lastApp,
  placeFor,
}: {
  project: Project
  book: BookEntry
  /** The book's chapters whose texts and helps are on this phone, in order. */
  chapters: PrototypeData[]
  /** How the book stands on this device: being read, not here (projects/library.ts). */
  state?: BookState
  onBack(): void
  /** Opens a mini app where the person left off, or at a chapter. */
  onOpen(app: MiniApp, chapter?: number): void
  onPhase(phase: Phase): void
  /** The book's name as the team says it (empty: as the bridge text names it). */
  onName(name: string): void
  onReceive(): void
  /** The project's glossary, shared by all its books. */
  onGlossary(): void
  /** Receives work shared from another computer into this book's project. */
  onReceiveWork(): void
  /** Goes through the verses that came written another way, to keep one version of each or a mix. */
  onChooseVersions(): void
  /** How the team works on the book: everyone the same (to bring together) or each a part. */
  onTogether(together: boolean): void
  /** Leaves this phone's work on Door43 and brings in what the others left there. */
  onTeamWork(): void
  person: string
  /** The mini app the person last opened from this book. */
  lastApp?: string | null
  /** Where the person left a mini app in this book, if they opened it. */
  placeFor(app: string): Place | null
}) {
  const t = useT()
  // The book as the team named it in its language; the bridge text's name, until then and beside it.
  const name = titleOf(project, book.code)
  const source = bookName(book.code)
  const [naming, setNaming] = useState(false)
  // «Not now» to naming the book is kept by book: the suggestion does not come back; «More» still offers it.
  const declinedKey = `servos.prototipo.sugerencia.nombre.${project.id}.${book.code}`
  const [declined, setDeclined] = useState(() => {
    try {
      return localStorage.getItem(declinedKey) === '1'
    } catch {
      return false
    }
  })
  const at = PHASES.indexOf(book.phase)
  const appsOf = (phase: Phase) => project.miniApps[phase].map((id) => miniApp(id)).filter((a): a is MiniApp => Boolean(a))
  const allApps = PHASES.flatMap((p) => appsOf(p)).filter((a) => !a.comingSoon)
  // Where «Continue» goes: the mini app last worked in, if the project still uses it, or else the first of the step
  // the book is in.
  const current = allApps.find((a) => a.id === lastApp) ?? appsOf(book.phase).find((a) => !a.comingSoon)
  // The step shown: the one of the mini app last worked in, so its card is in sight.
  const [shown, setShown] = useState<Phase>(current?.phase ?? book.phase)
  const [byChapter, setByChapter] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [saidMore, setSaidMore] = useState<string | null>(null)

  const isDone = (app: MiniApp, chapter: number, verse: number) => app.done!({ book: book.code, chapter, verse })
  const doneIn = (app: MiniApp, c: PrototypeData) => doneInBook(app, book.code, c)
  const totalVerses = chapters.reduce((n, c) => n + c.verses.length, 0)
  const doneOf = (app: MiniApp) => chapters.reduce((n, c) => n + doneIn(app, c), 0)
  const bar = (done: number, total: number) => (
    <span className="progress-bar" aria-hidden="true" data-full={(total > 0 && done >= total) || undefined}>
      <span style={{ width: `${total ? (100 * done) / total : 0}%` }} />
    </span>
  )
  const placeName = (p: Place) => placeLabel(t, name, p)
  /** The first verse of the book a mini app has still to do. */
  const nextOf = (app: MiniApp): Place | null => {
    for (const c of chapters) for (const v of versesOf(c)) if (!isDone(app, c.chapter, v)) return { chapter: c.chapter, verse: v }
    return null
  }
  const stepPct = (phase: Phase) => stepPercent(project, book.code, phase, chapters)

  const toChoose = versesToChoose(book.code, chapters.map((c) => ({ chapter: c.chapter, verses: versesOf(c) }))).length
  // Everyone translated the same: what waits is said by section, with whose versions came.
  const toGather = book.together && toChoose ? sectionsToGather(book.code, chapters.map((c) => ({ chapter: c.chapter, verses: versesOf(c), sections: c.sections }))) : []
  const shownAt = PHASES.indexOf(shown)
  const shownApps = appsOf(shown)
  // The one card of the step shown: the mini app last worked in, or else the step's first that can be opened.
  const lead = shownApps.find((a) => a === current) ?? shownApps.find((a) => !a.comingSoon)
  // Moving the book on is offered at the foot once its step is nearly done (or cannot be measured); before, in «More».
  const atPct = stepPct(book.phase)
  // Not while the book has no texts on this device: nothing of it can be done yet, nor finished.
  const moveOnInSight = chapters.length > 0 && (atPct === null || atPct >= 90)
  const nextPhase = at < PHASES.length - 1 ? PHASES[at + 1] : null
  const moveOnLabel = nextPhase ? `${t('libro.terminadoPasar', { paso: t(`pasos.${book.phase}`), siguiente: t(`pasos.${nextPhase}`) })} →` : ''

  // The steps slide in one row: the one shown is brought into sight, and with it, where it fits, the one the book is
  // in; the row moves only as much as that needs (centring the shown one hid the book's own step).
  const stepsRef = useRef<HTMLDivElement>(null)
  // Which ends of the row have steps out of sight: those ends fade, so it is seen that the row goes on.
  const [hidden, setHidden] = useState<{ start: boolean; end: boolean }>({ start: false, end: false })
  const measureSteps = () => {
    const row = stepsRef.current
    if (!row) return
    const start = row.scrollLeft > 2
    const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 2
    setHidden((h) => (h.start === start && h.end === end ? h : { start, end }))
  }
  useEffect(() => {
    const row = stepsRef.current
    const on = row?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (row && on) {
      const box = row.getBoundingClientRect()
      const span = (e: HTMLElement) => {
        const r = e.getBoundingClientRect()
        return [r.left - box.left + row.scrollLeft, r.right - box.left + row.scrollLeft]
      }
      const pad = 24
      const [onFrom, onTo] = span(on)
      const book = row.querySelector<HTMLElement>('.is-current')
      const [bookFrom, bookTo] = book ? span(book) : [onFrom, onTo]
      const both = Math.max(onTo, bookTo) - Math.min(onFrom, bookFrom) <= row.clientWidth - 2 * pad
      const [from, to] = both ? [Math.min(onFrom, bookFrom), Math.max(onTo, bookTo)] : [onFrom, onTo]
      if (from - pad < row.scrollLeft) row.scrollLeft = Math.max(0, from - pad)
      else if (to + pad > row.scrollLeft + row.clientWidth) row.scrollLeft = to + pad - row.clientWidth
    }
    measureSteps()
  }, [shown])
  useEffect(() => {
    window.addEventListener('resize', measureSteps)
    return () => window.removeEventListener('resize', measureSteps)
  }, [])

  const leadCard = (app: MiniApp) => {
    const done = app.done ? doneOf(app) : null
    const next = app.done ? nextOf(app) : null
    const used = placeFor(app.id)
    // A mini app that does not go by verses (publishing) has no verse to say.
    const place = app.positionLine === false ? null : used
    const allDone = done !== null && chapters.length > 0 && !next
    const go = allDone ? 'libro.ver' : used ? 'libro.continuar' : 'libro.empezar'
    const open = byChapter === app.id
    return (
      <li key={app.id} className="tool-card">
        <div className="tool-card-main">
          <span className="tool-card-name">{t(`${app.id}.nombre`)}</span>
          {/* One place, the one «Continue» goes to: where the person left it; never opened, what it is for. */}
          <span className="quiet">{allDone ? t('libro.todoHecho') : place ? t('libro.sigaEn', { lugar: placeName(place) }) : t(`${app.id}.descripcion`)}</span>
          {done !== null && totalVerses > 0 && (
            <span className="tool-progress">
              {bar(done, totalVerses)}
              <span>{t('libro.avance', { hechos: done, total: totalVerses, pct: pct(done, totalVerses) })}</span>
            </span>
          )}
          {/* Without the book's texts, receiving them is the one thing to do: no second filled button, even disabled. */}
          {chapters.length > 0 && (
            <button type="button" className="button-primary tool-card-go" onClick={() => onOpen(app)}>
              {t(go)} →
            </button>
          )}
        </div>
        {done !== null && chapters.length > 0 && (
          <RowButton kind="fold" label={t('libro.porCapitulo')} expanded={open} onClick={() => setByChapter(open ? null : app.id)} />
        )}
        {open && (
          <ul className="tool-chapters">
            {chapters.map((c) => {
              const n = doneIn(app, c)
              // Who wrote each chapter, for the translation: a team may split a book and gather it here.
              const work = app.phase === 'traduccion' ? workOf(book.code, c.chapter, versesOf(c)) : null
              return (
                <li key={c.chapter}>
                  <button type="button" className="tool-chapter" onClick={() => onOpen(app, c.chapter)}>
                    <span className="tool-chapter-name">{t('libro.capitulo', { n: c.chapter })}</span>
                    {bar(n, c.verses.length)}
                    <span className="tool-chapter-count">{t('libro.hechosDe', { hechos: n, total: c.verses.length, pct: pct(n, c.verses.length) })}</span>
                    {work && work.people.length > 0 && (
                      <span className="tool-chapter-people">{work.people.map(([who, k]) => t('libro.quien', { nombre: who, n: k })).join(' · ')}</span>
                    )}
                    {work && work.choices > 0 && <span className="tool-chapter-choices">{t('libro.paraElegir', { n: work.choices })}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.inicio')}
        </button>
        <div className="header-title">
          <span className="header-app">{name}</span>
          <span className="header-person">{book.name ? `${project.name} · ${source}` : project.name}</span>
        </div>
        <button type="button" className="button-quiet header-more" onClick={() => setMore(true)}>
          {t('libro.mas')}
        </button>
      </header>
      <main className="main">
        {!chapters.length && state?.state === 'loading' && (
          // Being read from this device: said as it goes, the chapter being read of how many.
          <p className="status" role="status">
            {state.total ? t('libro.preparandoCapitulo', { libro: name, n: Math.min(state.done + 1, state.total), total: state.total }) : t('libro.preparando', { libro: name })}
          </p>
        )}
        {!chapters.length && state?.state === 'error' && (
          <p className="notice" role="alert">
            {t('libro.noSeLeyo', { libro: name, error: state.message })}
          </p>
        )}
        {!chapters.length && (!state || state.state === 'missing' || state.state === 'error') && (
          <>
            <p className="notice">
              {t(state?.state === 'missing' && state.availability?.stale ? 'libro.paqueteAnterior' : 'libro.faltaPaquete', { libro: name })}
            </p>
            <button type="button" className="button-primary" onClick={onReceive}>
              {t('libro.recibirPaquete')}
            </button>
          </>
        )}

        {toChoose > 0 && (
          // Work received that came written another way: said where the book opens, with the way to choose.
          <section className="book-choose">
            <strong>{book.together ? t('libro.porJuntarTodos', { n: toGather.length }) : t('libro.porJuntar', { n: toChoose })}</strong>
            <span className="quiet">
              {book.together ? t('libro.porJuntarTodosAyuda', { nombres: namesTogether(versionsFrom(book.code, toGather), t('juntar.y')) }) : t('libro.porJuntarAyuda')}
            </span>
            <button type="button" className="button-secondary" onClick={onChooseVersions}>
              {t('libro.juntar')} →
            </button>
          </section>
        )}

        {/* The steps in one row that slides, each with how far it has gone; the one the book is in, marked. */}
        <div className="book-steps" role="tablist" aria-label={t('libro.pasos')}
          ref={stepsRef}
          onScroll={measureSteps}
          data-more-start={hidden.start || undefined}
          data-more-end={hidden.end || undefined}
        >
          {PHASES.map((phase, i) => {
            const p = stepPct(phase)
            return (
              <button
                key={phase}
                type="button"
                role="tab"
                aria-selected={phase === shown}
                className={i === at ? 'book-step is-current' : 'book-step'}
                onClick={() => {
                  setShown(phase)
                  setByChapter(null)
                }}
              >
                <span>{t(`pasos.${phase}Corto`)}</span>
                <span className={i < at || p === 100 ? 'book-step-state is-done' : 'book-step-state'}>{i < at || p === 100 ? '✓' : p !== null && p > 0 ? `${p} %` : ''}</span>
              </button>
            )
          })}
        </div>

        {/* Looking at another step than the book's: where the book is, said once, quietly (its step may be out of sight). */}
        {shownAt !== at && <p className="quiet book-where">{t('libro.estaEn', { paso: t(`pasos.${book.phase}`) })}</p>}
        {shownApps.length === 0 && <p className="quiet">{t('libro.ningunaApp')}</p>}
        <ul className="tool-cards">
          {lead && leadCard(lead)}
          {/* The step's other mini apps: a row each, with how far it has gone; opened, the row becomes the card. */}
          {shownApps
            .filter((app) => app !== lead)
            .map((app) =>
              app.comingSoon ? (
                <li key={app.id} className="tool-soon">
                  <span>{t(`${app.id}.nombre`)}</span>
                  <span className="badge">{t('catalogo.pronto')}</span>
                </li>
              ) : (
                <li key={app.id}>
                  <RowButton
                    label={t(`${app.id}.nombre`)}
                    meta={app.done && totalVerses > 0 ? `${pct(doneOf(app), totalVerses)} %` : undefined}
                    onClick={() => chapters.length && onOpen(app)}
                  />
                </li>
              )
            )}
        </ul>

        {/* Moving the book on, said plainly at the foot of its step once it is nearly done; or back, or ahead, from another. */}
        {shownAt === at && nextPhase && moveOnInSight && (
          <>
            <button type="button" className="button-secondary" onClick={() => onPhase(nextPhase)}>
              {moveOnLabel}
            </button>
            <p className="quiet step-note">{t('libro.pasoNota', { paso: t(`pasos.${nextPhase}`) })}</p>
          </>
        )}
        {shownAt !== at && (
          <>
            <button type="button" className="button-secondary" onClick={() => onPhase(shown)}>
              {shownAt < at ? `← ${t('libro.volverA', { paso: t(`pasos.${shown}`) })}` : `${t('libro.pasarA', { paso: t(`pasos.${shown}`) })} →`}
            </button>
            <p className="quiet step-note">{t('libro.pasoNota', { paso: t(`pasos.${shown}`) })}</p>
          </>
        )}

        {!book.name && !declined && chapters.length > 0 && (
          // Once, after the work, until the team names the book or says not now (principle 12).
          <Suggestion
            text={t('libro.nombrarPregunta', { libro: source, idioma: project.languageName })}
            action={t('libro.nombrarAccion')}
            onAction={() => setNaming(true)}
            onDismiss={() => {
              setDeclined(true)
              try {
                localStorage.setItem(declinedKey, '1')
              } catch {
                /* for this visit */
              }
            }}
          />
        )}
      </main>

      {more && (
        <Sheet
          title={t('libro.mas')}
          onClose={() => {
            setMore(false)
            setSaidMore(null)
          }}
        >
          <MenuRow
            label={t('libro.nombre')}
            description={book.name ? t('libro.nombreEs', { idioma: project.languageName, nombre: book.name }) : t('libro.nombreSinPoner', { libro: source })}
            onClick={() => {
              setMore(false)
              setNaming(true)
            }}
          />
          <MenuRow
            label={t('libro.compartir')}
            description={t('libro.compartirAyuda')}
            onClick={() => {
              setMore(false)
              setSharing(true)
            }}
          />
          {chapters.length > 0 && (
            <MenuRow
              label={t('libro.usfm')}
              description={t('libro.usfmAyuda')}
              onClick={async () => {
                const saved = await saveFile(`${book.code.toUpperCase()}.usfm`, bookUsfm(book.code, project.name, chapters, 'TPL', book.name, true), 'text/plain')
                setSaidMore(saved.state === 'saved' ? t('compartir.guardado', { archivo: saved.name }) : saved.state === 'declined' ? null : t('compartir.noGuardado'))
              }}
            />
          )}
          {saidMore && (
            <p className="status" role="status">
              {saidMore}
            </p>
          )}
          <MenuRow
            label={t('libro.recibirTrabajo')}
            description={t('libro.recibirTrabajoAyuda')}
            onClick={() => {
              setMore(false)
              onReceiveWork()
            }}
          />
          <MenuRow
            label={t('libro.equipoDoor43')}
            description={t('libro.equipoDoor43Ayuda')}
            onClick={() => {
              setMore(false)
              onTeamWork()
            }}
          />
          {/* How the team works on the book, chosen in place (principle 12, pills on a track); the line under it says
              what the one chosen means. */}
          <div className="menu-choice">
            <span className="menu-row-label" id="como-trabaja">
              {t('libro.comoTrabaja')}
            </span>
            <div className="choice-row" role="radiogroup" aria-labelledby="como-trabaja">
              {[false, true].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  role="radio"
                  aria-checked={Boolean(book.together) === on}
                  className={Boolean(book.together) === on ? 'choice is-on' : 'choice'}
                  onClick={() => onTogether(on)}
                >
                  {t(on ? 'libro.modoJuntos' : 'libro.modoRepartido')}
                </button>
              ))}
            </div>
            <span className="quiet">{t(book.together ? 'libro.modoJuntosAyuda' : 'libro.modoRepartidoAyuda')}</span>
          </div>
          {nextPhase && !moveOnInSight && (
            <MenuRow
              label={moveOnLabel}
              description={t('libro.pasoNota', { paso: t(`pasos.${nextPhase}`) })}
              onClick={() => {
                setMore(false)
                onPhase(nextPhase)
              }}
            />
          )}
          <MenuRow
            label={t('libro.glosario')}
            description={t('libro.glosarioAyuda')}
            onClick={() => {
              setMore(false)
              onGlossary()
            }}
          />
        </Sheet>
      )}

      {naming && (
        <BookNameSheet
          source={source}
          language={project.languageName}
          name={book.name ?? ''}
          onSave={(n) => {
            onName(n)
            setNaming(false)
          }}
          onClose={() => setNaming(false)}
        />
      )}
      {sharing && <ShareSheet project={project} books={[book.code]} person={person} onClose={() => setSharing(false)} />}
    </div>
  )
}

/** Naming the book as the team says it in its language: the bridge text's name beside it, so it is clear which one. */
function BookNameSheet({
  source,
  language,
  name,
  onSave,
  onClose,
}: {
  source: string
  language: string
  name: string
  onSave(name: string): void
  onClose(): void
}) {
  const t = useT()
  const [value, setValue] = useState(name)
  return (
    <Sheet title={t('libro.nombre')} onClose={onClose} dirty={value.trim() !== name.trim()}>
      <form
        className="glossary-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(value)
        }}
      >
        <label className="field">
          <span className="field-label">{t('libro.nombreComo', { libro: source, idioma: language })}</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={source} autoFocus enterKeyHint="done" />
        </label>
        <p className="quiet">{t('libro.nombreDonde')}</p>
        <button type="submit" className="button-primary" disabled={value.trim() === name.trim()}>
          {t('libro.nombreGuardar')}
        </button>
      </form>
    </Sheet>
  )
}
