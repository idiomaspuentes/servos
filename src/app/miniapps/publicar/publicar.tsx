/**
 * Publicar en Door43 (design, section 8): the project's books, translated and aligned as they are, uploaded to the
 * team's repository on Door43, each upload kept in its history there; and, when the team holds what is there good, a
 * numbered version. One thing to do at a time: link the account, choose where (once), upload. What changed since the
 * last upload from this phone is said book by book (philosophy, principle 8: on the phone is not on Door43).
 */

import { useEffect, useMemo, useState } from 'react'
import { chapterOf, chaptersOf, type PrototypeData } from '../../../prototype/data'
import { useT } from '../../i18n/i18n'
import { Door43AccountSheet } from '../../screens/Door43Account'
import { readAlignment } from '../../projects/alignment'
import {
  accountOf,
  destinationOf,
  fileOf,
  fingerprint,
  hostName,
  keepUploaded,
  manifestOf,
  markVersion,
  nextVersion,
  organizationsOf,
  problemOf,
  proposedRepo,
  publish,
  repoUrl,
  setDestination,
  uploadedOf,
  type Destination,
  type FileResult,
} from '../../projects/door43'
import { titleOf } from '../../projects/model'
import { bookUsfm } from '../../projects/usfmExport'
import { textOf } from '../../projects/work'
import type { MiniApp, MiniAppCenterProps } from '../contract'

