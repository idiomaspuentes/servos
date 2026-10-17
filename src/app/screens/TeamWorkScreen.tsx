/**
 * The team's work through Door43 (design 6.10): each one leaves their work there, and brings in what the others left,
 * when there is internet. It is the same package as by card or Bluetooth, gathered the same way: what does not clash
 * comes in by itself, what was written another way waits to be brought together, and taking the same work twice
 * brings nothing new. Who coordinates chose once where the project lives on Door43; the work goes beside it, private.
 */

import { useState, type ReactNode } from 'react'
import { DestinationForm } from '../miniapps/publicar/publicar'
import { useT } from '../i18n/i18n'
import { accountOf, destinationOf, leaveWork, organizationsOf, problemOf, proposedRepo, setDestination, workLeft, workRepoOf, type Problem } from '../projects/door43'
import { namesTogether } from '../projects/mix'
import { bookName, type Project } from '../projects/model'
import { inProject } from '../projects/scope'
import { previewBook, readShared, receiveShared, shareProject, type BookPreview, type SharedFile } from '../projects/share'
import { deviceId } from '../projects/work'
import { Door43AccountSheet } from './Door43Account'

type Found = { file: SharedFile; previews: BookPreview[] }

export function TeamWorkScreen({
  project,
  projects,
  title,
  person,
  onBack,
  onReceived,
  onGather,
}: {
  project: Project
  projects: Project[]
  /** The book it was opened from, as the team names it: where «back» goes. */
  title: string
  person: string
  onBack(): void
  onReceived(projects: Project[]): void
  /** Goes to bring together what came written another way. */
  onGather(): void
}) {
  const t = useT()
  const [account, setAccount] = useState(() => accountOf(person))
  const [to, setTo] = useState(() => destinationOf(project.id))
  const [linking, setLinking] = useState(false)
  const [busy, setBusy] = useState<'trayendo' | 'dejando' | null>(null)
  const [found, setFound] = useState<Found[] | null>(null)
  const [left, setLeft] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [done, setDone] = useState<{ names: string[]; choices: number } | null>(null)
  // The prototype shared as a page inside Claude may not reach other sites: said before trying, not as a failure.
  const inPage = typeof window !== 'undefined' && 'claude' in window
  const date = (iso: string) => new Date(iso).toLocaleDateString(document.documentElement.lang || undefined)
  const togetherOf = (code: string) => project.books.find((b) => b.code === code)?.together ?? false

  const header = (
    <header className="header">
      <button type="button" className="button-quiet header-back" onClick={onBack}>
        ‹ {title}
      </button>
      <div className="header-title">
        <span className="header-app">{t('equipo.titulo')}</span>
        <span className="header-person">Door43</span>
      </div>
      <span />
    </header>
  )
  const screen = (body: ReactNode) => (
    <div className="screen">
      {header}
      <main className="main">{body}</main>
    </div>
  )

  // 1. Who: the person's Door43 account on this phone.
  if (!account) {
    return screen(
      <>
        <p>{t('equipo.sinCuenta')}</p>
        {inPage && <p className="status">{t('equipo.enLaPagina')}</p>}
        <button type="button" className="button-primary" onClick={() => setLinking(true)}>
          {t('equipo.vincular')}
        </button>
        {linking && (
          <Door43AccountSheet
            person={person}
            onClose={() => setLinking(false)}
            onLinked={(a) => {
              setAccount(a)
              setLinking(false)
            }}
          />
        )}
      </>
    )
  }

  // 2. Where: the project's place on Door43, chosen once (the same as for publishing).
  if (!to) {
    return screen(
      <>
        <DestinationForm
          host={account.host}
          proposed={{ host: account.host, owner: '', repo: proposedRepo(project) }}
          organizations={() => organizationsOf(account)}
          projectName={project.name}
          saveLabel={t('equipo.guardarAhi')}
          heading={t('equipo.dondePregunta')}
          help={t('equipo.dondeAyuda')}
          onSave={(d) => {
            setDestination(project.id, d)
            setTo(d)
          }}
        />
      </>
    )
  }

  const work = workRepoOf(to)
  const failed = (e: unknown) => {
    setProblem(problemOf(e))
    setBusy(null)
  }
  const bring = async () => {
    setBusy('trayendo')
    setProblem(null)
    try {
      const files = (await workLeft(account, to, deviceId())).map((x) => readShared(x.text)).filter((f): f is SharedFile => Boolean(f))
      setFound(
        inProject(project.id, () =>
          files.map((file) => ({
            file,
            previews: file.books.map((b) => previewBook(b, !project.books.some((x) => x.code === b.code), { from: file.from, at: file.at, person })),
          }))
        )
      )
      setBusy(null)
    } catch (e) {
      failed(e)
    }
  }
  const leave = async () => {
    setBusy('dejando')
    setProblem(null)
    try {
      const file = shareProject(project, project.books.map((b) => b.code), person)
      const result = await leaveWork(account, to, JSON.stringify(file), person, deviceId())
      if (result.state === 'failed') setProblem(result.problem ?? 'other')
      else setLeft(true)
      setBusy(null)
    } catch (e) {
      failed(e)
    }
  }
  const receiveAll = () => {
    let now = projects
    let choices = 0
    for (const { file } of found ?? []) {
      const got = receiveShared(file, file.books.map((b) => b.code), { kind: 'join', projectId: project.id }, now, person)
      now = got.projects
      choices += got.books.reduce((n, b) => n + b.choices, 0)
    }
    onReceived(now)
    setDone({ names: (found ?? []).map((f) => f.file.from), choices })
    setFound(null)
  }
  const brings = (p: BookPreview) => p.taken + p.choices + p.alignments + p.checks + p.studyNotes + p.recordings > 0
  const anyNew = (found ?? []).some((f) => f.previews.some(brings))
  const said = (p: BookPreview, from: string) =>
    !brings(p)
      ? t('equipo.nadaNuevo')
      : p.isNew
        ? t('recibir.libroNuevo', { n: p.taken })
        : togetherOf(p.code)
          ? t('recibir.cambiaTodos', { nombre: from, elegir: p.choices, nuevos: p.taken })
          : t('recibir.cambia', { nuevos: p.taken, iguales: p.same, elegir: p.choices })

  // 3. Brought in: what came, and on to bring the versions together.
  if (done) {
    return screen(
      <>
        <p className="review-done">✓ {t('equipo.recibido', { nombres: namesTogether(done.names, t('juntar.y')) })}</p>
        {done.choices > 0 ? (
          <button type="button" className="button-primary" onClick={onGather}>
            {t('recibir.elegirAhora', { n: done.choices })} →
          </button>
        ) : (
          <button type="button" className="button-primary" onClick={onBack}>
            {t('recibir.irAl', { libro: title })} →
          </button>
        )}
      </>
    )
  }

  return screen(
    <>
      <p className="quiet">{t('equipo.que', { repo: `${work.owner}/${work.repo}` })}</p>
      {inPage && <p className="status">{t('equipo.enLaPagina')}</p>}
      {found && found.length === 0 && <p>{t('equipo.nadie')}</p>}
      {found && found.length > 0 && (
        <ul className="receive-books">
          {found.map(({ file, previews }) => (
            <li key={`${file.from}.${file.at}`}>
              <strong>{t('equipo.dejoEl', { nombre: file.from, fecha: date(file.at) })}</strong>
              {previews.map((p) => (
                <span key={p.code} className="quiet">
                  {bookName(p.code)}: {said(p, file.from)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p className="status" role="status">
          {t(`door43.problema.${problem}`)}
        </p>
      )}
      {left && (
        <p className="status" role="status">
          ✓ {t('equipo.dejado')}
        </p>
      )}
      {found && anyNew ? (
        <button type="button" className="button-primary" onClick={receiveAll}>
          {t('equipo.recibirTodo')}
        </button>
      ) : (
        <button type="button" className="button-primary" disabled={busy !== null} onClick={bring}>
          {busy === 'trayendo' ? t('equipo.trayendo') : t('equipo.traer')}
        </button>
      )}
      <button type="button" className="button-secondary" disabled={busy !== null} onClick={leave}>
        {busy === 'dejando' ? t('equipo.dejando') : t('equipo.dejar')}
      </button>
      <p className="quiet">{t('equipo.cuenta', { usuario: account.username })}</p>
    </>
  )
}
