/**
 * «Receive» (design, section 7): a file shared from another computer, gathered in three steps and nothing done before
 * the last: what it brings (from whom, when, which books, the glossary); where it goes (into the same project if it
 * is on this phone; if not, as a new project or into one of this phone's in the same language, two projects that
 * began apart, design 6.5); and which books, each saying what it would change here. Then it is gathered, nothing
 * written here overwritten without a choice (`projects/share.ts`), and it says what was done.
 */

import { useMemo, useRef, useState } from 'react'
import { MenuRow } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { bookName, type Project } from '../projects/model'
import { previewBook, readShared, receiveShared, type BookReceived, type Destination, type SharedFile } from '../projects/share'

export function ReceiveScreen({
  projects,
  preset,
  examples = [],
  onBack,
  onReceived,
  onGo,
  onChoose,
}: {
  projects: Project[]
  /** The project it was opened from, to gather into by default. */
  preset?: string
  /** Files to try it with, in the prototype. */
  examples?: SharedFile[]
  onBack(): void
  /** The projects as they are after receiving. */
  onReceived(projects: Project[]): void
  /** Opens a book of a project, after receiving. */
  onGo(projectId: string, book: string | null): void
  /** Goes through a book's verses with two versions, after receiving. */
  onChoose(projectId: string, book: string): void
}) {
  const t = useT()
  const [file, setFile] = useState<SharedFile | null>(null)
  const [wrong, setWrong] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [destination, setDestination] = useState<Destination | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [done, setDone] = useState<{ projectId: string; books: BookReceived[]; glossary: { added: number } } | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const open = (text: string) => {
    const shared = readShared(text)
    if (!shared) return setWrong(true)
    setWrong(false)
    setFile(shared)
    setChosen(shared.books.map((b) => b.code))
    // Where it goes at first: the same project, if it is here; the one it was opened from, if of the same language;
    // else a new one.
    const same = projects.find((p) => p.id === shared.project.id)
    const from = projects.find((p) => p.id === preset && p.languageCode === shared.project.languageCode)
    setDestination(same ? { kind: 'join', projectId: same.id } : from ? { kind: 'join', projectId: from.id } : { kind: 'new' })
  }

  const same = file ? projects.find((p) => p.id === file.project.id) : undefined
  const sameLanguage = file ? projects.filter((p) => p.id !== file.project.id && p.languageCode === file.project.languageCode) : []
  const target = destination?.kind === 'join' ? projects.find((p) => p.id === destination.projectId) : undefined
  const previews = useMemo(
    () => (file ? file.books.map((b) => previewBook(b, !target?.books.some((x) => x.code === b.code))) : []),
    [file, target]
  )

  const header = (
    <header className="header">
      <button type="button" className="button-quiet header-back" onClick={onBack}>
        ‹ {t('marco.volver')}
      </button>
      <div className="header-title">
        <span className="header-app">{t('recibir.titulo')}</span>
      </div>
      <span />
    </header>
  )

  if (done && file) {
    const first = done.books[0]?.code ?? null
    const toChoose = done.books.find((b) => b.choices > 0)?.code
    const choices = done.books.find((b) => b.code === toChoose)?.choices ?? 0
    return (
      <div className="screen">
        {header}
        <main className="main">
          <p className="review-done">✓ {t('recibir.hecho', { nombre: file.from })}</p>
          <ul className="receive-books">
            {done.books.map((b) => (
              <li key={b.code}>
                <strong>{bookName(b.code)}</strong>
                <span className="quiet">{t('recibir.entraron', { n: b.taken, iguales: b.same })}</span>
                {b.choices > 0 && <span className="quiet">{t('recibir.paraElegirDespues', { n: b.choices })}</span>}
                {b.alignmentsTaken + b.checksTaken > 0 && <span className="quiet">{t('recibir.capas', { n: b.alignmentsTaken + b.checksTaken })}</span>}
                {b.recordingsTaken > 0 && <span className="quiet">{t('recibir.grabacionesEntraron', { n: b.recordingsTaken })}</span>}
              </li>
            ))}
          </ul>
          {done.glossary.added > 0 && <p className="quiet">{t('recibir.glosarioNuevas', { n: done.glossary.added })}</p>}
          {toChoose && (
            <button type="button" className="button-primary" onClick={() => onChoose(done.projectId, toChoose)}>
              {t('recibir.elegirAhora', { n: choices })} →
            </button>
          )}
          {first && (
            <button type="button" className={toChoose ? 'button-secondary' : 'button-primary'} onClick={() => onGo(done.projectId, first)}>
              {t('recibir.irAl', { libro: bookName(first) })} →
            </button>
          )}
        </main>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="screen">
        {header}
        <main className="main">
          <p className="quiet">{t('recibir.ayuda')}</p>
          <button type="button" className="button-primary" onClick={() => picker.current?.click()}>
            {t('recibir.elegir')}
          </button>
          <input
            ref={picker}
            type="file"
            accept=".servos,application/json,text/plain"
            hidden
            onChange={async (e) => {
              const chosenFile = e.target.files?.[0]
              if (chosenFile) open(await chosenFile.text())
              e.target.value = ''
            }}
          />
          <button type="button" className="button-secondary" onClick={() => setPasting((p) => !p)}>
            {t('recibir.pegar')}
          </button>
          {pasting && (
            <div className="glossary-paste">
              <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t('recibir.pegarAyuda')} />
              <button type="button" className="button-primary" disabled={!pasted.trim()} onClick={() => open(pasted)}>
                {t('recibir.abrir')}
              </button>
            </div>
          )}
          {wrong && (
            <p className="notice" role="alert">
              {t('recibir.noEs')}
            </p>
          )}
          {examples.length > 0 && (
            <section className="receive-examples">
              <h2>{t('recibir.ejemplos')}</h2>
              {examples.map((ex) => (
                <MenuRow
                  key={`${ex.from}.${ex.books.map((b) => b.code).join()}`}
                  label={t('recibir.ejemploDe', { nombre: ex.from, que: ex.books.map((b) => b.name || bookName(b.code)).join(', ') })}
                  description={t('recibir.versiculosN', { n: ex.books.reduce((n, b) => n + b.verses.length, 0) })}
                  onClick={() => open(JSON.stringify(ex))}
                />
              ))}
            </section>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="screen">
      {header}
      <main className="main">
        {/* 1. What it brings */}
        <section className="book-resume">
          <span className="book-resume-kicker">{t('recibir.de', { nombre: file.from, fecha: new Date(file.at).toLocaleDateString(document.documentElement.lang || undefined) })}</span>
          <span className="book-resume-what">{file.project.name}</span>
          <span className="quiet">
            {file.project.languageName} ({file.project.languageCode}) · {file.books.map((b) => b.name || bookName(b.code)).join(', ')}
            {file.glossary?.length ? ` · ${t('recibir.glosarioN', { n: file.glossary.length })}` : ''}
          </span>
        </section>

        {/* 2. Where it goes */}
        <fieldset className="field">
          <legend className="field-label">{t('recibir.dondeVa')}</legend>
          {same ? (
            <p className="quiet">{t('recibir.seJunta', { proyecto: same.name })}</p>
          ) : (
            <>
              <button type="button" className={destination?.kind === 'new' ? 'option is-on' : 'option'} aria-pressed={destination?.kind === 'new'} onClick={() => setDestination({ kind: 'new' })}>
                <span className="option-title">{t('recibir.comoNuevo')}</span>
                <span className="quiet">{t('recibir.comoNuevoAyuda', { proyecto: file.project.name })}</span>
              </button>
              {sameLanguage.map((p) => {
                const on = destination?.kind === 'join' && destination.projectId === p.id
                return (
                  <button key={p.id} type="button" className={on ? 'option is-on' : 'option'} aria-pressed={on} onClick={() => setDestination({ kind: 'join', projectId: p.id })}>
                    <span className="option-title">{t('recibir.juntarCon', { proyecto: p.name })}</span>
                    <span className="quiet">{t('recibir.juntarConAyuda')}</span>
                  </button>
                )
              })}
            </>
          )}
        </fieldset>

        {/* 3. Which books, and what each changes here */}
        <fieldset className="field">
          <legend className="field-label">{t('recibir.queLibros')}</legend>
          {previews.map((p) => (
            <label key={p.code} className="check check-two-lines">
              <input type="checkbox" checked={chosen.includes(p.code)} onChange={() => setChosen((now) => (now.includes(p.code) ? now.filter((c) => c !== p.code) : [...now, p.code]))} />
              <span>
                <span className="app-row-name">{bookName(p.code)}</span>
                <span className="quiet">
                  {p.isNew
                    ? t('recibir.libroNuevo', { n: p.taken })
                    : t('recibir.cambia', { nuevos: p.taken, iguales: p.same, elegir: p.choices })}
                  {p.alignments + p.checks + p.studyNotes > 0 && ` · ${t('recibir.traeMas', { n: p.alignments + p.checks + p.studyNotes })}`}
                  {p.recordings > 0 && ` · ${t('recibir.grabaciones', { n: p.recordings })}`}
                  {p.waiting > 0 && ` · ${t('recibir.esperando', { n: p.waiting })}`}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className="button-primary"
          disabled={!chosen.length || !destination}
          onClick={() => {
            const result = receiveShared(file, chosen, destination!, projects)
            onReceived(result.projects)
            setDone({ projectId: result.projectId, books: result.books, glossary: result.glossary })
          }}
        >
          {t('recibir.recibir')}
        </button>
        <button type="button" className="button-secondary" onClick={() => setFile(null)}>
          {t('recibir.otroArchivo')}
        </button>
      </main>
    </div>
  )
}
