/**
 * Receive a pack: choose the file, see what it brings, open it into this device's stores (`src/resources`); then the
 * projects' books are read from it again (projects/library.ts), and the screens show them.
 */

import { Fragment, useState } from 'react'
import { LEXICON_SUBJECTS } from '../../resources/companions'
import { bringsAnything, packAgainstDevice, type PackAgainstDevice, type PackResourceStanding } from '../../resources/freshness'
import { describePack, openingLeft, type PackSummary } from '../../resources/packs'
import { openResourceStores } from '../../resources/store'
import { RowButton } from '../frame/Actions'
import { useChangeSummary } from '../miniapps/editor/HelpsChanged'
import type { BookChanges } from '../projects/helpsWatch'
import { availabilityOf, copiesOnDevice, loadBook, onDevice } from '../projects/library'
import { openPackSeeingChanges } from '../projects/receiveHelps'
import { bookName, loadProjects } from '../projects/model'
import { useT } from '../i18n/i18n'

type Step =
  | { kind: 'choose' }
  /** What it brings, each resource against this device's copy (`freshness.ts`). */
  | { kind: 'summary'; bytes: Uint8Array; summary: PackSummary; file: string; against: PackAgainstDevice }
  /** Being opened: rows gone through of all, for a phone that takes a minute or two. */
  | { kind: 'opening'; summary: PackSummary; done: number; total: number }
  /**
   * Opened: the books it brought that can now be read, and those that wait for the originals; and the verses already
   * translated whose helps it changed (helpsChanges.ts).
   */
  | { kind: 'done'; summary: PackSummary; readable: string[]; waiting: string[]; changed: BookChanges[] }
  | { kind: 'error'; message: string }

/** How many changed verses the last step lists: the rest are marked in the editor all the same. */
const LISTED = 8

