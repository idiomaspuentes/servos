/**
 * Publishing a project to Door43 (design, section 8). A project goes to one repository of its team's organization
 * (`{owner}/{repo}`, chosen once), a Resource Container bundle: each book as `NN-BOOK.usfm`, and a `manifest.yaml`
 * that names them. Publishing uploads everything translated, each time; Door43 keeps the history of every upload. A
 * numbered version is marked apart (a release), when the team holds a state good.
 *
 * Who publishes signs in to Door43 once on this phone: the password is exchanged for a token (Taller's way), and
 * only the token is kept, by person. Without internet nothing is lost: the work stays on the phone, and the app says
 * what has changed since it was last uploaded.
 */

import {
  DcsApiError,
  PRODUCTION_HOST,
  QA_HOST,
  createOrUpdateContents,
  createOrgRepo,
  createRelease,
  decodeBase64,
  getContents,
  getRepo,
  listReleases,
  signInWithPassword,
  type ContentsResponse,
  type DcsClientConfig,
} from '../../door43/dcs'
import { BOOKS, type Project } from './model'

const KEY = 'servos.prototipo.door43'
const read = <T>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (k: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(value))
  } catch {
    /* kept for this visit */
  }
}

/** Where Door43 is: the real one, its copy for trying things (QA), and, building the app, a local mock. */
export const HOSTS: Array<{ id: 'door43' | 'qa' | 'mock'; url: string }> = [
  { id: 'door43', url: PRODUCTION_HOST },
  { id: 'qa', url: QA_HOST },
  ...(import.meta.env?.DEV ? [{ id: 'mock' as const, url: `http://${typeof location === 'undefined' ? 'localhost' : location.hostname}:8787` }] : []),
]
export const hostName = (url: string) => HOSTS.find((h) => h.url === url)?.id ?? url.replace(/^https?:\/\//, '')
const configOf = (host: string): DcsClientConfig => ({ host, userAgent: 'Servos/0.1' })

/** A person's Door43 account on this phone: the token, never the password. */
export interface Door43Account {
  host: string
  username: string
  token: string
  fullName?: string
}

export const accountOf = (person: string) => read<Door43Account>(`${KEY}.cuenta.${person}`)
export const forgetAccount = (person: string) => write(`${KEY}.cuenta.${person}`, null)

/** Signs in with a password, which is used for this one request; the token minted is kept for the person. */
export async function signIn(person: string, host: string, username: string, password: string): Promise<Door43Account> {
  const { user, token } = await signInWithPassword(configOf(host), {
    username: username.trim(),
    password,
    tokenNamePrefix: 'servos',
    scopes: ['read:user', 'read:organization', 'write:repository'],
  })
  const account = { host, username: user.login, token, fullName: user.full_name || undefined }
  write(`${KEY}.cuenta.${person}`, account)
  return account
}

/** Links a token made on Door43 itself (the other way to sign in, and the mock's). */
export async function signInWithToken(person: string, host: string, token: string): Promise<Door43Account> {
  const { getAuthenticatedUser } = await import('../../door43/dcs')
  const user = await getAuthenticatedUser(configOf(host), token.trim())
  const account = { host, username: user.login, token: token.trim(), fullName: user.full_name || undefined }
  write(`${KEY}.cuenta.${person}`, account)
  return account
}

/** The organizations an account belongs to: where its team's repositories can be. */
export async function organizationsOf(account: Door43Account): Promise<string[]> {
  const { getUserOrgs } = await import('../../door43/dcs')
  return (await getUserOrgs(configOf(account.host), account.token)).map((o) => o.name)
}

/** Where a project is published: chosen once, by whoever coordinates. */
export interface Destination {
  host: string
  owner: string
  repo: string
}
export const destinationOf = (projectId: string) => read<Destination>(`${KEY}.destino.${projectId}`)
export const setDestination = (projectId: string, d: Destination) => write(`${KEY}.destino.${projectId}`, d)

/** The repository a project is proposed: its language and «reg», as Door43 names a Bible a team translates. */
export const proposedRepo = (project: Pick<Project, 'languageCode'>) =>
  `${(project.languageCode || 'xx').toLowerCase().replace(/[^a-z0-9-]/g, '')}_reg`

/** A book's file in the repository, numbered as USFM numbers books: Genesis 01 … Malachi 39, Matthew 41 … */
export function fileOf(code: string): string {
  const i = BOOKS.findIndex(([c]) => c === code)
  const n = i < 0 ? null : i < 39 ? i + 1 : i + 2
  return n ? `${String(n).padStart(2, '0')}-${code.toUpperCase()}.usfm` : `${code.toUpperCase()}.usfm`
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

/** The Resource Container's manifest: what the repository is, in which language, and its books. */
export function manifestOf(
  project: Pick<Project, 'name' | 'languageCode' | 'languageName' | 'direction' | 'versification' | 'helpsLanguage'>,
  owner: string,
  repo: string,
  books: Array<{ code: string; title: string }>,
  today = new Date()
): string {
  const day = today.toISOString().slice(0, 10)
  const identifier = repo.includes('_') ? repo.slice(repo.indexOf('_') + 1) : repo
  const lines = [
    'dublin_core:',
    `  conformsto: 'rc0.2'`,
    `  contributor: []`,
    `  creator: ${q(owner)}`,
    `  description: ''`,
    `  format: 'text/usfm3'`,
    `  identifier: ${q(identifier)}`,
    `  issued: ${q(day)}`,
    '  language:',
    `    direction: ${q(project.direction || 'ltr')}`,
    `    identifier: ${q(project.languageCode)}`,
    `    title: ${q(project.languageName)}`,
    `  modified: ${q(day)}`,
    `  publisher: ${q(owner)}`,
    `  relation: []`,
    `  rights: 'CC BY-SA 4.0'`,
    '  source:',
    `    - identifier: 'glt'`,
    `      language: ${q(project.helpsLanguage || 'es-419')}`,
    `      version: ''`,
    `  subject: 'Aligned Bible'`,
    `  title: ${q(project.name)}`,
    `  type: 'bundle'`,
    `  version: '1'`,
    'checking:',
    `  checking_entity: [${q(owner)}]`,
    `  checking_level: '1'`,
    'projects:',
  ]
  for (const b of books) {
    const file = fileOf(b.code)
    const sort = Number(file.slice(0, 2)) || 0
    lines.push(
      `  - title: ${q(b.title)}`,
      `    versification: ${q(project.versification || 'ufw')}`,
      `    identifier: ${q(b.code)}`,
      `    sort: ${sort}`,
      `    path: ${q(`./${file}`)}`,
      `    categories: [${q(sort > 40 ? 'bible-nt' : 'bible-ot')}]`
    )
  }
  return lines.join('\n') + '\n'
}

/** What happened to a file uploaded: written, the same as on Door43 already, or not uploaded (and why). */
export type FileResult = { path: string; state: 'written' | 'same' | 'failed'; problem?: Problem }

/** Why something could not be done, said in the person's terms. */
export type Problem = 'offline' | 'signin' | 'permission' | 'conflict' | 'other'
export function problemOf(e: unknown): Problem {
  if (e instanceof DcsApiError) {
    if (e.status === 401) return 'signin'
    if (e.status === 403 || e.status === 404) return 'permission'
    if (e.status === 409 || e.status === 422) return 'conflict'
    return 'other'
  }
  // fetch fails without a response: no internet, or the page may not reach Door43.
  return e instanceof TypeError ? 'offline' : 'other'
}

/**
 * Uploads files to the project's repository, making the repository the first time. A file with the same text on
 * Door43 is left as it is (no empty commit); one that changed is updated with the sha it has there, so nobody's later
 * upload is overwritten unseen (a conflict is said, not forced).
 */
export async function publish(
  account: Door43Account,
  to: Destination,
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<FileResult[]> {
  const config = configOf(to.host)
  try {
    await getRepo(config, to.owner, to.repo, account.token)
  } catch (e) {
    if (!(e instanceof DcsApiError && e.status === 404)) throw e
    await createOrgRepo(config, to.owner, { name: to.repo, description: '', private: false, auto_init: true, default_branch: 'master', token: account.token })
  }
  const results: FileResult[] = []
  for (const file of files) {
    try {
      let there: ContentsResponse | null = null
      try {
        const got = await getContents(config, to.owner, to.repo, file.path, { token: account.token })
        there = Array.isArray(got) ? null : got
      } catch (e) {
        if (!(e instanceof DcsApiError && e.status === 404)) throw e
      }
      if (there?.content && decodeBase64(there.content) === file.content) {
        results.push({ path: file.path, state: 'same' })
        continue
      }
      await createOrUpdateContents(config, to.owner, to.repo, file.path, { content: file.content, message, sha: there?.sha, token: account.token })
      results.push({ path: file.path, state: 'written' })
    } catch (e) {
      results.push({ path: file.path, state: 'failed', problem: problemOf(e) })
    }
  }
  return results
}

/** The next version's number: one more than the last marked on Door43 (`v3` → 4), 1 at first. */
export async function nextVersion(account: Door43Account, to: Destination): Promise<number> {
  const releases = await listReleases(configOf(to.host), to.owner, to.repo, { token: account.token }).catch(() => [])
  const numbers = releases.map((r) => Number(/^v(\d+)$/.exec(r.tag_name)?.[1] ?? 0))
  return Math.max(0, ...numbers) + 1
}

/** Marks what is on Door43 now as a numbered version (a release `vN`), when the team holds it good. */
export async function markVersion(account: Door43Account, to: Destination, n: number, note: string) {
  return createRelease(configOf(to.host), to.owner, to.repo, { tagName: `v${n}`, name: `${n}`, body: note, token: account.token })
}

/** When each book was last uploaded from this phone, and with what text: to say whether it changed since. */
export interface Uploaded {
  at: string
  by: string
  /** A fingerprint of the file uploaded. */
  key: string
}
export const uploadedOf = (projectId: string, code: string) => read<Uploaded>(`${KEY}.subido.${projectId}.${code}`)
export const keepUploaded = (projectId: string, code: string, u: Uploaded) => write(`${KEY}.subido.${projectId}.${code}`, u)

/** A short fingerprint of a text (to tell whether a book changed since it was uploaded, not to secure anything). */
export function fingerprint(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36) + text.length.toString(36)
}

/** The repository's page on Door43. */
export const repoUrl = (to: Destination) => `${to.host}/${to.owner}/${to.repo}`
