/**
 * The team's work through Door43 (design 6.10): each one leaves their work there, and brings in what the others left,
 * when there is internet. It is the same package as by card or Bluetooth, gathered the same way: what does not clash
 * comes in by itself, what was written another way waits to be brought together, and taking the same work twice
 * brings nothing new. Who coordinates chose once where the project lives on Door43; the work goes beside it, private.
 * Without internet, leaving and bringing are asked all the same: they wait on the phone for internet and the person's
 * yes (design 6.11).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useOnline, useWaiting } from '../frame/online'
import { DestinationForm } from '../miniapps/publicar/publicar'
import { useT } from '../i18n/i18n'
import { accountOf, destinationOf, forgetAccount, leaveWork, problemOf, proposedOrg, proposedRepo, setDestination, workLeft, workRepoOf, type Problem } from '../projects/door43'
import { namesTogether } from '../projects/mix'
import { ask, drop, settle } from '../projects/outbox'
import { bookName, privacyOf, type Project } from '../projects/model'
import { inProject } from '../projects/scope'
import { previewBook, readShared, receiveShared, type BookPreview, type SharedFile } from '../projects/share'
import { deviceId } from '../projects/work'
import { waitsForTeamPassword, workToLeave } from '../projects/workToLeave'
import { lockedKind } from '../projects/lockedCopy'
import { openWithTeamKeys } from '../projects/teamKeys'
import { TeamPassword } from './CopiesSheet'
import { Door43AccountSheet } from './Door43Account'

type Found = { file: SharedFile; previews: BookPreview[] }

export function TeamWorkScreen({
  project,
  projects,
  book,
  title,
  person,
  bringNow = false,
  onBack,
  onReceived,
  onGather,
}: {
  project: Project
  projects: Project[]
  /** The book it was opened from: where bringing in, asked without internet, opens again. */
  book: string
  /** The book it was opened from, as the team names it: where «back» goes. */
  title: string
  person: string
  /** Opened to bring in at once (the person said yes to it when internet came back). */
  bringNow?: boolean
  onBack(): void
  onReceived(projects: Project[]): void
  /** Goes to bring together what came written another way. */
  onGather(): void
}) {
  const t = useT()
  const [account, setAccount] = useState(() => accountOf(person))
  const [to, setTo] = useState(() => destinationOf(project.id))
  const [linking, setLinking] = useState(false)
  // Linking again keeps the Door43 it was on.
  const [relinkHost, setRelinkHost] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<'trayendo' | 'dejando' | null>(null)
  const [found, setFound] = useState<Found[] | null>(null)
  const [left, setLeft] = useState(false)
  // Work the others left sealed with a team password this phone does not know.
  const [sealed, setSealed] = useState(0)
  const [problem, setProblem] = useState<Problem | null>(null)
  // Leaving was asked for a project kept to its team whose password this phone does not know: it is asked for here.
  const [password, setPassword] = useState(false)
  const [done, setDone] = useState<{ names: string[]; choices: number; takes: number } | null>(null)
  // Tried with the phone saying it was online, and Door43 could not be reached: it waits all the same.
  const [unreached, setUnreached] = useState(false)
  const online = useOnline()
  const waits = useWaiting(person).filter((e) => e.projectId === project.id && (e.kind === 'dejar' || e.kind === 'traer'))
  // Once, though the screen be drawn twice as it opens.
  const brought = useRef(false)
  useEffect(() => {
    if (!bringNow || !account || !to || brought.current) return
    brought.current = true
    void bring()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
            host={relinkHost}
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
          account={account}
          proposed={{ host: account.host, owner: '', repo: proposedRepo(project) }}
          newOrg={proposedOrg(project)}
          teamOnly={privacyOf(project) === 'equipo'}
          saveLabel={t('equipo.guardarAhi')}
          onSave={(d) => {
            setDestination(project.id, d)
            setTo(d)
          }}
        />
      </>
    )
  }

  const work = workRepoOf(to)
  // Kept to go when there is internet.
  const later = (kind: 'dejar' | 'traer', tried: boolean) => {
    ask({ kind, projectId: project.id, person, book })
    setProblem(null)
    setUnreached(tried)
    setBusy(null)
  }
  const failed = (e: unknown, kind: 'dejar' | 'traer') => {
    const p = problemOf(e)
    if (p === 'offline') return later(kind, true)
    setProblem(p)
    setBusy(null)
  }
  const bring = async () => {
    if (!online) return later('traer', false)
    setBusy('trayendo')
    setProblem(null)
    setUnreached(false)
    try {
      // What the others left sealed with the team's password (a project kept to its team) opens with the key kept here.
      const left = await workLeft(account, to, deviceId())
      const texts = await Promise.all(left.map(async (x) => (lockedKind(x.text) === 'compartido' ? openWithTeamKeys(x.text) : x.text)))
      setSealed(texts.filter((x) => x === null).length)
      const files = texts.map((x) => (x === null ? null : readShared(x))).filter((f): f is SharedFile => Boolean(f))
      settle('traer', project.id, person)
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
      failed(e, 'traer')
    }
  }
  const leave = async () => {
    // A project kept to its team goes sealed with the team's password, or not at all: without it, it is asked for
    // first, with internet or without (an errand kept without it would only wait for it).
    if (await waitsForTeamPassword(project)) return setPassword(true)
    if (!online) return later('dejar', false)
    setBusy('dejando')
    setProblem(null)
    setUnreached(false)
    try {
      // With the sound of every take: the shelf replaces it in place, so recording again does not pile up versions.
      const work = await workToLeave(project, person)
      if (!work) {
        setPassword(true)
        return setBusy(null)
      }
      const result = await leaveWork(account, to, work.text, person, deviceId(), privacyOf(project))
      if (result.state === 'failed' && result.problem === 'offline') return later('dejar', true)
      if (result.state === 'failed') setProblem(result.problem ?? 'other')
      else {
        settle('dejar', project.id, person)
        setLeft(true)
      }
      setBusy(null)
    } catch (e) {
      failed(e, 'dejar')
    }
  }
  const waitsFor = (kind: 'dejar' | 'traer') => waits.some((e) => e.kind === kind)
  const receiveAll = () => {
    let now = projects
    let choices = 0
    let takes = 0
    for (const { file } of found ?? []) {
      const got = receiveShared(file, file.books.map((b) => b.code), { kind: 'join', projectId: project.id }, now, person)
      now = got.projects
      choices += got.books.reduce((n, b) => n + b.choices, 0)
      takes += got.books.reduce((n, b) => n + b.recordingsTaken, 0)
    }
    onReceived(now)
    // One name each: someone may have left work from two phones (or from one that changed).
    setDone({ names: [...new Set((found ?? []).map((f) => f.file.from))], choices, takes })
    setFound(null)
  }
  const brings = (p: BookPreview) => p.taken + p.choices + p.alignments + p.checks + p.studyNotes + p.recordings > 0
  const anyNew = (found ?? []).some((f) => f.previews.some(brings))
  const said = (p: BookPreview, from: string) =>
    !brings(p)
      ? t('equipo.nadaNuevo')
      : (p.isNew
          ? t('recibir.libroNuevo', { n: p.taken })
          : togetherOf(p.code)
            ? t('recibir.cambiaTodos', { nombre: from, elegir: p.choices, nuevos: p.taken })
            : t('recibir.cambia', { nuevos: p.taken, iguales: p.same, elegir: p.choices })) +
        (p.recordings > 0 ? ` · ${t('recibir.grabaciones', { n: p.recordings })}` : '')

  // 3. Brought in: what came, and on to bring the versions together.
  if (done) {
    return screen(
      <>
        <p className="review-done">✓ {t('equipo.recibido', { nombres: namesTogether(done.names, t('juntar.y')) })}</p>
        {done.takes > 0 && <p className="quiet">{t('recibir.grabacionesEntraron', { n: done.takes })}</p>}
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
      {found && found.length === 0 && !sealed && <p>{t('equipo.nadie')}</p>}
      {sealed > 0 && <p className="status">{t('equipo.sellado', { n: sealed })}</p>}
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
        <div className="status team-problem" role="status">
          <span>{t(`door43.problema.${problem}`)}</span>
          {(problem === 'scope' || problem === 'signin') && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                // The key kept is the trouble: forgotten, and the account linked again on the same Door43.
                forgetAccount(person)
                setRelinkHost(account.host)
                setAccount(null)
                setProblem(null)
                setLinking(true)
              }}
            >
              ↻ {t('equipo.vincularOtraVez')}
            </button>
          )}
        </div>
      )}
      {password && (
        // The one thing on the screen while it is asked: bringing and leaving come back once it is used, or not now.
        <>
          <TeamPassword
            id={project.id}
            name={project.name}
            person={person}
            said={t('equipo.faltaContrasena', { proyecto: project.name })}
            working={t('equipo.dejando')}
            then={async () => {
              setPassword(false)
              await leave()
            }}
          />
          <button type="button" className="button-quiet" onClick={() => setPassword(false)}>
            {t('marco.ahoraNo')}
          </button>
        </>
      )}
      {left && (
        <p className="status" role="status">
          ✓ {t('equipo.dejado')}
        </p>
      )}
      {waits.length > 0 && (
        <div className="status waiting-here" role="status">
          <span>
            {unreached && `${t('espera.sinLlegar')} `}
            {(online ? (que: string) => t('espera.pendiente', { que }) : (que: string) => t('espera.esperaInternet', { que }))(
              namesTogether(
                [...new Set(waits.map((e) => e.kind))].map((k) => t(`espera.que.${k}`)),
                t('juntar.y')
              )
            )}
          </span>
          <button type="button" className="chip" onClick={() => waits.forEach((e) => drop(e.id))}>
            {t('espera.quitar')}
          </button>
        </div>
      )}
      {!online && !waits.length && <p className="status">{t('equipo.sinInternet')}</p>}
      {password ? null : found && anyNew ? (
        <button type="button" className="button-primary" onClick={receiveAll}>
          {t('equipo.recibirTodo')}
        </button>
      ) : (
        (online || !waitsFor('traer')) && (
          <button type="button" className="button-primary" disabled={busy !== null} onClick={bring}>
            {busy === 'trayendo' ? t('equipo.trayendo') : online ? t('equipo.traer') : t('equipo.traerLuego')}
          </button>
        )
      )}
      {!password && (online || !waitsFor('dejar')) && (
        <button type="button" className="button-secondary" disabled={busy !== null} onClick={leave}>
          {busy === 'dejando' ? t('equipo.dejando') : online ? t('equipo.dejar') : t('equipo.dejarLuego')}
        </button>
      )}
      <p className="quiet">{t('equipo.cuenta', { usuario: account.username })}</p>
    </>
  )
}
