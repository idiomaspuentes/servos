/**
 * Publishing a project to Door43 (design, section 8). A project goes to one repository of its team's organization
 * (`{owner}/{repo}`, chosen once), a Resource Container bundle: each book as `NN-BOOK.usfm`, and a `manifest.yaml`
 * that names them. Publishing uploads everything translated, each time; Door43 keeps the history of every upload. A
 * numbered version is marked apart (a release), when the team holds a state good; the recordings said aloud, the take
 * that counts for each place, go attached to it, a zip by book (git would keep every take ever recorded).
 *
 * Who publishes signs in to Door43 once on this phone: the password is exchanged for a token (Taller's way), and
 * only the token is kept, by person. Without internet nothing is lost: the work stays on the phone, the app says what
 * has changed since it was last uploaded, and what is asked waits for internet (`outbox.ts`).
 */

import {
  DcsApiError,
  PRODUCTION_HOST,
  QA_HOST,
  createOrUpdateBinaryContents,
  createOrUpdateContents,
  createOrgRepo,
  createRelease,
  deleteContents,
  decodeBase64,
  getContents,
  getRepo,
  listReleases,
  signInWithPassword,
  type ContentsResponse,
  type DcsClientConfig,
} from '../../door43/dcs'
import { deviceId } from './bookText'
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

type Host = { id: 'door43' | 'qa' | 'mock'; url: string }
const DEV = Boolean(import.meta.env?.DEV)
const MOCK: Host = { id: 'mock', url: `http://${typeof location === 'undefined' ? 'localhost' : location.hostname}:8787` }
/** Every Door43 Servos knows, to name an account linked to any of them. */
const KNOWN: Host[] = [{ id: 'door43', url: PRODUCTION_HOST }, { id: 'qa', url: QA_HOST }, MOCK]

const SERVER_KEY = `${KEY}.servidor`
/**
 * Whether Door43's test copy (QA) is for this device: it is for whoever tries the app, who opens it once with
 * `?server=qa` (kept for the next times, the installed app too, until it is opened with `?server=door43`).
 */
export function wantsQa(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const asked = new URLSearchParams(search).get('server')
  if (asked === 'qa') write(SERVER_KEY, 'qa')
  if (asked === 'door43') write(SERVER_KEY, null)
  return read<string>(SERVER_KEY) === 'qa'
}

/**
 * The Door43 a person can link to: the real one; its copy for trying things (QA) when asked for (`wantsQa`); and,
 * building the app, both QA and a local mock.
 */
