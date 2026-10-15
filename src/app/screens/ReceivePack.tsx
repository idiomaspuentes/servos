/**
 * Receive a pack: choose the file, see what it brings, open it. This one is real: it reads the pack's manifest and
 * opens it into this browser's stores with `src/resources`. What the reading screens show is still the prototype's
 * fixed chapter.
 */

import { useState } from 'react'
import { describePack, openPack, type PackSummary } from '../../resources/packs'
import { openResourceStores } from '../../resources/store'
import { useT } from '../i18n/i18n'

type Step =
  | { kind: 'choose' }
  | { kind: 'summary'; bytes: Uint8Array; summary: PackSummary; file: string }
  | { kind: 'opening'; summary: PackSummary }
  | { kind: 'done'; summary: PackSummary; written: number }
  | { kind: 'error'; message: string }

export function ReceivePack({ onBack, onStudy }: { onBack(): void; onStudy(): void }) {
  const t = useT()
  const [step, setStep] = useState<Step>({ kind: 'choose' })

  const books = (s: PackSummary) =>
    s.books.length ? s.books.join(', ') : [...new Set(s.resources.flatMap((r) => r.books))].join(', ') || t('paquete.todoElIdioma')

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
                    setStep({ kind: 'summary', bytes, summary: await describePack(bytes), file: file.name })
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
            <h1>{t('paquete.trae')}</h1>
            <ul className="pack-list">
              {step.summary.resources.map((r) => (
                <li key={r.key}>
                  <strong>{r.title}</strong>
                  <span className="quiet">{r.key}</span>
                </li>
              ))}
            </ul>
            <p>{t('paquete.libros', { libros: books(step.summary) })}</p>
            {step.summary.needs.length > 0 && (
              <p className="notice">{t('paquete.necesita', { que: step.summary.needs.map((n) => n.key.split('/').pop()!.toUpperCase()).join(', ') })}</p>
            )}
            <button
              type="button"
              className="button-primary"
              onClick={async () => {
                const { bytes, summary } = step
                setStep({ kind: 'opening', summary })
                try {
                  const result = await openPack(openResourceStores(), bytes)
                  setStep({ kind: 'done', summary, written: result.written })
                } catch (error) {
                  setStep({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
                }
              }}
            >
              {t('paquete.abrir')}
            </button>
          </>
        )}

        {step.kind === 'opening' && <p role="status">{t('paquete.abriendo')}</p>}

        {step.kind === 'done' && (
          <>
            <p role="status">{t('paquete.listo', { libros: books(step.summary) })}</p>
            <button type="button" className="button-primary" onClick={onStudy}>
              {t('paquete.irAEstudio')}
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
