/**
 * Publicar en Door43 (design, section 8): the project's books, translated and aligned as they are, uploaded to the
 * team's repository on Door43, each upload kept in its history there; and, when the team holds what is there good, a
 * numbered version, with the recordings said aloud (for each place, the take that counts). One thing to do at a time:
 * link the account, choose where (once), upload. What changed since the last upload from this phone is said book by
 * book (philosophy, principle 8: on the phone is not on Door43). Without internet, uploading or marking a version is
 * asked all the same: it waits on the phone, and goes when there is internet and the person says yes (design 6.11).
 */

import { useEffect, useMemo, useState } from 'react'
import { useOnline, useWaiting } from '../../frame/online'
import { useT } from '../../i18n/i18n'
import { Door43AccountSheet } from '../../screens/Door43Account'
import {
  accountOf,
  destinationOf,
  hostName,
  nextVersion,
  organizationsOf,
  problemOf,
  proposedRepo,
  repoUrl,
  setDestination,
  uploadedOf,
  type Destination,
  type FileResult,
  type Problem,
} from '../../projects/door43'
import { titleOf } from '../../projects/model'
import { ask, drop, keysOf, settle, type ErrandKind } from '../../projects/outbox'
import { booksOf, markVersionWithTakes, uploadProject, withWorkOf, type BookToPublish } from '../../projects/publishing'
import type { MiniApp, MiniAppCenterProps } from '../contract'

