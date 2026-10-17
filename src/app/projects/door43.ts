/**
 * Publishing a project to Door43 (design, section 8). A project goes to one repository of its team's organization
 * (`{owner}/{repo}`, chosen once), a Resource Container bundle: each book as `NN-BOOK.usfm`, and a `manifest.yaml`
 * that names them; the recordings said aloud, the take that counts for each place, under `audio/`. Publishing uploads everything translated, each time; Door43 keeps the history of every upload. A
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
export type Problem = 'offline' | 'signin' | 'scope' | 'permission' | 'conflict' | 'other'
export function problemOf(e: unknown): Problem {
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
 * Door43 is left as it is (no empty commit); one that changed is updated with the sha it has there, so nobody's later
 * upload is overwritten unseen (a conflict is said, not forced).
 */
export async function publish(
  account: Door43Account,
  to: Destination,
  /** Text as `content`; a sound (or anything not text) as `base64`. */
  files: Array<{ path: string; content: string } | { path: string; base64: string }>,
  message: string,
  /** A repository made private the first time (the team's work), not public (what it publishes). */
  options: { private?: boolean } = {}
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
        results.push({ path: file.path, state: 'same' })
        continue
      }
      if ('base64' in file) await createOrUpdateBinaryContents(config, to.owner, to.repo, file.path, { contentBase64: file.base64, message, sha: there?.sha, token: account.token })
      else await createOrUpdateContents(config, to.owner, to.repo, file.path, { content: file.content, message, sha: there?.sha, token: account.token })
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

// ——— The team's work through Door43 (design 6.10) ————————————————————————————————————————————————————————————————
// The same package as by card or Bluetooth, left where the others can take it: each one leaves their own file (by
// person and phone, replaced each time), and taking one in is the same gathering, so taking it twice brings nothing.

/** The repository where the team leaves its work for one another: beside the one it publishes, and private. */
export const workRepoOf = (to: Destination): Destination => ({ ...to, repo: `${to.repo}-servos` })

const WORK = 'trabajo'
// Left gzipped: a book aligned whole is some 20 MB as JSON and a few as gzip, and Door43 stops giving a file's content
// through the contents API past 10 MB. One left before, not gzipped, is still read.
const PACKAGE = '.servos.json.gz'
const OLD_PACKAGE = '.servos.json'

async function gzipped(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
async function gunzipped(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}
function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'persona'

/** A person's file there: theirs from this phone, replaced each time they leave their work. */
export const workPathOf = (person: string, device: string) => `${WORK}/${slug(person)}-${device}${PACKAGE}`

/**
 * Leaves a person's work (a package's text, gzipped) for the others, making the private repository the first time.
 * One this phone left before, not gzipped, is taken away: the others would bring the same work twice.
 */
export async function leaveWork(account: Door43Account, to: Destination, text: string, person: string, device: string): Promise<FileResult> {
  const at = workRepoOf(to)
  const path = workPathOf(person, device)
  const [result] = await publish(account, at, [{ path, base64: toBase64(await gzipped(text)) }], `Trabajo de ${person}`, { private: true })
  if (result.state !== 'failed') {
    const old = path.slice(0, -PACKAGE.length) + OLD_PACKAGE
    try {
      const there = await getContents(configOf(at.host), at.owner, at.repo, old, { token: account.token })
      if (!Array.isArray(there)) await deleteContents(configOf(at.host), at.owner, at.repo, old, { sha: there.sha, message: `Trabajo de ${person}`, token: account.token })
    } catch {
      /* none there, or it stays: bringing it in twice brings nothing new */
    }
  }
  return result
}

/** The work the others left, each file's text (this phone's own left out); none yet, when nobody left any. */
export async function workLeft(account: Door43Account, to: Destination, device: string): Promise<Array<{ path: string; text: string }>> {
  const config = configOf(to.host)
  const at = workRepoOf(to)
  let listed: ContentsResponse | ContentsResponse[]
  try {
    listed = await getContents(config, at.owner, at.repo, WORK, { token: account.token })
  } catch (e) {
    if (e instanceof DcsApiError && e.status === 404) return []
    throw e
  }
  const isPackage = (name: string) => name.endsWith(PACKAGE) || name.endsWith(OLD_PACKAGE)
  const mine = (name: string) => name.endsWith(`-${device}${PACKAGE}`) || name.endsWith(`-${device}${OLD_PACKAGE}`)
  const theirs = (Array.isArray(listed) ? listed : []).filter((x) => x.type === 'file' && isPackage(x.name) && !mine(x.name))
  const out: Array<{ path: string; text: string }> = []
  for (const x of theirs) {
    const got = await getContents(config, at.owner, at.repo, x.path, { token: account.token })
    if (Array.isArray(got)) continue
    const bytes = got.content ? fromBase64(got.content.replace(/\s/g, '')) : await rawBytes(account, at, x.path)
    out.push({ path: x.path, text: x.name.endsWith(PACKAGE) ? await gunzipped(bytes) : new TextDecoder().decode(bytes) })
  }
  return out
}
