/**
 * «Add a book», as translationCore 4's (`src/views/modals/AddBook.jsx`): a blank book or one from a USFM file; for a
 * blank one, the books by testament, those already in the project marked and not choosable.
 */

import { useRef, useState } from 'react'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { BOOKS, bookName, type Phase, type Project } from '../projects/model'
import { previewBook, receiveBook } from '../projects/share'
import { readUsfmBook, type UsfmBook } from '../projects/usfmImport'

export function AddBookSheet({
  project,
  person,
  onClose,
  onCreate,
  onReceive,
}: {
  project: Project
  /** Who brings a USFM file in: its verses carry this name. */
  person: string
  onClose(): void
  /** Adds the book to the project (if it is not there) at a step, and opens it. */
  onCreate(code: string, phase?: Phase): void
  /** A book someone else shared (a `.servos` file), received into this project. */
  onReceive(): void
}) {
  const t = useT()
  const [step, setStep] = useState<'method' | 'pick'>('method')
  // A USFM file read, before it is gathered: what it brings and what it changes here.
  const [found, setFound] = useState<UsfmBook | null>(null)
  const file = useRef<HTMLInputElement>(null)
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
          {found ? (
            <UsfmFound
              found={found}
              person={person}
              isNew={!has.has(found.code ?? '')}
              onAgain={() => file.current?.click()}
              onBring={() => {
                receiveBook(found.book, !has.has(found.code!), { from: person, at: `usfm:${found.id}`, person })
                onCreate(found.code!, 'traduccion')
              }}
            />
          ) : (
            <MenuRow label={t('libroNuevo.usfm')} description={t('libroNuevo.usfmAyuda')} onClick={() => file.current?.click()} />
          )}
          <input
            ref={file}
            type="file"
            accept=".usfm,.sfm,.txt,text/plain"
            hidden
            onChange={async (e) => {
              const chosen = e.target.files?.[0]
              if (chosen) setFound(readUsfmBook(await chosen.text(), person))
              e.target.value = ''
            }}
          />
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

/** What a USFM file brings, said before anything is written; one button to bring it in. */
function UsfmFound({ found, isNew, person, onAgain, onBring }: { found: UsfmBook; isNew: boolean; person: string; onAgain(): void; onBring(): void }) {
  const t = useT()
  if (!found.code || !found.verses) {
    return (
      <div className="usfm-found">
        <p className="notice" role="alert">
          {found.code ? t('libroNuevo.usfmVacio') : t('libroNuevo.usfmNoLibro', { id: found.id || '—' })}
        </p>
        <button type="button" className="button-secondary" onClick={onAgain}>
          {t('libroNuevo.usfmOtro')}
        </button>
      </div>
    )
  }
  const p = previewBook(found.book, isNew, { from: person, at: `usfm:${found.id}`, person })
  return (
    <div className="usfm-found">
      <strong>{bookName(found.code)}</strong>
      <span className="quiet">{isNew ? t('recibir.libroNuevo', { n: p.taken }) : t('recibir.cambia', { nuevos: p.taken, iguales: p.same, elegir: p.choices })}</span>
      {p.waiting > 0 && <span className="quiet">{t('recibir.esperando', { n: p.waiting })}</span>}
      <span className="quiet">{t('libroNuevo.usfmQueNo')}</span>
      <button type="button" className="button-primary" onClick={onBring}>
        {t(isNew ? 'libroNuevo.usfmAgregar' : 'libroNuevo.usfmJuntar', { libro: bookName(found.code) })}
      </button>
      <button type="button" className="button-secondary" onClick={onAgain}>
        {t('libroNuevo.usfmOtro')}
      </button>
    </div>
  )
}