type BookState = { code: string; title: string; usfm: string; written: number; total: number; aligned: number }

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
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [, redraw] = useState(0)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])

  // Each book of the project whose texts are on this phone, as it would be uploaded now.
  const books = useMemo<BookState[]>(
    () =>
      project.books.flatMap((b) => {
        const chapters = chaptersOf(b.code)
          .map((c) => chapterOf(b.code, c))
          .filter((d): d is PrototypeData => Boolean(d))
        if (!chapters.length) return []
        const title = titleOf(project, b.code)
        const original = chapters[0].texts.find((x) => x.original)?.abbreviation
        let written = 0
        let total = 0
        let aligned = 0
        for (const d of chapters)
          for (const { verse } of d.verses) {
            total++
            if (textOf(b.code, d.chapter, verse).trim()) written++
            if (original && readAlignment(b.code, d.chapter, verse, original)?.groups.length) aligned++
          }
        return [{ code: b.code, title, usfm: bookUsfm(b.code, project.name, chapters, 'TPL', b.name, true), written, total, aligned }]
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, results]
  )
  const withText = books.filter((b) => b.written > 0)
  // Books of the project whose texts are not on this phone: said, not left out unseen (principle 8).
  const missing = project.books.filter((b) => !books.some((x) => x.code === b.code))
  // The prototype shared as a page inside Claude may not reach other sites: said before trying, not as a failure.
  const inPage = typeof window !== 'undefined' && 'claude' in window
  const date = (iso: string) => new Date(iso).toLocaleDateString(document.documentElement.lang || undefined)
  const where = (host: string) => t(`door43.host.${hostName(host)}`)

  const upload = async () => {
    if (!account || !to) return
    setBusy(true)
    setProblem(null)
    setResults(null)
    setVersioned(null)
    try {
      const files = [
        ...withText.map((b) => ({ path: fileOf(b.code), content: b.usfm })),
        { path: 'manifest.yaml', content: manifestOf(project, to.owner, to.repo, withText.map((b) => ({ code: b.code, title: b.title }))) },
      ]
      const done = await publish(account, to, files, t('publicar.mensaje', { nombre: person.name, libros: withText.map((b) => b.title).join(', ') }))
      const now = new Date().toISOString()
      for (const b of withText) {
        const r = done.find((x) => x.path === fileOf(b.code))
        if (r && r.state !== 'failed') keepUploaded(project.id, b.code, { at: now, by: person.name, key: fingerprint(b.usfm) })
      }
      setResults(done)
      const failed = done.find((r) => r.state === 'failed')
      if (failed) setProblem(t(`door43.problema.${failed.problem ?? 'other'}`))
      else setVersion(await nextVersion(account, to))
    } catch (e) {
      setProblem(t(`door43.problema.${problemOf(e)}`))
    } finally {
      setBusy(false)
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
  const written = results?.filter((r) => r.state === 'written' && r.path !== 'manifest.yaml').length ?? 0
  const same = results?.filter((r) => r.state === 'same' && r.path !== 'manifest.yaml').length ?? 0
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
          const state = !b.written ? 'vacio' : !up ? 'nunca' : up.key === fingerprint(b.usfm) ? 'igual' : 'cambio'
          return (
            <li key={b.code} className={`publish-book is-${state}`}>
              <span className="publish-book-name">{b.title}</span>
              <span className="quiet">{t('publicar.traducidos', { n: b.written, total: b.total, a: b.aligned })}</span>
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
          ✓ {t('publicar.subido', { escritos: written, iguales: same })}{' '}
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
      {!online && <p className="status">{t('publicar.sinInternet')}</p>}

      {results && !problem && version !== null && versioned === null ? (
        <section className="publish-version">
          <p className="quiet">{t('publicar.versionAyuda')}</p>
          <button
            type="button"
            className="button-secondary"
            onClick={async () => {
              try {
                await markVersion(account, to, version, t('publicar.versionNota', { nombre: person.name }))
                setVersioned(version)
              } catch (e) {
                setProblem(t(`door43.problema.${problemOf(e)}`))
              }
            }}
          >
            {t('publicar.version', { n: version })}
          </button>
        </section>
      ) : null}
      {versioned !== null && <p className="review-done">✓ {t('publicar.versionHecha', { n: versioned })}</p>}

      <button type="button" className="button-primary publish-go" disabled={busy || !online || withText.length === 0} onClick={() => void upload().then(() => redraw((n) => n + 1))}>
        {busy ? t('publicar.subiendo') : t('publicar.subir')}
      </button>
    </div>
  )
}

/** Where the project goes: one of the account's organizations, and the repository's name. */
function DestinationForm({
  host,
  proposed,
  organizations,
  projectName,
  onSave,
  onCancel,
}: {
  host: string
  proposed: Destination
  organizations(): Promise<string[]>
  projectName: string
  onSave(d: Destination): void
  onCancel?(): void
}) {
  const t = useT()
  const [orgs, setOrgs] = useState<string[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [owner, setOwner] = useState(proposed.owner)
  const [repo, setRepo] = useState(proposed.repo)
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
      <h2 className="publish-heading">{t('publicar.destinoPregunta', { proyecto: projectName })}</h2>
      <p className="quiet">{t('publicar.destinoAyuda')}</p>
      <fieldset className="field">
        <legend className="field-label">{t('publicar.organizacion')}</legend>
        {failed && <p className="notice">{failed}</p>}
        {orgs === null && !failed && <p className="quiet">{t('publicar.buscandoOrganizaciones')}</p>}
        {orgs?.length === 0 && <p className="notice">{t('publicar.sinOrganizaciones')}</p>}
        {orgs?.map((o) => (
          <button key={o} type="button" className={owner === o ? 'option is-on' : 'option'} aria-pressed={owner === o} onClick={() => setOwner(o)}>
            <span className="option-title">{o}</span>
          </button>
        ))}
      </fieldset>
      <label className="field">
        <span className="field-label">{t('publicar.repositorio')}</span>
        <input value={repo} onChange={(e) => setRepo(e.target.value.trim())} autoCapitalize="none" spellCheck={false} />
        <span className="quiet">{t('publicar.repositorioAyuda')}</span>
      </label>
      <button type="submit" className="button-primary" disabled={!valid}>
        {t('publicar.guardarDestino')}
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
      descripcion: 'Subir el proyecto a Door43, cada libro con su alineación, y marcar versiones',
      sinCuenta: 'Para publicar, vincule su cuenta de Door43. Se hace una vez en este teléfono.',
      vincularCuenta: 'Vincular mi cuenta de Door43',
      destinoPregunta: '¿Dónde se publica «{proyecto}»?',
      destinoAyuda: 'En una organización del equipo en Door43, un repositorio para todo el proyecto. Se elige una vez.',
      organizacion: 'Organización',
      buscandoOrganizaciones: 'Buscando sus organizaciones en Door43…',
      sinOrganizaciones: 'Esta cuenta no está en ninguna organización de Door43. Pida a quien coordina que la agregue.',
      repositorio: 'Repositorio',
      repositorioAyuda: 'Su idioma y «reg», como Door43 llama a una Biblia que traduce un equipo. Puede cambiarlo.',
      guardarDestino: 'Publicar ahí',
      noCambiar: 'Dejarlo como estaba',
      comoQuien: 'Publica {usuario}.',
      cambiar: 'Cambiar',
      libros: 'Lo que se sube',
      nada: 'Este proyecto todavía no tiene libros en este teléfono.',
      traducidos: 'Versículos traducidos: {n} de {total} · alineados: {a}',
      'estado.vacio': 'Sin texto todavía: no se sube',
      'estado.nunca': 'Todavía no se subió',
      'estado.igual': 'Subido el {fecha} por {nombre}, sin cambios desde entonces',
      'estado.cambio': 'Subido el {fecha}; cambió desde entonces',
      subir: 'Subir a Door43',
      subiendo: 'Subiendo…',
      mensaje: 'Servos: {nombre} sube {libros}',
      sinInternet: 'Sin internet ahora. Lo hecho está guardado en este teléfono: súbalo cuando haya conexión.',
      subido: 'Subido a Door43. Libros con cambios: {escritos} · sin cambios: {iguales}.',
      verEnDoor43: 'Ver en Door43',
      versionAyuda: 'Cuando el equipo da por bueno lo que está en Door43, se marca como una versión con número.',
      version: 'Marcar esto como la versión {n}',
      versionNota: 'Marcada desde Servos por {nombre}.',
      versionHecha: 'Versión {n} marcada en Door43.',
      sinTextos: 'Sus textos y ayudas no están en este teléfono: no se sube desde aquí',
      enLaPagina: 'Esta es una página de prueba dentro de Claude, que no puede conectarse a Door43. En la app instalada, esto sube el proyecto.',
    },
    pt: {
      nombre: 'Publicar no Door43',
      descripcion: 'Enviar o projeto ao Door43, cada livro com seu alinhamento, e marcar versões',
      sinCuenta: 'Para publicar, vincule sua conta do Door43. Faz-se uma vez neste telefone.',
      vincularCuenta: 'Vincular minha conta do Door43',
      destinoPregunta: 'Onde se publica «{proyecto}»?',
      destinoAyuda: 'Numa organização da equipe no Door43, um repositório para todo o projeto. Escolhe-se uma vez.',
      organizacion: 'Organização',
      buscandoOrganizaciones: 'Buscando suas organizações no Door43…',
      sinOrganizaciones: 'Esta conta não está em nenhuma organização do Door43. Peça a quem coordena que a adicione.',
      repositorio: 'Repositório',
      repositorioAyuda: 'Sua língua e «reg», como o Door43 chama uma Bíblia que uma equipe traduz. Pode mudá-lo.',
      guardarDestino: 'Publicar ali',
      noCambiar: 'Deixar como estava',
      comoQuien: 'Publica {usuario}.',
      cambiar: 'Mudar',
      libros: 'O que se envia',
      nada: 'Este projeto ainda não tem livros neste telefone.',
      traducidos: 'Versículos traduzidos: {n} de {total} · alinhados: {a}',
      'estado.vacio': 'Ainda sem texto: não se envia',
      'estado.nunca': 'Ainda não foi enviado',
      'estado.igual': 'Enviado em {fecha} por {nombre}, sem mudanças desde então',
      'estado.cambio': 'Enviado em {fecha}; mudou desde então',
      subir: 'Enviar ao Door43',
      subiendo: 'Enviando…',
      mensaje: 'Servos: {nombre} envia {libros}',
      sinInternet: 'Sem internet agora. O que foi feito está salvo neste telefone: envie quando houver conexão.',
      subido: 'Enviado ao Door43. Livros com mudanças: {escritos} · sem mudanças: {iguales}.',
      verEnDoor43: 'Ver no Door43',
      versionAyuda: 'Quando a equipe dá por bom o que está no Door43, marca-se como uma versão com número.',
      version: 'Marcar isto como a versão {n}',
      versionNota: 'Marcada pelo Servos por {nombre}.',
      versionHecha: 'Versão {n} marcada no Door43.',
      sinTextos: 'Seus textos e ajudas não estão neste telefone: não se envia daqui',
      enLaPagina: 'Esta é uma página de teste dentro do Claude, que não pode se conectar ao Door43. No app instalado, isto envia o projeto.',
    },
    en: {
      nombre: 'Publish on Door43',
      descripcion: 'Upload the project to Door43, each book with its alignment, and mark versions',
      sinCuenta: 'To publish, link your Door43 account. It is done once on this phone.',
      vincularCuenta: 'Link my Door43 account',
      destinoPregunta: 'Where is «{proyecto}» published?',
      destinoAyuda: "In one of the team's organizations on Door43, one repository for the whole project. Chosen once.",
      organizacion: 'Organization',
      buscandoOrganizaciones: 'Looking for your organizations on Door43…',
      sinOrganizaciones: 'This account is in no Door43 organization. Ask whoever coordinates to add it.',
      repositorio: 'Repository',
      repositorioAyuda: 'Your language and «reg», as Door43 names a Bible a team translates. You can change it.',
      guardarDestino: 'Publish there',
      noCambiar: 'Leave it as it was',
      comoQuien: '{usuario} publishes.',
      cambiar: 'Change',
      libros: 'What is uploaded',
      nada: 'This project has no books on this phone yet.',
      traducidos: 'Verses translated: {n} of {total} · aligned: {a}',
      'estado.vacio': 'No text yet: not uploaded',
      'estado.nunca': 'Not uploaded yet',
      'estado.igual': 'Uploaded on {fecha} by {nombre}, unchanged since',
      'estado.cambio': 'Uploaded on {fecha}; changed since',
      subir: 'Upload to Door43',
      subiendo: 'Uploading…',
      mensaje: 'Servos: {nombre} uploads {libros}',
      sinInternet: 'No internet now. What was done is kept on this phone: upload it when there is a connection.',
      subido: 'Uploaded to Door43. Books with changes: {escritos} · unchanged: {iguales}.',
      verEnDoor43: 'See on Door43',
      versionAyuda: 'When the team holds what is on Door43 good, it is marked as a numbered version.',
      version: 'Mark this as version {n}',
      versionNota: 'Marked from Servos by {nombre}.',
      versionHecha: 'Version {n} marked on Door43.',
      sinTextos: 'Its texts and helps are not on this phone: not uploaded from here',
      enLaPagina: 'This is a test page inside Claude, which cannot reach Door43. In the installed app, this uploads the project.',
    },
  },
}