export const HOSTS: Host[] = [
  { id: 'door43', url: PRODUCTION_HOST },
  ...(DEV || wantsQa() ? [{ id: 'qa' as const, url: QA_HOST }] : []),
  ...(DEV ? [MOCK] : []),
]
/** The Door43 a new link starts on: QA when asked for, the mock building the app, else the real one. */
export const defaultHost = (): string => (wantsQa() ? QA_HOST : DEV ? MOCK.url : PRODUCTION_HOST)
export const hostName = (url: string) => KNOWN.find((h) => h.url === url)?.id ?? url.replace(/^https?:\/\//, '')
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

/**
 * Signs in with a password, which is used for this one request; the token minted is kept for the person. Its name
 * carries this device (`servos-{device}-…`): signing in again replaces this device's earlier token, never another
 * device's, so the same person on a phone and a computer is not signed out of one by signing in on the other (found
 * on QA, with two phones of one account).
 */
export async function signIn(person: string, host: string, username: string, password: string): Promise<Door43Account> {
  const { user, token } = await signInWithPassword(configOf(host), {
    username: username.trim(),
    password,
    tokenNamePrefix: `servos-${deviceId()}`,
    // Making a repository in the team's organization (the one published, the team's work) needs write:organization:
    // with write:repository alone Door43 refuses it (found on QA).
    scopes: ['read:user', 'read:organization', 'write:organization', 'write:repository'],
  })
  const account = { host, username: user.login, token, fullName: user.full_name || undefined }
  write(`${KEY}.cuenta.${person}`, account)
  return account
}

/** Door43's page for making an account, opened in the browser: the app makes none itself. */
export const signUpUrl = (host: string) => `${host}/user/sign_up`

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

/** The name proposed for a team's new organization: its language and «reg», as the repository is proposed. */
export const proposedOrg = (project: Pick<Project, 'languageCode'>) => proposedRepo(project)

/** A Door43 name, as Door43 takes it for an organization or a repository. */
export const validName = (name: string) => /^[A-Za-z0-9_.-]+$/.test(name) && !/^[.-]|[.-]$/.test(name)

/** Why an organization could not be made: the name taken, this account not allowed to make one, or another problem. */
export type OrgProblem = 'taken' | 'notAllowed' | Problem
/**
 * Makes the team's organization on Door43, its maker in it; `private`: only its members see what it keeps. Fails with
 * what went wrong, in the person's terms.
 */
export async function createTeamOrg(account: Door43Account, name: string, privately: boolean): Promise<string> {
  const { createOrg } = await import('../../door43/dcs')
  try {
    const made = await createOrg(configOf(account.host), { name, visibility: privately ? 'private' : 'public', token: account.token })
    return made?.name ?? name
  } catch (e) {
    throw new OrgError(orgProblemOf(e))
  }
}
export class OrgError extends Error {
  constructor(readonly problem: OrgProblem) {
    super(problem)
  }
}
function orgProblemOf(e: unknown): OrgProblem {
  if (e instanceof DcsApiError) {
    const said = `${e.message} ${JSON.stringify(e.body ?? '')}`
    if (e.status === 422 && /already exists|name is reserved|been used/i.test(said)) return 'taken'
    if (e.status === 403 && !/required scope/i.test(said)) return 'notAllowed'
  }
  return problemOf(e)
}

// Every organization Door43 shows, by host, brought once a visit: Door43 has no search of organizations by name.
const everyOrg = new Map<string, Promise<string[]>>()
const PAGE = 50
/** Most pages brought of the organizations Door43 shows (some thousands). */
const MOST_PAGES = 80

async function orgsShown(account: Door43Account): Promise<string[]> {
  const url = (page: number) => `${account.host}/api/v1/orgs?limit=${PAGE}&page=${page}`
  const page = async (n: number): Promise<string[]> => {
    const res = await fetch(url(n), { headers: { Authorization: `token ${account.token}` } })
    if (!res.ok) throw new DcsApiError(`${res.status} /orgs`, res.status)
    return ((await res.json()) as Array<{ name?: string; username?: string }>).map((o) => o.name || o.username || '').filter(Boolean)
  }
  const all: string[] = []
  // Four pages at a time, until one comes short.
  for (let n = 1; n <= MOST_PAGES; n += 4) {
    const got = await Promise.all([n, n + 1, n + 2, n + 3].filter((k) => k <= MOST_PAGES).map(page))
    for (const names of got) all.push(...names)
    if (got.some((names) => names.length < PAGE)) break
  }
  return all
}

/**
 * The organizations Door43 shows whose name holds what is asked, the one named exactly first. Those only their
 * members see are not shown: their name is asked of whoever coordinates.
 */
export async function findOrgs(account: Door43Account, asked: string, most = 30): Promise<string[]> {
  const wanted = asked.trim().toLocaleLowerCase()
  if (!wanted) return []
  let list = everyOrg.get(account.host)
  if (!list) {
    list = orgsShown(account)
    everyOrg.set(account.host, list)
    list.catch(() => everyOrg.delete(account.host))
  }
  const names = await list
  const found = names.filter((n) => n.toLocaleLowerCase().includes(wanted))
  const exact = found.filter((n) => n.toLocaleLowerCase() === wanted)
  const starts = found.filter((n) => !exact.includes(n) && n.toLocaleLowerCase().startsWith(wanted))
  return [...exact, ...starts, ...found.filter((n) => !exact.includes(n) && !starts.includes(n))].slice(0, most)
}

/** One call to Door43's API as this account; a refusal throws a `DcsApiError` with its status. */
async function api<T>(account: Door43Account, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${account.host}/api/v1${path}`, {
    ...init,
    headers: { Authorization: `token ${account.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  })
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    throw new DcsApiError(`${res.status} ${path}`, res.status, body)
  }
  const text = res.status === 204 ? '' : await res.text()
  return text.trim() ? (JSON.parse(text) as T) : null
}
const notFound = (e: unknown) => e instanceof DcsApiError && e.status === 404