function Center({ context }: MiniAppCenterProps) {
  const { t, project, person } = context
  const [account, setAccount] = useState(() => accountOf(person.name))
  const [linking, setLinking] = useState(false)
  const [to, setTo] = useState<Destination | null>(() => destinationOf(project.id))
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<FileResult[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [versioned, setVersioned] = useState<number | null>(null)
  const [versionTakes, setVersionTakes] = useState(0)
  const [marking, setMarking] = useState(false)
  // Tried with the phone saying it was online, and Door43 could not be reached: it waits all the same.
  const [unreached, setUnreached] = useState(false)
  const online = useOnline()
  const waits = useWaiting(person.name).filter((e) => e.projectId === project.id && (e.kind === 'subir' || e.kind === 'version'))
  const waitsFor: ErrandKind | null = waits.find((e) => e.kind === 'version') ? 'version' : waits.length ? 'subir' : null

  // Each book of the project whose texts are on this phone, as it would be uploaded now.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const books = useMemo<BookToPublish[]>(() => booksOf(project), [project, results])
  const withWork = withWorkOf(books)
  // Books of the project whose texts are not on this phone: said, not left out unseen (principle 8).
  const missing = project.books.filter((b) => !books.some((x) => x.code === b.code))
  const stateOf = (b: BookToPublish) => {
    const up = uploadedOf(project.id, b.code)
    return !b.written && !b.takes.length ? 'vacio' : !up ? 'nunca' : up.key === b.key ? 'igual' : 'cambio'
  }
  // Everything is on Door43 as it is here: a version can be marked without uploading again.
  const allUp = withWork.length > 0 && withWork.every((b) => stateOf(b) === 'igual')
  // The prototype shared as a page inside Claude may not reach other sites: said before trying, not as a failure.
  const inPage = typeof window !== 'undefined' && 'claude' in window
  const date = (iso: string) => new Date(iso).toLocaleDateString(document.documentElement.lang || undefined)
  const where = (host: string) => t(`door43.host.${hostName(host)}`)

  // The next version's number is Door43's to say.
  useEffect(() => {
    if (!account || !to || !online || !allUp || version !== null) return
    let gone = false
    nextVersion(account, to)
      .then((n) => !gone && setVersion(n))
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [account, to, online, allUp, version])

  // Kept to go when there is internet, as the books are when it goes.
  const later = (kind: 'subir' | 'version', tried: boolean) => {
    ask({ kind, projectId: project.id, person: person.name, keys: keysOf(books) })
    setResults(null)
    setProblem(null)
    setUnreached(tried)
  }
  const failed = (e: unknown, kind: 'subir' | 'version') => {
    const p: Problem = problemOf(e)
    if (p === 'offline') later(kind, true)
    else setProblem(t(`door43.problema.${p}`))
  }

  const upload = async () => {
    if (!account || !to) return
    if (!online) return later('subir', false)
    setBusy(true)
    setProblem(null)
    setResults(null)
    setVersioned(null)
    setUnreached(false)
    try {
      const { results: done } = await uploadProject(account, to, project, person.name, (libros) => t('publicar.mensaje', { nombre: person.name, libros }))
      const failedFile = done.find((r) => r.state === 'failed')
      if (failedFile?.problem === 'offline') return later('subir', true)
      setResults(done)
      if (failedFile) setProblem(t(`door43.problema.${failedFile.problem ?? 'other'}`))
      else {
        settle('subir', project.id, person.name)
        setVersion(await nextVersion(account, to).catch(() => null))
      }
    } catch (e) {
      failed(e, 'subir')
    } finally {
      setBusy(false)
    }
  }

  const mark = async () => {
    if (!account || !to) return
    if (!online || version === null) return later('version', false)
    setMarking(true)
    setProblem(null)
    try {
      setVersionTakes(await markVersionWithTakes(account, to, withWork, version, t('publicar.versionNota', { nombre: person.name })))
      settle('version', project.id, person.name)
      setVersioned(version)
    } catch (e) {
      failed(e, 'version')
    } finally {
      setMarking(false)
    }
  }

  // 1. Who publishes: an account linked on this phone.
  if (!account) {
    return (
      <div className="publish">
        <p>{t('publicar.sinCuenta')}</p>
        {inPage && <p className="status">{t('publicar.enLaPagina')}</p>}
        <button type="button" className="button-primary" onClick={() => setLinking(true)}>
          {t('publicar.vincularCuenta')}
        </button>
        {linking && (
          <Door43AccountSheet
            person={person.name}
            onClose={() => setLinking(false)}
            onLinked={(a) => {
              setAccount(a)
              setLinking(false)
            }}
          />
        )}
      </div>
    )
  }

  // 2. Where: chosen once for the project.
  if (!to || choosing) {
    return (
      <div className="publish">
        <DestinationForm
          host={account.host}
          proposed={to ?? { host: account.host, owner: '', repo: proposedRepo(project) }}
          organizations={() => organizationsOf(account)}
          projectName={project.name}
          onSave={(d) => {
            setDestination(project.id, d)
            setTo(d)
            setChoosing(false)
          }}
          onCancel={to ? () => setChoosing(false) : undefined}
        />
      </div>
    )
  }

  // 3. Upload.
  const written = results?.filter((r) => r.state === 'written' && r.path.endsWith('.usfm')).length ?? 0
  const same = results?.filter((r) => r.state === 'same' && r.path.endsWith('.usfm')).length ?? 0
  // Recordings of the books uploaded: they go with the version marked, not with the text.
  const takes = withWork.reduce((n, b) => n + b.takes.length, 0)
  // A version: once everything is up (with internet, its number known), or to wait with the upload for internet.
  const versionNow = online && version !== null && allUp
  const versionLater = !online && waitsFor !== 'version' && (allUp || waitsFor === 'subir')
  const showVersion = versioned === null && !problem && !busy && (versionNow || versionLater)
  return (
    <div className="publish">
      <section className="publish-where">
        <div className="publish-where-head">
          <p>
            <strong>
              {to.owner}/{to.repo}
            </strong>{' '}
            <span className="quiet">· {where(to.host)}</span>
          </p>
          <button type="button" className="chip" onClick={() => setChoosing(true)}>
            ✎ {t('publicar.cambiar')}
          </button>
        </div>
        <p className="quiet">{t('publicar.comoQuien', { usuario: account.username })}</p>
      </section>

      <h2 className="publish-heading">{t('publicar.libros')}</h2>
      {books.length === 0 && <p className="quiet">{t('publicar.nada')}</p>}
      {inPage && <p className="status">{t('publicar.enLaPagina')}</p>}
      <ul className="publish-books">
        {books.map((b) => {
          const up = uploadedOf(project.id, b.code)
          const state = stateOf(b)
          return (
            <li key={b.code} className={`publish-book is-${state}`}>
              <span className="publish-book-name">{b.title}</span>
              <span className="quiet">
                {t('publicar.traducidos', { n: b.written, total: b.total, a: b.aligned })}
                {b.takes.length > 0 && ` · ${t('publicar.grabaciones', { n: b.takes.length })}`}
              </span>
              <span className="publish-book-state">{t(`publicar.estado.${state}`, { fecha: up ? date(up.at) : '', nombre: up?.by ?? '' })}</span>
            </li>
          )
        })}
        {missing.map((b) => (
          <li key={b.code} className="publish-book is-fuera">
            <span className="publish-book-name">{titleOf(project, b.code)}</span>
            <span className="publish-book-state">{t('publicar.sinTextos')}</span>
          </li>
        ))}
      </ul>

      {results && !problem && (
        <p className="review-done" role="status">
          ✓ {t('publicar.subido', { escritos: written, iguales: same })}
          {takes > 0 && ` ${t('publicar.grabacionesConVersion')}`}{' '}
          <a href={repoUrl(to)} target="_blank" rel="noreferrer">
            {t('publicar.verEnDoor43')}
          </a>
        </p>
      )}
      {problem && (
        <p className="notice" role="alert">
          {problem}
        </p>
      )}
      {waitsFor ? (
        <div className="status waiting-here" role="status">
          <span>
            {unreached && `${t('espera.sinLlegar')} `}
            {online ? t('espera.pendiente', { que: t(`espera.que.${waitsFor}`) }) : t('espera.esperaInternet', { que: t(`espera.que.${waitsFor}`) })}
          </span>
          <button type="button" className="chip" onClick={() => waits.forEach((e) => drop(e.id))}>
            {t('espera.quitar')}
          </button>
        </div>
      ) : (
        !online && <p className="status">{t('publicar.sinInternet')}</p>
      )}

      {showVersion && (
        <section className="publish-version">
          <p className="quiet">
            {t('publicar.versionAyuda')}
            {takes > 0 && ` ${t('publicar.versionAyudaGrabaciones')}`}
          </p>
          <button type="button" className="button-secondary" disabled={marking} onClick={() => void mark()}>
            {marking ? t('publicar.marcando') : versionNow ? t('publicar.version', { n: version }) : t('publicar.versionLuego')}
          </button>
        </section>
      )}
      {versioned !== null && (
        <p className="review-done">
          ✓ {t('publicar.versionHecha', { n: versioned })}
          {versionTakes > 0 && ` ${t('publicar.versionConGrabaciones', { n: versionTakes })}`}
        </p>
      )}

      {(online || !waitsFor) && (
        <button type="button" className="button-primary publish-go" disabled={busy || withWork.length === 0} onClick={() => void upload()}>
          {busy ? t('publicar.subiendo') : online ? t('publicar.subir') : t('publicar.subirLuego')}
        </button>
      )}
    </div>
  )
}

/**
 * Where the project goes: one of the account's organizations, and the repository's name. One question; the
 * organizations as rows of one card (an account may belong to many); the repository's name, which few change, said
 * in a line with its chip.
 */
export function DestinationForm({
  host,
  proposed,
  organizations,
  projectName,
  onSave,
  onCancel,
  saveLabel,
  heading,
  help,
}: {
  host: string
  proposed: Destination
  organizations(): Promise<string[]>
  projectName: string
  onSave(d: Destination): void
  onCancel?(): void
  /** What saving it does, the question and its line, where the form is used for something else than publishing now. */
  saveLabel?: string
  heading?: string
  help?: string
}) {
  const t = useT()
  const [orgs, setOrgs] = useState<string[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [owner, setOwner] = useState(proposed.owner)
  const [repo, setRepo] = useState(proposed.repo)
  const [naming, setNaming] = useState(false)
  const [search, setSearch] = useState('')
  // Many organizations: a search narrows the list as it is typed (never focused by itself: the list alone is enough
  // to touch one), and the list scrolls in its own box, so what comes after it stays in sight.
  const many = (orgs?.length ?? 0) > 6
  const wanted = search.trim().toLocaleLowerCase()
  const shown = orgs?.filter((o) => !wanted || o.toLocaleLowerCase().includes(wanted)) ?? []
  const marked = (o: string) => {
    const at = wanted ? o.toLocaleLowerCase().indexOf(wanted) : -1
    return at < 0 ? (
      o
    ) : (
      <>
        {o.slice(0, at)}
        <strong>{o.slice(at, at + wanted.length)}</strong>
        {o.slice(at + wanted.length)}
      </>
    )
  }
  useEffect(() => {
    organizations()
      .then((list) => {
        setOrgs(list)
        if (!owner && list.length === 1) setOwner(list[0])
      })
      .catch((e) => setFailed(t(`door43.problema.${problemOf(e)}`)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const valid = owner && /^[A-Za-z0-9_.-]+$/.test(repo)
  return (
    <form
      className="glossary-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ host, owner, repo })
      }}
    >
      <h2 className="publish-heading">{heading ?? t('publicar.destinoPregunta', { proyecto: projectName })}</h2>
      <p className="quiet destination-help">{help ?? t('publicar.destinoAyuda')}</p>
      {failed && <p className="notice">{failed}</p>}
      {orgs === null && !failed && <p className="quiet">{t('publicar.buscandoOrganizaciones')}</p>}
      {orgs?.length === 0 && <p className="notice">{t('publicar.sinOrganizaciones')}</p>}
      {many && (
        <input
          type="search"
          className="destination-search"
          value={search}
          placeholder={t('publicar.buscarOrganizacion')}
          aria-label={t('publicar.buscarOrganizacion')}
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            // One left: Enter takes it.
            if (e.key === 'Enter') {
              e.preventDefault()
              if (shown.length === 1) setOwner(shown[0])
            }
          }}
        />
      )}
      {orgs && orgs.length > 0 && (
        <div className={many ? 'destination-orgs is-scrolled' : 'destination-orgs'} role="radiogroup" aria-label={t('publicar.organizacion')}>
          {shown.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={owner === o} className="destination-org" onClick={() => setOwner(o)}>
              <span className="destination-dot" aria-hidden="true" />
              <span>{marked(o)}</span>
            </button>
          ))}
          {!shown.length && <p className="quiet destination-none">{t('publicar.ningunaAsi', { texto: search.trim() })}</p>}
        </div>
      )}
      {naming ? (
        <label className="field">
          <span className="field-label">{t('publicar.repositorio')}</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value.trim())} autoCapitalize="none" spellCheck={false} autoFocus />
          <span className="quiet">{t('publicar.repositorioAyuda')}</span>
        </label>
      ) : (
        <div className="destination-repo">
          <span className="destination-repo-name">
            <span className="quiet">{t('publicar.repositorio')}:</span> {owner ? `${owner}/${repo}` : repo}
          </span>
          <button type="button" className="chip" onClick={() => setNaming(true)}>
            ✎ {t('publicar.cambiar')}
          </button>
        </div>
      )}
      <button type="submit" className="button-primary" disabled={!valid}>
        {saveLabel ?? t('publicar.guardarDestino')}
      </button>
      {onCancel && (
        <button type="button" className="button-secondary" onClick={onCancel}>
          {t('publicar.noCambiar')}
        </button>
      )}
    </form>
  )
}


