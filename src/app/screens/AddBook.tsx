/**
 * «Add a book», as translationCore 4's (`src/views/modals/AddBook.jsx`): a blank book or one from a USFM file; for a
 * blank one, the books by testament, those already in the project marked and not choosable.
 */

import { useState } from 'react'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { BOOKS, bookName, type Project } from '../projects/model'

export function AddBookSheet({
  project,
  onClose,
  onCreate,
  onReceive,
}: {
  project: Project
  onClose(): void
  onCreate(code: string): void
  /** A book someone else shared (a `.servos` file), received into this project. */
  onReceive(): void
}) {
  const t = useT()
  const [step, setStep] = useState<'method' | 'pick'>('method')
  const [picked, setPicked] = useState<string | null>(null)
  const has = new Set(project.books.map((b) => b.code))

  const grid = (codes: Array<[string, string]>, title: string) => (
    <>
      <h3 className="menu-heading">{title}</h3>
      <div className="book-grid">
        {codes.map(([code, name]) =>
          has.has(code) ? (
            <span key={code} className="book-chip is-in" title={t('libroNuevo.yaEsta')}>
              {name} ✓
            </span>
          ) : (
            <button key={code} type="button" className={picked === code ? 'book-chip is-on' : 'book-chip'} aria-pressed={picked === code} onClick={() => setPicked(code)}>
              {name}
            </button>
          )
        )}
      </div>
    </>
  )

  return (
    <Sheet title={`${t('libroNuevo.titulo')} ${t('libroNuevo.a', { proyecto: project.name })}`} onClose={onClose}>
      {step === 'method' ? (
        <>
          <MenuRow label={t('libroNuevo.enBlanco')} description={t('libroNuevo.enBlancoAyuda')} onClick={() => setStep('pick')} />
          <MenuRow label={t('libroNuevo.recibir')} description={t('libroNuevo.recibirAyuda')} onClick={onReceive} />
          <MenuRow label={t('libroNuevo.usfm')} description={t('libroNuevo.usfmAyuda')} onClick={() => {}} disabled />
        </>
      ) : (
        <div className="stack">
          <button type="button" className="button-quiet back-link" onClick={() => setStep('method')}>
            ‹ {t('libroNuevo.volver')}
          </button>
          {grid(BOOKS.slice(0, 39), t('libroNuevo.at'))}
          {grid(BOOKS.slice(39), t('libroNuevo.nt'))}
          <div className="sheet-foot">
            {picked ? (
              <button type="button" className="button-primary" onClick={() => onCreate(picked)}>
                {t('libroNuevo.crear', { libro: bookName(picked) })}
              </button>
            ) : (
              <p className="quiet">{t('libroNuevo.elija')}</p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