/**
 * Whether this account owns the organization: on Door43 only an owner may add someone to it. Not known (no internet,
 * an old key): not an owner, and nothing is offered.
 */
export async function ownsOrg(account: Door43Account, org: string): Promise<boolean> {
  try {
    const p = await api<{ is_owner?: boolean }>(account, `/users/${encodeURIComponent(account.username)}/orgs/${encodeURIComponent(org)}/permissions`)
    return Boolean(p?.is_owner)
  } catch {
    return false
  }
}

/** Someone on Door43, as the person adding them sees them before adding: their name, and whether they are in already. */
export interface Door43Person {
  login: string
  fullName?: string
  inOrg: boolean
}
/** The account with that user name (Door43 takes it in any case), or null when there is none. */
export async function lookUpPerson(account: Door43Account, org: string, username: string): Promise<Door43Person | null> {
  let user: { login: string; full_name?: string } | null
  try {
    user = await api(account, `/users/${encodeURIComponent(username.trim())}`)
  } catch (e) {
    if (notFound(e)) return null
    throw e
  }
  if (!user) return null
  return { login: user.login, fullName: user.full_name || undefined, inOrg: await inOrg(account, org, user.login) }
}
async function inOrg(account: Door43Account, org: string, login: string): Promise<boolean> {
  try {
    await api(account, `/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(login)}`)
    return true
  } catch (e) {
    if (notFound(e)) return false
    throw e
  }
}

/**
 * The team those added from Servos go in (Abel, 26 October): they save and publish in every project of the
 * organization, and make the repositories the work goes to (`{repo}-servos`), but neither delete them nor manage the
 * organization or its people, as its owners do.
 */
export const TEAM = 'traductores'
const TEAM_UNITS = ['repo.code', 'repo.releases', 'repo.issues', 'repo.pulls', 'repo.wiki']

async function teamOf(account: Door43Account, org: string): Promise<number> {
  const at = `/orgs/${encodeURIComponent(org)}/teams`
  for (let page = 1; page <= 10; page++) {
    const teams = (await api<Array<{ id: number; name: string }>>(account, `${at}?limit=50&page=${page}`)) ?? []
    const team = teams.find((x) => x.name.toLocaleLowerCase() === TEAM)
    if (team) return team.id
    if (teams.length < 50) break
  }
  const made = await api<{ id: number }>(account, at, {
    method: 'POST',
    body: JSON.stringify({
      name: TEAM,
      description: 'Servos',
      permission: 'write',
      includes_all_repositories: true,
      can_create_org_repo: true,
      // Older Door43s read `units`, newer ones `units_map`.
      units: TEAM_UNITS,
      units_map: Object.fromEntries(TEAM_UNITS.map((u) => [u, 'write'])),
    }),
  })
  if (!made) throw new DcsApiError(`no team made in ${org}`, 500)
  return made.id
}

/**
 * Adds someone to the organization, in its translators' team (made the first time). Someone in it already is left as
 * they are. Door43 refuses it (403) to an account that does not own the organization.
 */
export async function addToOrg(account: Door43Account, org: string, username: string): Promise<'added' | 'already'> {
  if (await inOrg(account, org, username)) return 'already'
  const team = await teamOf(account, org)
  await api(account, `/teams/${team}/members/${encodeURIComponent(username)}`, { method: 'PUT' })
  return 'added'
}

/**
 * The user name in what the person adding someone wrote or pasted: the whole message «Compartir mi usuario» sends
 * (`org.mensaje`, in any of `templates`), or the name alone, without an «@».
 */
