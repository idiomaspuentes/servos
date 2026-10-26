/**
 * Internet is back: what waited for it (design 6.11), shown before it goes. Each errand says what goes and where, as
 * the work is now, and whether it changed since it was asked; one can be taken back, and all go with one touch. Nothing
 * goes unseen.
 */

import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { accountOf, destinationOf, problemOf, workRepoOf, type Problem } from '../projects/door43'
import { arrive } from '../frame/arriving'
import { bringFromDoor43 } from '../projects/publishing'
import type { Project } from '../projects/model'
import { drop, errandNow, runErrand, sendWaiting, versionToMark, type Errand, type Sent } from '../projects/outbox'

type Result = { sent: Sent } | { problem: Problem }

export function WaitingSheet({
  errands,
  projects,
  person,
  onClose,
  onBring,
  onTeamPassword,
}: {
  errands: Errand[]
  projects: Project[]
  person: string
  onClose(): void
  /** Opens the team's work of a book, bringing it in at once. */
  onBring(projectId: string, book: string): void
  /** Opens the team's work of a book to type the team's password, which leaving the work there waits for. */
  onTeamPassword(projectId: string, book: string): void
}) {
  const t = useT()
  const [versions, setVersions] = useState<Record<string, number | null>>({})
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<Map<string, Result> | null>(null)
  // What was sent stays in the list with how it went, until the sheet closes; all taken back, nothing is left to ask.
  const [shown, setShown] = useState(errands)
  useEffect(() => {
    if (results || sending) return
    setShown(errands)
    if (!errands.length) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errands, results, sending])
  const projectOf = (id: string) => projects.find((p) => p.id === id)
  const date = (iso: string) =>
    new Date(iso).toLocaleString(document.documentElement.lang || undefined, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

  // The version's number is Door43's to say: asked as the sheet opens, with internet.
  useEffect(() => {
    for (const e of errands.filter((x) => x.kind === 'version' && !(x.id in versions)))
      void versionToMark(e).then((n) => setVersions((v) => ({ ...v, [e.id]: n })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errands])

  const list = shown.filter((e) => projectOf(e.projectId))
  const sends = list.some((e) => e.kind !== 'traer')
  const brings = list.some((e) => e.kind === 'traer')
  const go = async () => {
    setSending(true)
    const done = await sendWaiting(list, (e) =>
      runErrand(e, projectOf(e.projectId)!, {
        message: (books) => t('espera.mensaje', { nombre: person, libros: books }),
        note: t('espera.nota', { nombre: person }),
      })
    )
    setResults(done)
    setSending(false)
  }
  const brought = list.find((e) => e.kind === 'traer' && results?.has(e.id) && 'sent' in results.get(e.id)!)
  // An upload that found another text on Door43 (someone else uploaded): brought into «Receive» to gather it first.
  const behind = list.find((e) => results?.get(e.id) && 'problem' in results.get(e.id)! && (results.get(e.id) as { problem: Problem }).problem === 'changed')
  const [bringing, setBringing] = useState(false)
  const [notBrought, setNotBrought] = useState<Problem | null>(null)
  const bring = async (e: Errand) => {
    const account = accountOf(e.person)
    const to = destinationOf(e.projectId)
    if (!account || !to) return
    setBringing(true)
    try {
      const file = await bringFromDoor43(account, to, projectOf(e.projectId)!)
      if (file) arrive({ name: 'Door43', text: JSON.stringify(file) })
      onClose()
    } catch (err) {
      setNotBrought(problemOf(err))
    } finally {
      setBringing(false)
    }
  }
  // Work left for a team-only project waits for the team's password, typed where the team's work is.
  const locked = list.find((e) => {
    const r = results?.get(e.id)
    return r !== undefined && 'problem' in r && r.problem === 'teamPassword'
  })
  const failed = results !== null && list.some((e) => !results.has(e.id) || 'problem' in results.get(e.id)!)

  // The books as they are now, read once for each errand (a whole book is written out to be read).
  const nows = useMemo(
    () => new Map(list.map((e) => [e.id, errandNow(e, projectOf(e.projectId)!)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.map((e) => e.id).join()]
  )
  const what = (e: Errand) => {
    const project = projectOf(e.projectId)!
    const now = nows.get(e.id) ?? errandNow(e, project)
    const titles = now.books.map((b) => b.title).join(', ')
    const takes = now.books.reduce((n, b) => n + b.takes.length, 0)
    const where = now.to ? `${now.to.owner}/${now.to.repo}` : ''
    const title =
      e.kind === 'subir'
        ? t('espera.subir', { libros: titles })
        : e.kind === 'version'
          ? versions[e.id]
            ? t('espera.version', { libros: titles, n: versions[e.id]! })
            : t('espera.versionSiguiente', { libros: titles })
          : e.kind === 'dejar'
            ? t('espera.dejar')
            : t('espera.traer')
    // The team's work goes beside the project, to its own repository.
    const work = now.to ? workRepoOf(now.to) : null
    const details = [
      (e.kind === 'dejar' || e.kind === 'traer') && work ? `${work.owner}/${work.repo}` : where,
      e.kind === 'dejar' ? titles : '',
      (e.kind === 'version' || e.kind === 'dejar') && takes > 0 ? t('espera.grabaciones', { n: takes }) : '',
    ].filter(Boolean)
    const asked = t('espera.pedido', { fecha: date(e.at) }) + (now.changed ? ` · ${t('espera.cambio')}` : '')
    return { title, details: details.join(' · '), asked, project: project.name }
  }
  const outcome = (e: Errand) => {
    const r = results?.get(e.id)
    if (!r) return results ? <span className="quiet">{t('espera.noSeIntento')}</span> : null
    if ('problem' in r) return <span className="waiting-problem">{t(`door43.problema.${r.problem}`)}</span>
    const s = r.sent
    return (
      <span className="waiting-done">
        ✓{' '}
        {s.kind === 'subir'
          ? t('espera.subido', { escritos: s.written, iguales: s.same })
          : s.kind === 'version'
            ? t('espera.versionHecha', { n: s.n }) + (s.takes ? ` · ${t('espera.grabaciones', { n: s.takes })}` : '')
            : s.kind === 'dejar'
              ? t('espera.dejado')
              : t('espera.listoParaTraer')}
      </span>
    )
  }
  const several = new Set(list.map((e) => e.projectId)).size > 1

  return (
    <Sheet title={t('espera.titulo')} onClose={onClose}>
      <div className="waiting">
        <p>{results ? (failed ? t('espera.quedan') : t('espera.todoListo')) : t('espera.ayuda')}</p>
        <ul className="waiting-list">
          {list.map((e) => {
            const w = what(e)
            return (
              <li key={e.id} className="waiting-item">
                <div className="waiting-what">
                  <strong>{w.title}</strong>
                  {several && <span className="quiet">{w.project}</span>}
                  {w.details && <span className="quiet">{w.details}</span>}
                  {!results && <span className="quiet">{w.asked}</span>}
                  {!results && e.problem && <span className="waiting-problem">{t(`door43.problema.${e.problem}`)}</span>}
                  {outcome(e)}
                </div>
                {!results && !sending && (
                  <button type="button" className="chip" onClick={() => drop(e.id)}>
                    {t('espera.quitar')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <div className="waiting-actions">
          {!results ? (
            <>
              <button type="button" className="button-primary" disabled={sending || !list.length} onClick={() => void go()}>
                {sending ? t('espera.enviando') : sends && brings ? t('espera.enviarYTraer') : brings ? t('espera.traerAhora') : t('espera.enviar')}
              </button>
              <button type="button" className="button-quiet" disabled={sending} onClick={onClose}>
                {t('espera.ahoraNo')}
              </button>
            </>
          ) : behind ? (
            <>
              {notBrought && <p className="waiting-problem">{t(`door43.problema.${notBrought}`)}</p>}
              <button type="button" className="button-primary" disabled={bringing} onClick={() => void bring(behind)}>
                {bringing ? t('publicar.trayendo') : t('publicar.traerDoor43')}
              </button>
            </>
          ) : brought ? (
            <button type="button" className="button-primary" onClick={() => onBring(brought.projectId, brought.book ?? projectOf(brought.projectId)!.books[0].code)}>
              {t('espera.verLoQueTrajo')} →
            </button>
          ) : locked ? (
            <>
              <button type="button" className="button-primary" onClick={() => onTeamPassword(locked.projectId, locked.book ?? projectOf(locked.projectId)!.books[0].code)}>
                {t('espera.escribirContrasena')} →
              </button>
              <button type="button" className="button-quiet" onClick={onClose}>
                {t('espera.ahoraNo')}
              </button>
            </>
          ) : (
            <button type="button" className="button-primary" onClick={onClose}>
              {t('espera.listo')}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
