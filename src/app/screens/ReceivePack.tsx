/**
 * Receive a pack: choose the file, see what it brings, open it into this device's stores (`src/resources`); then the
 * projects' books are read from it again (projects/library.ts), and the screens show them.
 */

import { useState } from 'react'
import { LEXICON_SUBJECTS } from '../../resources/companions'
import { packAgainstDevice, type PackAgainstDevice, type PackResourceStanding } from '../../resources/freshness'
import { describePack, openPack, openingLeft, type PackSummary } from '../../resources/packs'
import { openResourceStores } from '../../resources/store'
import { availabilityOf, copiesOnDevice, onDevice, refreshLibrary } from '../projects/library'
import { bookName } from '../projects/model'
import { useT } from '../i18n/i18n'

type Step =
  | { kind: 'choose' }
  /** What it brings, each resource against this device's copy (`freshness.ts`). */
  | { kind: 'summary'; bytes: Uint8Array; summary: PackSummary; file: string; against: PackAgainstDevice }
  /** Being opened: rows gone through of all, for a phone that takes a minute or two. */
  | { kind: 'opening'; summary: PackSummary; done: number; total: number }
  /** Opened: the books it brought that can now be read, and those that wait for the originals. */
  | { kind: 'done'; summary: PackSummary; readable: string[]; waiting: string[] }
  | { kind: 'error'; message: string }

export function ReceivePack({ onBack, onStudy }: { onBack(): void; onStudy(): void }) {
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
                  const { bytes, summary, file, against } = step
                  setStep({ kind: 'opening', summary, done: 0, total: 0 })
                  // The screen stays on while it opens: a phone that sleeps can stop it halfway.
                  const lock = await (navigator as { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
                    ?.request('screen')
                    .catch(() => null)
                  try {
                    // Only what the pack has newer, or what is here and can no longer be read, takes the place of this
                    // device's copy; an older one leaves it as it is.
                    await openPack(openResourceStores(), bytes, {
                      replace: against.replace,
                      file,
                      onProgress: (done, total) => setStep({ kind: 'opening', summary, done, total }),
                    })
                    await refreshLibrary()
                    const brought = booksOf(summary)
                    setStep({
                      kind: 'done',
                      summary,
                      readable: brought.filter((b) => availabilityOf(b, summary.language)?.here),
                      waiting: brought.filter((b) => availabilityOf(b, summary.language)?.needsOriginal),
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

        {step.kind === 'done' && (
          <>
            <p role="status">{doneText(step)}</p>
            <button type="button" className="button-primary" onClick={onStudy}>
              {t('marco.volver')}
            </button>
          </>
        )}

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
const bringsAnything = (against: PackAgainstDevice) =>
  against.replace.length > 0 || against.resources.some((a) => a.standing === 'new' || (a.standing === 'same' && a.adds.length > 0))