export function userFromMessage(text: string, templates: string[]): string {
  const said = text.trim().replace(/\s+/g, ' ')
  for (const template of templates) {
    const pattern = template
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
      .replace('{usuario}', '([A-Za-z0-9_.-]+?)')
      .replace(/\{[a-z]+\}/g, '.*?')
      .replace(/ /g, '\\s*')
    const m = said.match(new RegExp(`^${pattern}$`, 'i'))
    if (m) return m[1]
  }
  return said.replace(/^@/, '')
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

/**
 * The books already in the project's repository, each with the name its manifest gives it (when it names it): none
 * when there is no repository yet. Several people publish, each from a device with only some books, so a manifest
 * written from one device has to keep naming the books the others uploaded (found on QA: Ana's upload of Titus left
 * out the Jonah that Bea had uploaded). Not reaching Door43 fails, rather than write a manifest missing books.
 */
export async function booksThere(account: Door43Account, to: Destination): Promise<Array<{ code: string; title?: string }>> {
  const config = configOf(to.host)
  let listed: ContentsResponse | ContentsResponse[]
  try {
    listed = await getContents(config, to.owner, to.repo, '', { token: account.token })
  } catch (e) {
    if (e instanceof DcsApiError && e.status === 404) return []
    throw e
  }
  const codes = (Array.isArray(listed) ? listed : [])
    .filter((f) => f.type === 'file')
    .map((f) => ({ name: f.name, code: /^(?:\d\d-)?([0-9a-z]{3})\.usfm$/i.exec(f.name)?.[1].toLowerCase() }))
    .filter((f): f is { name: string; code: string } => Boolean(f.code) && fileOf(f.code!) === f.name)
    .map((f) => f.code)
  if (!codes.length) return []
  let titles = new Map<string, string>()
  try {
    const got = await getContents(config, to.owner, to.repo, 'manifest.yaml', { token: account.token })
    if (!Array.isArray(got) && got.content) titles = titlesOf(decodeBase64(got.content))
  } catch (e) {
    if (!(e instanceof DcsApiError && e.status === 404)) throw e
  }
  return codes.map((code) => ({ code, title: titles.get(code) }))
}

/** The name a manifest gives each of its books (`projects:`, by `identifier`), as Servos and tC write it. */
export function titlesOf(yaml: string): Map<string, string> {
  const unquote = (s: string) => {
    const v = s.trim()
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'")
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"')
    return v
  }
  const out = new Map<string, string>()
  const projects = yaml.split(/^projects:\s*$/m)[1]
  if (!projects) return out
  // Each entry starts at its `- `, as indented as the first one (a deeper `- ` is a list inside it); its keys follow.
  const indent = /^( *)-(?:\s|$)/m.exec(projects)?.[1] ?? ''
  for (const entry of projects.split(new RegExp(`^${indent}-(?:[ \\t]+|$)`, 'm')).slice(1)) {
    const field = (key: string) => new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(entry)?.[1]
    const code = field('identifier')
    const title = field('title')
    if (code && title) out.set(unquote(code).toLowerCase(), unquote(title))
  }
  return out
}

/**
 * What happened to a file uploaded: written, the same as on Door43 already, not uploaded because Door43 has another
 * text this phone has not seen (someone else uploaded it: it is brought and gathered first, `changed`), not uploaded
 * because versions brought from Door43 still wait to be gathered here (`gather`), or not uploaded (and why). `sha` is the file's on Door43 after it, when known.
 */
export type FileResult = { path: string; state: 'written' | 'same' | 'changed' | 'gather' | 'failed'; problem?: Problem; sha?: string }

/** Why something could not be done, said in the person's terms. */
export type Problem = 'offline' | 'signin' | 'scope' | 'permission' | 'conflict' | 'changed' | 'gather' | 'pin' | 'other'
export function problemOf(e: unknown): Problem {
  // The network presented a certificate that was not Door43's (the app for phones, `frame/door43Pins.ts`): nothing went.
  if (e instanceof Error && e.name === 'NotDoor43') return 'pin'
  if (e instanceof DcsApiError) {
    if (e.status === 401) return 'signin'
    // The account may do it, but the key this phone keeps was made without that permission: link the account again.
    if (e.status === 403 && /required scope/i.test(`${e.message} ${JSON.stringify(e.body ?? '')}`)) return 'scope'
    if (e.status === 403 || e.status === 404) return 'permission'
    if (e.status === 409 || e.status === 422) return 'conflict'
    return 'other'
  }
  // fetch fails without a response: no internet, or the page may not reach Door43.
  return e instanceof TypeError ? 'offline' : 'other'
}

/**
 * Uploads files to the project's repository, making the repository the first time. A file with the same text on
 * Door43 is left as it is (no empty commit); one that changed is updated with the sha it has there (two uploads at the
 * same moment: a conflict is said, not forced). A file named in `seen` is written only if Door43 still has the version
 * this phone last saw of it (its sha; `undefined`, none seen), or one whose every verse this phone already has
 * (`knows`, the work having come another way): otherwise someone else uploaded another text, and it is left as it is,
 * `changed`, for this phone to bring it in and gather it before uploading (design 6.10).
 */
export async function publish(
  account: Door43Account,
  to: Destination,
  /** Text as `content`; a sound (or anything not text) as `base64`. */
  files: Array<{ path: string; content: string } | { path: string; base64: string }>,
  message: string,
  /** A repository made private the first time (the team's work), not public (what it publishes). */
  options: { private?: boolean; seen?: Record<string, string | undefined>; knows?(path: string, text: string): boolean } = {}
): Promise<FileResult[]> {
  const config = configOf(to.host)
  try {
    await getRepo(config, to.owner, to.repo, account.token)
  } catch (e) {
    if (!(e instanceof DcsApiError && e.status === 404)) throw e
    await createOrgRepo(config, to.owner, {
      name: to.repo,
      description: '',
      private: options.private ?? false,
      auto_init: true,
      default_branch: 'master',
      token: account.token,
    })
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
      const same = 'base64' in file ? there?.content?.replace(/\s/g, '') === file.base64 : there?.content != null && decodeBase64(there.content) === file.content
      if (same) {
        results.push({ path: file.path, state: 'same', ...(there?.sha ? { sha: there.sha } : {}) })
        continue
      }
      const textThere = () => (there?.content != null ? decodeBase64(there.content.replace(/\s/g, '')) : '')
      if (there && options.seen && file.path in options.seen && options.seen[file.path] !== there.sha && !options.knows?.(file.path, textThere())) {
        results.push({ path: file.path, state: 'changed', sha: there.sha })
        continue
      }
      const made =
        'base64' in file
          ? await createOrUpdateBinaryContents(config, to.owner, to.repo, file.path, { contentBase64: file.base64, message, sha: there?.sha, token: account.token })
          : await createOrUpdateContents(config, to.owner, to.repo, file.path, { content: file.content, message, sha: there?.sha, token: account.token })
      results.push({ path: file.path, state: 'written', ...(made?.content?.sha ? { sha: made.content.sha } : {}) })
    } catch (e) {
      results.push({ path: file.path, state: 'failed', problem: problemOf(e) })
    }
  }
  return results
}

