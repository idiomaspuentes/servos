/**
 * A book, as translationCore 4 lays out where to go on (its home's «Continue →» and its screen for choosing a review
 * tool): first, where the person left off and one filled button to go on there; then the book's steps, from studying
 * to publishing, as tabs always in sight, each with how far it has gone; under the step chosen, a card for each of its
 * mini apps, with what it does, its progress in the whole book, the next verse to do and, folded, its progress chapter
 * by chapter (and, for the translation, who wrote each chapter, since a team may split a book and gather it on one
 * computer). What is used now and then (sharing the book, receiving work from another computer, the project's
 * glossary) is in «More».
 * Moving the book on to the next step is said plainly, at the foot of the step it is in; no step is closed to the
 * person (philosophy, principle 5). A book whose texts and helps are not on the phone says so, and how to get them
 * (principle 8).
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import type { MiniApp } from '../miniapps/contract'
import { miniApp } from '../miniapps/registry'
import { PHASES, bookName, titleOf, type BookEntry, type Phase, type Project } from '../projects/model'
import { doneIn as doneInBook, percent as pct, placeLabel, stepPercent, versesOf } from '../projects/progress'
import { versesToChoose } from '../projects/versions'
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
  onGlossary,
  onReceiveWork,
  onChooseVersions,
  person,
  lastApp,
  placeFor,
}: {
  project: Project
  book: BookEntry
  /** The book's chapters whose texts and helps are on this phone, in order. */
  chapters: PrototypeData[]
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
  /** Goes through the verses that came written another way, to keep one version of each. */
  onChooseVersions(): void
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

  const resumeAt = current ? placeFor(current.id) : null
  const toChoose = versesToChoose(book.code, chapters.map((c) => ({ chapter: c.chapter, verses: versesOf(c) }))).length
  const shownAt = PHASES.indexOf(shown)
  const shownApps = appsOf(shown)

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
        {!book.name && (
          // Once, until the team names it: its name is the team's, in its language.
          <button type="button" className="button-quiet book-name-ask" onClick={() => setNaming(true)}>
            {t('libro.nombrarPregunta', { libro: source, idioma: project.languageName })}
          </button>
        )}
        {!chapters.length ? (
          <>
            <p className="notice">{t('libro.faltaPaquete', { libro: name })}</p>
            <button type="button" className="button-primary" onClick={onReceive}>
              {t('libro.recibirPaquete')}
            </button>
          </>
        ) : (
          current && (
            // Where the person left off, and the one filled button of the screen to go on there.
            <section className="book-resume" aria-label={t(resumeAt ? 'libro.sigaDonde' : 'libro.empieceAqui')}>
              <span className="book-resume-kicker">{t(resumeAt ? 'libro.sigaDonde' : 'libro.empieceAqui')}</span>
              <span className="book-resume-what">
                {t(`${current.id}.nombre`)}
                {resumeAt && ` · ${placeName(resumeAt)}`}
              </span>
              <button type="button" className="button-primary" onClick={() => onOpen(current)}>
                {t(resumeAt ? 'libro.continuar' : 'libro.empezar')} →
              </button>
            </section>
          )
        )}

        {toChoose > 0 && (
          // Work received that came written another way: said where the book opens, with the way to choose.
          <section className="book-choose">
            <strong>{t('libro.dosVersiones', { n: toChoose })}</strong>
            <span className="quiet">{t('libro.dosVersionesAyuda')}</span>
            <button type="button" className="button-secondary" onClick={onChooseVersions}>
              {t('libro.elegir')} →
            </button>
          </section>
        )}

        {/* The steps, always in sight as tabs, each with how far it has gone; the one the book is in, marked. */}
        <div className="book-steps" role="tablist" aria-label={t('libro.pasos')}>
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
                {/* A short name, so the five fit in two lines on a phone; the whole one is said under them. */}
                <span>{t(`pasos.${phase}Corto`)}</span>
                <span className={i < at || p === 100 ? 'book-step-state is-done' : 'book-step-state'}>{i < at || p === 100 ? '✓' : p !== null && p > 0 ? `${p} %` : ''}</span>
              </button>
            )
          })}
        </div>
        <p className="quiet book-step-about">
          <strong>{t(`pasos.${shown}`)}:</strong> {t(`pasos.${shown}Ayuda`)}
          {shownAt === at && ` · ${t('pasos.enCurso')}`}
        </p>

        {shownApps.length === 0 && <p className="quiet">{t('libro.ningunaApp')}</p>}
        <ul className="tool-cards">
          {shownApps.map((app) => {
            const done = app.done ? doneOf(app) : null
            const next = app.done ? nextOf(app) : null
            const place = placeFor(app.id)
            const go = app.comingSoon ? null : done !== null && !next ? 'libro.ver' : place ? 'libro.continuar' : 'libro.empezar'
            const open = byChapter === app.id
            return (
              <li key={app.id} className={app === current ? 'tool-card is-current' : 'tool-card'}>
                <button type="button" className="tool-card-main" disabled={app.comingSoon || !chapters.length} onClick={() => onOpen(app)}>
                  <span className="tool-card-head">
                    <span className="tool-card-name">
                      {t(`${app.id}.nombre`)}
                      {app.comingSoon && <span className="badge">{t('catalogo.pronto')}</span>}
                    </span>
                    {go && <span className="tool-card-go">{t(go)} →</span>}
                  </span>
                  <span className="quiet">{t(`${app.id}.descripcion`)}</span>
                  {done !== null && totalVerses > 0 && (
                    <span className="tool-progress">
                      {bar(done, totalVerses)}
                      <span>{t('libro.avance', { hechos: done, total: totalVerses, pct: pct(done, totalVerses) })}</span>
                    </span>
                  )}
                </button>
                {done !== null && chapters.length > 0 && (
                  <div className="tool-card-foot">
                    <span className="quiet">{next ? t('libro.siguiente', { lugar: placeName(next) }) : t('libro.todoHecho')}</span>
                    <button type="button" className="button-quiet" aria-expanded={open} onClick={() => setByChapter(open ? null : app.id)}>
                      {t('libro.porCapitulo')} {open ? '▴' : '▾'}
                    </button>
                  </div>
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
          })}
        </ul>

        {/* Moving the book on, said plainly, at the foot of the step it is in; or back, or ahead, from another. */}
        {shownAt === at && at < PHASES.length - 1 && (
          <button type="button" className="button-quiet book-pass" onClick={() => onPhase(PHASES[at + 1])}>
            {t('libro.terminadoPasar', { paso: t(`pasos.${shown}`), siguiente: t(`pasos.${PHASES[at + 1]}`) })} ›
          </button>
        )}
        {shownAt !== at && (
          <button type="button" className="button-quiet book-pass" onClick={() => onPhase(shown)}>
            {shownAt < at ? `‹ ${t('libro.volverA', { paso: t(`pasos.${shown}`) })}` : `${t('libro.pasarA', { paso: t(`pasos.${shown}`) })} ›`}
          </button>
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
                const saved = await saveFile(`${book.code.toUpperCase()}.usfm`, bookUsfm(book.code, project.name, chapters, 'TPL', book.name), 'text/plain')
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