export function ReceivePack({
  onBack,
  onStudy,
  onOpenVerse,
}: {
  onBack(): void
  onStudy(): void
  /** Opens a verse of a project's book in the editor. */
  onOpenVerse(projectId: string, book: string, chapter: number, verse: number): void
}) {
  const t = useT()
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  // A pack whose opening did not end the last time (the app closed, the phone went off).
  const [left] = useState(openingLeft)

  // The books of the language a pack brings (not those of the originals it may carry).
  const booksOf = (s: PackSummary) => (s.books.length ? s.books : [...new Set(s.resources.filter((r) => !r.isOriginal).flatMap((r) => r.books))])
  const names = (books: string[]) => books.map(bookName).join(', ')
  const books = (s: PackSummary) => (s.kind === 'originals' ? t('paquete.losOriginales') : names(booksOf(s)) || t('paquete.todoElIdioma'))
  // A lexicon is titled by its language in the catalog («Español Latinoamericano»): it is said what it is.
  const titleOf = (r: PackSummary['resources'][number]) =>
    r.subject === LEXICON_SUBJECTS.greek ? t('paquete.lexicoGriego') : r.subject === LEXICON_SUBJECTS.hebrew ? t('paquete.lexicoHebreo') : r.title
  const doneText = (s: Extract<Step, { kind: 'done' }>) =>
    s.summary.kind === 'originals'
      ? t('paquete.listoOriginales')
      : s.readable.length
        ? t('paquete.listo', { libros: names(s.readable) })
        : s.waiting.length
          ? t('paquete.listoFaltanOriginales', { libros: names(s.waiting) })
          : t('paquete.listoAyudas')

  const standingText = (a: PackResourceStanding) => {
    if (a.stale) return t('paquete.estado.reemplaza')
    switch (a.standing) {
      case 'new':
        return t('paquete.estado.nuevo')
      case 'newer':
        return t(a.lacking.length ? 'paquete.estado.masNuevaIncompleta' : 'paquete.estado.masNueva')
      case 'same':
        return a.adds.length ? t('paquete.estado.mismaConLibros', { libros: names(a.adds) }) : t('paquete.estado.misma')
      case 'older':
        return t('paquete.estado.masVieja')
      default:
        return t('paquete.estado.otra')
    }
  }

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('paquete.titulo')}</span>
        </div>
        <span />
      </header>
      <main className="main">
        {step.kind === 'choose' && (
          <>
            {left && (
              <p className="notice" role="alert">
                {t('paquete.interrumpido', { archivo: left.files.join(', ') || t('paquete.unPaquete') })}
              </p>
            )}
            <p>{t('paquete.elegirAyuda')}</p>
            <label className="button-primary file-button">
              {t('paquete.elegir')}
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const bytes = new Uint8Array(await file.arrayBuffer())
                    const summary = await describePack(bytes)
                    const against = packAgainstDevice({ resources: summary.resources, books: summary.kind === 'book' ? summary.books : undefined }, copiesOnDevice())
                    setStep({ kind: 'summary', bytes, summary, file: file.name, against })
                  } catch (error) {
                    setStep({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
                  }
                }}
              />
            </label>
          </>
        )}

        {step.kind === 'summary' && (
          <>
            <p className="quiet">{step.file}</p>
            {/* Said first: it is what decides what can be done with the file. */}
            {step.summary.otherVersion && (
              <p className="notice" role="alert">
                {t('paquete.otraVersion')}
              </p>
            )}
            <h1>{t('paquete.trae')}</h1>
            <ul className="pack-list">
              {step.summary.resources.map((r) => {
                const standing = step.against.resources.find((a) => a.key === r.key)
                return (
                  <li key={r.key}>
                    <span className="pack-resource">
                      <strong>{titleOf(r)}</strong>
                      {standing && !step.summary.otherVersion && (
                        <span className={`badge${replaced(step.against, standing) || standing.standing === 'new' || standing.adds.length ? '' : ' badge-quiet'}`}>
                          {standingText(standing)}
                        </span>
                      )}
                    </span>
                    <span className="quiet">{r.key}</span>
                  </li>
                )
              })}
            </ul>
            <p>{t('paquete.libros', { libros: books(step.summary) })}</p>
            {!step.summary.otherVersion &&
              step.against.resources
                .filter((a) => a.lacking.length)
                .map((a) => {
                  const r = step.summary.resources.find((x) => x.key === a.key)!
                  const brought = r.books.filter((b) => !a.lacking.includes(b) && (step.summary.kind !== 'book' || step.summary.books.includes(b)))
                  return (
                    <p key={a.key} className="notice">
                      {t('paquete.faltanLibros', { recurso: titleOf(r), libros: names(brought), faltan: names(a.lacking) })}
                    </p>
                  )
                })}
            {!step.summary.otherVersion && !bringsAnything(step.against) && <p role="status">{t('paquete.nadaNuevo')}</p>}
            {!step.summary.otherVersion && step.summary.needs.some((n) => !onDevice(n.key)) && (
              <p className="notice">{t('paquete.necesitaOriginales')}</p>
            )}
            {!step.summary.otherVersion && step.against.replace.length > 0 && <p className="quiet">{t('paquete.trabajoNoCambia')}</p>}
            {!step.summary.otherVersion && (bringsAnything(step.against) || step.against.resources.some((a) => a.standing === 'same')) && (
              <button
                type="button"
                className={bringsAnything(step.against) ? 'button-primary' : 'button-secondary'}
                onClick={async () => {
                  const { bytes, summary, file } = step
                  setStep({ kind: 'opening', summary, done: 0, total: 0 })
                  // The screen stays on while it opens: a phone that sleeps can stop it halfway.
                  const lock = await (navigator as { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
                    ?.request('screen')
                    .catch(() => null)
                  try {
                    const stores = openResourceStores()
                    // What the verses already translated read in the resources it replaces, read before their rows
                    // are written over, to say afterwards what changed in them; no downloaded parts land meanwhile.
                    // Only what the pack has newer, or what is here and can no longer be read, takes the place of this
                    // device's copy; an older one leaves it as it is. Decided again under the lock: an online apply
                    // may have landed while the summary was open.
                    const { changed } = await openPackSeeingChanges(stores, bytes, {
                      language: summary.language,
                      books: booksOf(summary),
                      replace: () =>
                        packAgainstDevice({ resources: summary.resources, books: summary.kind === 'book' ? summary.books : undefined }, copiesOnDevice())
                          .replace,
                      file,
                      onProgress: (done, total) => setStep({ kind: 'opening', summary, done, total }),
                    })
                    // The books with changed verses are read first, so the editor opens at once on one of them.
                    for (const c of changed) await loadBook(c.book, summary.language)
                    const brought = booksOf(summary)
                    setStep({
                      kind: 'done',
                      summary,
                      readable: brought.filter((b) => availabilityOf(b, summary.language)?.here),
                      waiting: brought.filter((b) => availabilityOf(b, summary.language)?.needsOriginal),
                      changed,
                    })
                  } catch (error) {
                    setStep({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
                  } finally {
                    void lock?.release().catch(() => {})
                  }
                }}
              >
                {t(!bringsAnything(step.against) ? 'paquete.abrirIgual' : step.against.replace.length ? 'paquete.actualizar' : 'paquete.abrir')}
              </button>
            )}
          </>
        )}

        {step.kind === 'opening' && (
          <section className="pack-opening">
            <p role="status">
              {step.total ? t('paquete.abriendoPct', { pct: Math.floor((100 * step.done) / step.total) }) : t('paquete.abriendo')}
            </p>
            <span className="progress-bar" aria-hidden="true">
              <span style={{ width: `${step.total ? (100 * step.done) / step.total : 0}%` }} />
            </span>
            <p className="notice">{t('paquete.noCerrar')}</p>
          </section>
        )}

        {step.kind === 'done' && <Done step={step} text={doneText(step)} onStudy={onStudy} onOpenVerse={onOpenVerse} />}

        {step.kind === 'error' && (
          <>
            <p className="notice" role="alert">
              {step.message}
            </p>
            <button type="button" className="button-secondary" onClick={() => setStep({ kind: 'choose' })}>
              {t('paquete.elegir')}
            </button>
          </>
        )}
      </main>
    </div>
  )
}

const replaced = (against: PackAgainstDevice, a: PackResourceStanding) => against.replace.includes(a.key)

/** Whether opening the pack changes anything here: a resource or books this device does not have, or a newer copy. */

/**
 * The last step: what is now on this device and, when the pack changed the helps of verses already translated, those
 * verses, one row each; the filled button opens the first in the editor. Leaving is the header's «‹».
 */
function Done({
  step,
  text,
  onStudy,
  onOpenVerse,
}: {
  step: Extract<Step, { kind: 'done' }>
  text: string
  onStudy(): void
  onOpenVerse(projectId: string, book: string, chapter: number, verse: number): void
}) {
  const t = useT()
  const summaryOf = useChangeSummary()
  const verses = step.changed.flatMap((b) => b.changes.map((c) => ({ ...b, change: c })))
  const projects = loadProjects()
  // Each project's name over its verses, when the pack changed verses of more than one.
  const several = new Set(step.changed.map((b) => b.project)).size > 1
  const listed = verses.slice(0, LISTED)
  const first = verses[0]
  return (
    <>
      <p role="status">{text}</p>
      {first && (
        <section className="pack-changes" aria-labelledby="pack-changes-title">
          <h2 id="pack-changes-title">{t(verses.length === 1 ? 'paquete.cambioUno' : 'paquete.cambios', { n: verses.length })}</h2>
          <p className="quiet">{t('paquete.cambiosAyuda')}</p>
          <div className="row-list">
            {listed.map((v, i) => (
              <Fragment key={`${v.project}.${v.book}.${v.change.chapter}.${v.change.verse}`}>
                {several && (i === 0 || listed[i - 1].project !== v.project) && (
                  <h3 className="pack-changes-project">{projects.find((p) => p.id === v.project)?.name ?? v.project}</h3>
                )}
                <RowButton
                  label={`${bookName(v.book)} ${v.change.chapter}:${v.change.verse}`}
                  meta={summaryOf(v.change)}
                  onClick={() => onOpenVerse(v.project, v.book, v.change.chapter, v.change.verse)}
                />
              </Fragment>
            ))}
          </div>
          {verses.length > LISTED && <p className="quiet">{t('paquete.cambiosMas', { n: verses.length - LISTED })}</p>}
        </section>
      )}
      <button
        type="button"
        className="button-primary"
        onClick={() => (first ? onOpenVerse(first.project, first.book, first.change.chapter, first.change.verse) : onStudy())}
      >
        {first ? t('paquete.verPrimero', { lugar: `${bookName(first.book)} ${first.change.chapter}:${first.change.verse}` }) : t('marco.volver')}
      </button>
    </>
  )
}