/**
 * The next version's number: one more than the last marked on Door43 (`v3` → 4), 1 at first. Not reaching Door43 is
 * not «none yet»: it fails, rather than propose a number already taken.
 */
export async function nextVersion(account: Door43Account, to: Destination): Promise<number> {
  const releases = await listReleases(configOf(to.host), to.owner, to.repo, { token: account.token }).catch((e) => {
    if (e instanceof DcsApiError && e.status === 404) return []
    throw e
  })
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

/**
 * The last version of a book's file this phone saw on Door43, uploaded or brought in: its sha, and its text, the common
 * start to weigh what changed there against what changed here (design 6.10).
 */
export interface Seen {
  sha: string
  text: string
}
export const seenOf = (projectId: string, code: string) => read<Seen>(`${KEY}.visto.${projectId}.${code}`)
export const keepSeen = (projectId: string, code: string, seen: Seen) => write(`${KEY}.visto.${projectId}.${code}`, seen)

/** A book's file on Door43 now, its text and sha; null when there is none. */
export async function fileThere(account: Door43Account, to: Destination, path: string): Promise<Seen | null> {
  try {
    const got = await getContents(configOf(to.host), to.owner, to.repo, path, { token: account.token })
    if (Array.isArray(got)) return null
    const text = got.content != null ? decodeBase64(got.content.replace(/\s/g, '')) : new TextDecoder().decode(await rawBytes(account, to, path))
    return { sha: got.sha, text }
  } catch (e) {
    if (e instanceof DcsApiError && e.status === 404) return null
    throw e
  }
}

/**
 * Who last uploaded a file, as Door43 names the account (its full name, or its user name): what a version brought from
 * there is signed with. Null when Door43 does not say.
 */
export async function uploaderOf(account: Door43Account, to: Destination, path: string): Promise<string | null> {
  type Commit = { author?: { full_name?: string; login?: string } | null; commit?: { author?: { name?: string } } }
  try {
    const [last] = await call<Commit[]>(account, to, `/commits?path=${encodeURIComponent(path)}&limit=1`)
    return last?.author?.full_name?.trim() || last?.author?.login || last?.commit?.author?.name || null
  } catch {
    return null
  }
}

/** A short fingerprint of a text (to tell whether a book changed since it was uploaded, not to secure anything). */
export function fingerprint(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36) + text.length.toString(36)
}