export const publicar: MiniApp = {
  id: 'publicar',
  phase: 'publicacion',
  needs: ['text'],
  unit: 'verse',
  helps: false,
  fills: true,
  writes: false,
  positionLine: false,
  Center,
  texts: {
    es: {
      nombre: 'Publicar en Door43',
      descripcion: 'Subir el proyecto a Door43, cada libro con su alineación, y marcar versiones con sus grabaciones',
      grabaciones: 'grabaciones: {n}',
      grabacionesConVersion: 'Las grabaciones van con la versión que se marque.',
      versionAyudaGrabaciones: 'Con ella quedan, aparte del texto, las grabaciones que cuentan de cada versículo.',
      versionConGrabaciones: 'Con {n} grabaciones.',
      marcando: 'Marcando la versión…',
      sinCuenta: 'Para publicar, vincule su cuenta de Door43. Se hace una vez en este teléfono.',
      'sinCuenta.computadora': 'Para publicar, vincule su cuenta de Door43. Se hace una vez en esta computadora.',
      vincularCuenta: 'Vincular mi cuenta de Door43',
      destinoPregunta: '¿Dónde se publica «{proyecto}»?',
      destinoAyuda: 'En una organización del equipo en Door43, un repositorio para todo el proyecto. Se elige una vez.',
      organizacion: 'Organización',
      buscandoOrganizaciones: 'Buscando sus organizaciones en Door43…',
      sinOrganizaciones: 'Esta cuenta no está en ninguna organización de Door43. Pida a quien coordina que la agregue.',
      buscarOrganizacion: 'Buscar una organización',
      ningunaAsi: 'Ninguna organización lleva «{texto}».',
      repositorio: 'Repositorio',
      repositorioAyuda: 'Su idioma y «reg», como Door43 llama a una Biblia que traduce un equipo. Puede cambiarlo.',
      guardarDestino: 'Publicar ahí',
      noCambiar: 'Dejarlo como estaba',
      comoQuien: 'Publica {usuario}.',
      cambiar: 'Cambiar',
      libros: 'Lo que se sube',
      nada: 'Este proyecto todavía no tiene libros en este teléfono.',
      'nada.computadora': 'Este proyecto todavía no tiene libros en esta computadora.',
      traducidos: 'Versículos traducidos: {n} de {total} · alineados: {a}',
      'estado.vacio': 'Sin texto todavía: no se sube',
      'estado.nunca': 'Todavía no se subió',
      'estado.igual': 'Subido el {fecha} por {nombre}, sin cambios desde entonces',
      'estado.cambio': 'Subido el {fecha}; cambió desde entonces',
      subir: 'Subir a Door43',
      subiendo: 'Subiendo…',
      mensaje: 'Servos: {nombre} sube {libros}',
      sinInternet: 'Sin internet ahora. Lo hecho está guardado en este teléfono. Puede pedir que se suba: cuando haya internet, se le pregunta antes de enviarlo.',
      'sinInternet.computadora': 'Sin internet ahora. Lo hecho está guardado en esta computadora. Puede pedir que se suba: cuando haya internet, se le pregunta antes de enviarlo.',
      subirLuego: 'Subir cuando haya internet',
      versionLuego: 'Marcar una versión cuando haya internet',
      subido: 'Subido a Door43. Libros con cambios: {escritos} · sin cambios: {iguales}.',
      verEnDoor43: 'Ver en Door43',
      versionAyuda: 'Cuando el equipo da por bueno lo que está en Door43, se marca como una versión con número.',
      version: 'Marcar esto como la versión {n}',
      versionNota: 'Marcada desde Servos por {nombre}.',
      versionHecha: 'Versión {n} marcada en Door43.',
      sinTextos: 'Sus textos y ayudas no están en este teléfono: no se sube desde aquí',
      'sinTextos.computadora': 'Sus textos y ayudas no están en esta computadora: no se sube desde aquí',
      enLaPagina: 'Esta es una página de prueba dentro de Claude, que no puede conectarse a Door43. En la app instalada, esto sube el proyecto.',
    },
    pt: {
      nombre: 'Publicar no Door43',
      descripcion: 'Enviar o projeto ao Door43, cada livro com seu alinhamento, e marcar versões com suas gravações',
      grabaciones: 'gravações: {n}',
      grabacionesConVersion: 'As gravações vão com a versão que se marcar.',
      versionAyudaGrabaciones: 'Com ela ficam, à parte do texto, as gravações que contam de cada versículo.',
      versionConGrabaciones: 'Com {n} gravações.',
      marcando: 'Marcando a versão…',
      sinCuenta: 'Para publicar, vincule sua conta do Door43. Faz-se uma vez neste telefone.',
      'sinCuenta.computadora': 'Para publicar, vincule sua conta do Door43. Faz-se uma vez neste computador.',
      vincularCuenta: 'Vincular minha conta do Door43',
      destinoPregunta: 'Onde se publica «{proyecto}»?',
      destinoAyuda: 'Numa organização da equipe no Door43, um repositório para todo o projeto. Escolhe-se uma vez.',
      organizacion: 'Organização',
      buscandoOrganizaciones: 'Buscando suas organizações no Door43…',
      sinOrganizaciones: 'Esta conta não está em nenhuma organização do Door43. Peça a quem coordena que a adicione.',
      buscarOrganizacion: 'Buscar uma organização',
      ningunaAsi: 'Nenhuma organização tem «{texto}».',
      repositorio: 'Repositório',
      repositorioAyuda: 'Sua língua e «reg», como o Door43 chama uma Bíblia que uma equipe traduz. Pode mudá-lo.',
      guardarDestino: 'Publicar ali',
      noCambiar: 'Deixar como estava',
      comoQuien: 'Publica {usuario}.',
      cambiar: 'Mudar',
      libros: 'O que se envia',
      nada: 'Este projeto ainda não tem livros neste telefone.',
      'nada.computadora': 'Este projeto ainda não tem livros neste computador.',
      traducidos: 'Versículos traduzidos: {n} de {total} · alinhados: {a}',
      'estado.vacio': 'Ainda sem texto: não se envia',
      'estado.nunca': 'Ainda não foi enviado',
      'estado.igual': 'Enviado em {fecha} por {nombre}, sem mudanças desde então',
      'estado.cambio': 'Enviado em {fecha}; mudou desde então',
      subir: 'Enviar ao Door43',
      subiendo: 'Enviando…',
      mensaje: 'Servos: {nombre} envia {libros}',
      sinInternet: 'Sem internet agora. O que foi feito está salvo neste telefone. Pode pedir que seja enviado: quando houver internet, pergunta-se antes de enviar.',
      'sinInternet.computadora': 'Sem internet agora. O que foi feito está salvo neste computador. Pode pedir que seja enviado: quando houver internet, pergunta-se antes de enviar.',
      subirLuego: 'Enviar quando houver internet',
      versionLuego: 'Marcar uma versão quando houver internet',
      subido: 'Enviado ao Door43. Livros com mudanças: {escritos} · sem mudanças: {iguales}.',
      verEnDoor43: 'Ver no Door43',
      versionAyuda: 'Quando a equipe dá por bom o que está no Door43, marca-se como uma versão com número.',
      version: 'Marcar isto como a versão {n}',
      versionNota: 'Marcada pelo Servos por {nombre}.',
      versionHecha: 'Versão {n} marcada no Door43.',
      sinTextos: 'Seus textos e ajudas não estão neste telefone: não se envia daqui',
      'sinTextos.computadora': 'Seus textos e ajudas não estão neste computador: não se envia daqui',
      enLaPagina: 'Esta é uma página de teste dentro do Claude, que não pode se conectar ao Door43. No app instalado, isto envia o projeto.',
    },
    en: {
      nombre: 'Publish on Door43',
      descripcion: 'Upload the project to Door43, each book with its alignment, and mark versions with their recordings',
      grabaciones: 'recordings: {n}',
      grabacionesConVersion: 'The recordings go with the version that is marked.',
      versionAyudaGrabaciones: 'With it, apart from the text, go the recordings that count of each verse.',
      versionConGrabaciones: 'With {n} recordings.',
      marcando: 'Marking the version…',
      sinCuenta: 'To publish, link your Door43 account. It is done once on this phone.',
      'sinCuenta.computadora': 'To publish, link your Door43 account. It is done once on this computer.',
      vincularCuenta: 'Link my Door43 account',
      destinoPregunta: 'Where is «{proyecto}» published?',
      destinoAyuda: "In one of the team's organizations on Door43, one repository for the whole project. Chosen once.",
      organizacion: 'Organization',
      buscandoOrganizaciones: 'Looking for your organizations on Door43…',
      sinOrganizaciones: 'This account is in no Door43 organization. Ask whoever coordinates to add it.',
      buscarOrganizacion: 'Search for an organization',
      ningunaAsi: 'No organization has «{texto}».',
      repositorio: 'Repository',
      repositorioAyuda: 'Your language and «reg», as Door43 names a Bible a team translates. You can change it.',
      guardarDestino: 'Publish there',
      noCambiar: 'Leave it as it was',
      comoQuien: '{usuario} publishes.',
      cambiar: 'Change',
      libros: 'What is uploaded',
      nada: 'This project has no books on this phone yet.',
      'nada.computadora': 'This project has no books on this computer yet.',
      traducidos: 'Verses translated: {n} of {total} · aligned: {a}',
      'estado.vacio': 'No text yet: not uploaded',
      'estado.nunca': 'Not uploaded yet',
      'estado.igual': 'Uploaded on {fecha} by {nombre}, unchanged since',
      'estado.cambio': 'Uploaded on {fecha}; changed since',
      subir: 'Upload to Door43',
      subiendo: 'Uploading…',
      mensaje: 'Servos: {nombre} uploads {libros}',
      sinInternet: 'No internet now. What was done is kept on this phone. You can ask for it to be uploaded: when there is internet, you are asked before it is sent.',
      'sinInternet.computadora': 'No internet now. What was done is kept on this computer. You can ask for it to be uploaded: when there is internet, you are asked before it is sent.',
      subirLuego: 'Upload when there is internet',
      versionLuego: 'Mark a version when there is internet',
      subido: 'Uploaded to Door43. Books with changes: {escritos} · unchanged: {iguales}.',
      verEnDoor43: 'See on Door43',
      versionAyuda: 'When the team holds what is on Door43 good, it is marked as a numbered version.',
      version: 'Mark this as version {n}',
      versionNota: 'Marked from Servos by {nombre}.',
      versionHecha: 'Version {n} marked on Door43.',
      sinTextos: 'Its texts and helps are not on this phone: not uploaded from here',
      'sinTextos.computadora': 'Its texts and helps are not on this computer: not uploaded from here',
      enLaPagina: 'This is a test page inside Claude, which cannot reach Door43. In the installed app, this uploads the project.',
    },
  },
}
