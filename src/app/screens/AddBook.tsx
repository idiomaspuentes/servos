/**
 * «Add a book», as translationCore 4's (`src/views/modals/AddBook.jsx`): a blank book or one from a USFM file; for a
 * blank one, the books by testament, those already in the project marked and not choosable. The books whose texts and
 * helps are on this device come first, and are marked among the others: they can be started at once. With internet, a
 * book that is not here says that creating it brings its texts and helps, and how much they weigh (spec §2); creating
 * it starts that download. The size is said when it comes: «Crear» never waits for it.
 */

import { useRef, useState } from 'react'
import { useOnline } from '../frame/online'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useI18n, useT } from '../i18n/i18n'
import { bookIsHere } from '../projects/library'
import { askForBook, useDownloadSize } from '../projects/onlineBooks'
import { downloadSaid, sizeIn } from '../projects/onlineWords'
import { useOnlineResources } from '../../resources/online/onlineResources'
import { BOOKS, bookName, type Phase, type Project } from '../projects/model'
import { previewBook, receiveBook } from '../projects/share'
import { inProject } from '../projects/scope'
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
  const { t, language: lang } = useI18n()
  const [step, setStep] = useState<'method' | 'pick'>('method')
  // A USFM file read, before it is gathered: what it brings and what it changes here.
  const [found, setFound] = useState<UsfmBook | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const has = new Set(project.books.map((b) => b.code))
  const here = new Set(BOOKS.map(([code]) => code).filter((code) => bookIsHere(code, project.helpsLanguage)))
  const ready = BOOKS.filter(([code]) => here.has(code) && !has.has(code))
  // A book not here, with internet and nothing that stops its language: creating it downloads it, unless the Worker's
  // list names nothing of that book (a size of null). A size not known yet, or that cannot be told now, waits for
  // nothing: the line says it without the size. Without internet, as before: its pack is received when it is opened.
  const helps = project.helpsLanguage
  const online = useOnline()
  const blocked = useOnlineResources().blocked[helps]
  const mayDownload = Boolean(picked && !here.has(picked) && online && !blocked)
  const size = useDownloadSize(helps, picked, mayDownload)
  const downloads = mayDownload && size !== null
  const createLine = (() => {
    // Nothing left to bring (0 bytes) has no size worth saying.
    const said = downloadSaid('alCrear', typeof size === 'number' && size > 0 ? sizeIn(t, size, lang) : null)
    return t(said.key, said.values)
  })()

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
            <button
              key={code}
              type="button"
              className={`book-chip${picked === code ? ' is-on' : ''}${here.has(code) ? ' has-texts' : ''}`}
              aria-pressed={picked === code}
              onClick={() => setPicked(code)}
            >
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
          {/* A book someone sent: once the project has books, to work on one of them together. */}
          {project.books.length > 0 && <MenuRow label={t('libroNuevo.recibir')} description={t('libroNuevo.recibirAyuda')} onClick={onReceive} />}
          {found ? (
            <UsfmFound
              found={found}
              person={person}
              projectId={project.id}
              isNew={!has.has(found.code ?? '')}
              onAgain={() => file.current?.click()}
              onBring={() => {
                inProject(project.id, () => receiveBook(found.book, !has.has(found.code!), { from: person, at: `usfm:${found.id}`, person }))
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
          {ready.length > 0 && grid(ready, t('libroNuevo.listos'))}
          {grid(BOOKS.slice(0, 39), t('libroNuevo.at'))}
          {grid(BOOKS.slice(39), t('libroNuevo.nt'))}
          <div className="sheet-foot">
            {picked ? (
              <>
                {!here.has(picked) && <p className="quiet">{downloads ? createLine : t('libroNuevo.sinTextos', { libro: bookName(picked) })}</p>}
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => {
                    onCreate(picked)
                    if (downloads) void askForBook(helps, picked)
                  }}
                >
                  {t('libroNuevo.crear', { libro: bookName(picked) })}
                </button>
              </>
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
function UsfmFound({
  found,
  isNew,
  person,
  projectId,
  onAgain,
  onBring,
}: {
  found: UsfmBook
  isNew: boolean
  person: string
  /** The project the book goes into: what it would change there. */
  projectId: string
  onAgain(): void
  onBring(): void
}) {
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
  const p = inProject(projectId, () => previewBook(found.book, isNew, { from: person, at: `usfm:${found.id}`, person }))
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