/** The repository's page on Door43. */
export const repoUrl = (to: Destination) => `${to.host}/${to.owner}/${to.repo}`

// ——— The team's work through Door43 (design 6.10) ————————————————————————————————————————————————————————————————
// The same package as by card or Bluetooth (its recordings' sound in it), left where the others can take it: each one
// leaves their own, by person and phone, and taking one in is the same gathering, so taking it twice brings nothing.
// They are kept as the attachments of one release of a private repository beside the project's, a shelf: an attachment
// is replaced in place, with no history, so a team leaving its work every day (and its takes, recorded again and
// again) does not fill the repository with every version of it, as files in git would (Door43 has no Git LFS).

/** The repository where the team leaves its work for one another: beside the one it publishes, and private. */
export const workRepoOf = (to: Destination): Destination => ({ ...to, repo: `${to.repo}-servos` })

/** The release whose attachments are the shelf: not a version, said so on Door43. */
const SHELF = 'trabajo'
// Gzipped: a book aligned whole is some 20 MB as JSON and a few as gzip.
const PACKAGE = '.servos.json.gz'
const OLD_PACKAGE = '.servos.json'
/** Where an earlier Servos left the work, as files of the repository: still read, and taken away by whoever left it. */
const OLD_FOLDER = 'trabajo'

async function gzipped(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
async function gunzipped(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}
function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'))
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
/** A file's bytes through the raw API: no size limit there (the contents API leaves a big file's content out). */
async function rawBytes(account: Door43Account, to: Destination, path: string): Promise<Uint8Array> {
  const url = `${to.host}/api/v1/repos/${encodeURIComponent(to.owner)}/${encodeURIComponent(to.repo)}/raw/${path.split('/').map(encodeURIComponent).join('/')}`
  const res = await fetch(url, { headers: { Authorization: `token ${account.token}` } })
  if (!res.ok) throw new DcsApiError(`Could not read ${path}`, res.status)
  return new Uint8Array(await res.arrayBuffer())
}
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'persona'

/** A person's work on the shelf: theirs from this phone, replaced each time they leave it. */
export const workNameOf = (person: string, device: string) => `${slug(person)}-${device}${PACKAGE}`

type Asset = { id: number; name: string; size: number; browser_download_url: string }

/** A call to the repository's API, as this account; a failure as Door43 said it. */
async function call<T>(account: Door43Account, to: Destination, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${to.host}/api/v1/repos/${encodeURIComponent(to.owner)}/${encodeURIComponent(to.repo)}${path}`
  const res = await fetch(url, { ...init, headers: { Authorization: `token ${account.token}`, ...(init.headers ?? {}) } })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new DcsApiError(String((body as { message?: string } | null)?.message ?? `${res.status} ${path}`), res.status, body)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

/**
 * Attaches a file to a release (a version's recordings, one zip by book): kept apart from the repository's history,
 * which would keep every take ever recorded (Door43 has no Git LFS).
 */
export async function attachToRelease(account: Door43Account, to: Destination, releaseId: number, name: string, bytes: Uint8Array, type = 'application/zip') {
  const form = new FormData()
  form.append('attachment', new Blob([new Uint8Array(bytes)], { type }), name)
  return call<Asset>(account, to, `/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', body: form })
}

async function ensureRepo(account: Door43Account, to: Destination, privately: boolean) {
  const config = configOf(to.host)
  try {
    await getRepo(config, to.owner, to.repo, account.token)
  } catch (e) {
    if (!(e instanceof DcsApiError && e.status === 404)) throw e
    await createOrgRepo(config, to.owner, { name: to.repo, description: '', private: privately, auto_init: true, default_branch: 'master', token: account.token })
  }
}

/** The shelf's release, or none yet. */
async function shelfOf(account: Door43Account, to: Destination): Promise<{ id: number } | null> {
  try {
    return await call<{ id: number }>(account, to, `/releases/tags/${SHELF}`)
  } catch (e) {
    if (e instanceof DcsApiError && e.status === 404) return null
    throw e
  }
}

/**
 * Leaves a person's work (a package's text, its sound in it) on the shelf, gzipped, making the private repository and
 * the shelf the first time. The new one goes up before the one it replaces goes away: there is never a moment without.
 * What an earlier Servos left for this person and phone as a file of the repository is taken away.
 */
export async function leaveWork(account: Door43Account, to: Destination, text: string, person: string, device: string): Promise<FileResult> {
  const at = workRepoOf(to)
  const name = workNameOf(person, device)
  try {
    await ensureRepo(account, at, true)
    const shelf =
      (await shelfOf(account, at)) ??
      (await call<{ id: number }>(account, at, '/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_name: SHELF, target_commitish: 'master', name: 'Trabajo del equipo', body: 'Lo deja Servos para el equipo: no es una versión.', prerelease: true }),
      }))
    const before = (await call<Asset[]>(account, at, `/releases/${shelf.id}/assets`)).filter((a) => a.name === name)
    const form = new FormData()
    form.append('attachment', new Blob([new Uint8Array(await gzipped(text))], { type: 'application/gzip' }), name)
    await call<Asset>(account, at, `/releases/${shelf.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', body: form })
    for (const old of before) await call<void>(account, at, `/releases/${shelf.id}/assets/${old.id}`, { method: 'DELETE' }).catch(() => {})
  } catch (e) {
    return { path: name, state: 'failed', problem: problemOf(e) }
  }
  for (const old of [`${OLD_FOLDER}/${name}`, `${OLD_FOLDER}/${name.slice(0, -PACKAGE.length)}${OLD_PACKAGE}`]) {
    try {
      const there = await getContents(configOf(at.host), at.owner, at.repo, old, { token: account.token })
      if (!Array.isArray(there)) await deleteContents(configOf(at.host), at.owner, at.repo, old, { sha: there.sha, message: `Trabajo de ${person}`, token: account.token })
    } catch {
      /* none there, or it stays: bringing it in twice brings nothing new */
    }
  }
  return { path: name, state: 'written' }
}

/** The work the others left (this phone's own left out), each one's text; none yet, when nobody left any. */
export async function workLeft(account: Door43Account, to: Destination, device: string): Promise<Array<{ path: string; text: string }>> {
  const at = workRepoOf(to)
  const isPackage = (name: string) => name.endsWith(PACKAGE) || name.endsWith(OLD_PACKAGE)
  const mine = (name: string) => name.endsWith(`-${device}${PACKAGE}`) || name.endsWith(`-${device}${OLD_PACKAGE}`)
  const out: Array<{ path: string; text: string }> = []
  const read = async (name: string, bytes: Uint8Array) => (name.endsWith(PACKAGE) ? gunzipped(bytes) : new TextDecoder().decode(bytes))
  // On the shelf.
  const shelf = await shelfOf(account, at)
  if (shelf) {
    for (const a of (await call<Asset[]>(account, at, `/releases/${shelf.id}/assets`)).filter((x) => isPackage(x.name) && !mine(x.name))) {
      const res = await fetch(a.browser_download_url, { headers: { Authorization: `token ${account.token}` } })
      if (!res.ok) throw new DcsApiError(`Could not bring ${a.name}`, res.status)
      out.push({ path: a.name, text: await read(a.name, new Uint8Array(await res.arrayBuffer())) })
    }
  }
  // Left by an earlier Servos as files of the repository.
  const config = configOf(at.host)
  let listed: ContentsResponse | ContentsResponse[] = []
  try {
    listed = await getContents(config, at.owner, at.repo, OLD_FOLDER, { token: account.token })
  } catch (e) {
    if (!(e instanceof DcsApiError && e.status === 404)) throw e
  }
  for (const x of (Array.isArray(listed) ? listed : []).filter((f) => f.type === 'file' && isPackage(f.name) && !mine(f.name))) {
    const got = await getContents(config, at.owner, at.repo, x.path, { token: account.token })
    if (Array.isArray(got)) continue
    const bytes = got.content ? fromBase64(got.content.replace(/\s/g, '')) : await rawBytes(account, at, x.path)
    out.push({ path: x.path, text: await read(x.name, bytes) })
  }
  return out
}
