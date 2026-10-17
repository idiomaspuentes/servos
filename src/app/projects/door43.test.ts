import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileOf, fingerprint, leaveWork, manifestOf, problemOf, proposedRepo, publish, signIn, workLeft, workPathOf, workRepoOf } from './door43'
import { DcsApiError } from '../../door43/dcs'

describe('a project published to Door43', () => {
  it('names each book file as USFM numbers books, the New Testament from 41', () => {
    expect(fileOf('gen')).toBe('01-GEN.usfm')
    expect(fileOf('jon')).toBe('32-JON.usfm')
    expect(fileOf('mal')).toBe('39-MAL.usfm')
    expect(fileOf('mat')).toBe('41-MAT.usfm')
    expect(fileOf('tit')).toBe('57-TIT.usfm')
    expect(fileOf('rev')).toBe('67-REV.usfm')
  })

  it('proposes the repository by the language', () => {
    expect(proposedRepo({ languageCode: 'QU' })).toBe('qu_reg')
  })

  it('writes a manifest naming the language and each book by the team’s name', () => {
    const yaml = manifestOf(
      { name: "Biblia en kichwa", languageCode: 'qu', languageName: 'Kichwa', direction: 'ltr', versification: 'ufw', helpsLanguage: 'es-419' },
      'BSOJ',
      'qu_reg',
      [{ code: 'jon', title: "Jonás'manta" }],
      new Date('2026-10-15T12:00:00Z')
    )
    expect(yaml).toContain("  identifier: 'reg'")
    expect(yaml).toContain("    identifier: 'qu'")
    expect(yaml).toContain("  - title: 'Jonás''manta'")
    expect(yaml).toContain("    path: './32-JON.usfm'")
    expect(yaml).toContain("    categories: ['bible-ot']")
    expect(yaml).toContain("  issued: '2026-10-15'")
  })

  it('tells a changed text by its fingerprint', () => {
    expect(fingerprint('\\v 1 a')).toBe(fingerprint('\\v 1 a'))
    expect(fingerprint('\\v 1 a')).not.toBe(fingerprint('\\v 1 b'))
  })

  it('says why something failed in the person’s terms', () => {
    expect(problemOf(new DcsApiError('x', 401))).toBe('signin')
    expect(problemOf(new DcsApiError('x', 403))).toBe('permission')
    expect(problemOf(new TypeError('Failed to fetch'))).toBe('offline')
    // QA's answer to a key made without write:organization, when making a repository in an organization.
    expect(problemOf(new DcsApiError('token does not have at least one of required scope(s), required=[write:organization]', 403))).toBe('scope')
  })
})

describe('uploading the files', () => {
  afterEach(() => vi.unstubAllGlobals())

  // A Door43 in memory: one organization, its repositories and their files.
  function door43() {
    const repos = new Set<string>()
    const files = new Map<string, { content: string; sha: string }>()
    const calls: string[] = []
    let n = 0
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname.replace('/api/v1', '')
      const method = init.method ?? 'GET'
      calls.push(`${method} ${path}`)
      const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
      let m = /^\/repos\/([^/]+)\/([^/]+)$/.exec(path)
      if (m) return repos.has(`${m[1]}/${m[2]}`) ? ok({ name: m[2] }) : ok({ message: 'not found' }, 404)
      m = /^\/orgs?\/([^/]+)\/repos$/.exec(path)
      if (m && method === 'POST') {
        repos.add(`${m[1]}/${JSON.parse(String(init.body)).name}`)
        return ok({}, 201)
      }
      m = /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/.exec(path)
      if (m) {
        const f = files.get(m[1])
        if (method === 'GET') return f ? ok({ name: m[1], path: m[1], sha: f.sha, size: 1, type: 'file', content: btoa(unescape(encodeURIComponent(f.content))) }) : ok({}, 404)
        const body = JSON.parse(String(init.body))
        if (f && body.sha !== f.sha) return ok({ message: 'sha' }, 409)
        files.set(m[1], { content: decodeURIComponent(escape(atob(body.content))), sha: `s${++n}` })
        return ok({ content: {}, commit: { sha: 'c', message: '' } }, 201)
      }
      return ok({}, 404)
    })
    return { repos, files, calls }
  }
  const account = { host: 'http://door43.test', username: 'ana', token: 't' }
  const to = { host: 'http://door43.test', owner: 'BSOJ', repo: 'qu_reg' }

  it('makes the repository the first time and writes the files', async () => {
    const d = door43()
    const r = await publish(account, to, [{ path: '32-JON.usfm', content: '\\id JON\n\\v 1 Ñuka' }], 'Servos')
    expect(r).toEqual([{ path: '32-JON.usfm', state: 'written' }])
    expect(d.repos.has('BSOJ/qu_reg')).toBe(true)
    expect(d.files.get('32-JON.usfm')?.content).toBe('\\id JON\n\\v 1 Ñuka')
  })

  it('leaves a file that has not changed, and updates one that has with the sha it has there', async () => {
    const d = door43()
    await publish(account, to, [{ path: 'a.usfm', content: 'uno' }], 'Servos')
    expect((await publish(account, to, [{ path: 'a.usfm', content: 'uno' }], 'Servos'))[0].state).toBe('same')
    expect((await publish(account, to, [{ path: 'a.usfm', content: 'dos' }], 'Servos'))[0].state).toBe('written')
    expect(d.files.get('a.usfm')?.content).toBe('dos')
  })
})

describe('vincular la cuenta en varios aparatos', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('vincular en un aparato reemplaza su propia llave anterior, no la de otro aparato de la misma cuenta', async () => {
    const store = new Map([['servos.dispositivo', 'tel-a']])
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as Storage
    const tokens = [
      { id: 1, name: 'servos-tel-a-viejo' },
      { id: 2, name: 'servos-tel-b-suyo' },
      { id: 3, name: 'otra-app' },
    ]
    const deleted: number[] = []
    let created = ''
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname.replace('/api/v1', '')
      const method = init.method ?? 'GET'
      const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
      if (path === '/users/ana/tokens' && method === 'GET') return ok(tokens)
      const m = /^\/users\/ana\/tokens\/(\d+)$/.exec(path)
      if (m && method === 'DELETE') {
        deleted.push(Number(m[1]))
        return new Response(null, { status: 204 })
      }
      if (path === '/users/ana/tokens' && method === 'POST') {
        created = JSON.parse(String(init.body)).name
        return ok({ id: 9, name: created, sha1: 'nueva' }, 201)
      }
      if (path === '/user') return ok({ id: 1, login: 'ana', full_name: 'Ana' })
      return ok({}, 404)
    })
    const account = await signIn('Ana', 'https://qa.door43.org', 'ana', 'contraseña-de-prueba')
    expect([account.token, deleted, created.startsWith('servos-tel-a-')]).toEqual(['nueva', [1], true])
  })
})

describe('el trabajo del equipo por Door43', () => {
  afterEach(() => vi.unstubAllGlobals())
  const account = { host: 'https://qa.door43.org', username: 'ana', token: 't' }
  const to = { host: 'https://qa.door43.org', owner: 'BSOJ', repo: 'qu_reg' }

  /**
   * A Door43 in memory that keeps files as bytes, lists a folder, reads raw, deletes, keeps whether a repository was
   * made private, and leaves a big file's content out of the contents API (as Door43 does past 10 MB).
   */
  function door43() {
    const repos = new Map<string, { private: boolean }>()
    const files = new Map<string, { b64: string; sha: string; big?: boolean }>()
    let n = 0
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const path = decodeURIComponent(new URL(url).pathname.replace('/api/v1', ''))
      const method = init.method ?? 'GET'
      const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
      let m = /^\/repos\/([^/]+)\/([^/]+)$/.exec(path)
      if (m) return repos.has(`${m[1]}/${m[2]}`) ? ok({ name: m[2] }) : ok({ message: 'not found' }, 404)
      m = /^\/orgs?\/([^/]+)\/repos$/.exec(path)
      if (m && method === 'POST') {
        const body = JSON.parse(String(init.body))
        repos.set(`${m[1]}/${body.name}`, { private: Boolean(body.private) })
        return ok({}, 201)
      }
      m = /^\/repos\/([^/]+)\/([^/]+)\/raw\/(.+)$/.exec(path)
      if (m) {
        const f = files.get(`${m[1]}/${m[2]}/${m[3]}`)
        return f ? new Response(Buffer.from(f.b64, 'base64')) : ok({ message: 'not found' }, 404)
      }
      m = /^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/.exec(path)
      if (m) {
        if (!repos.has(`${m[1]}/${m[2]}`)) return ok({ message: 'not found' }, 404)
        const key = `${m[1]}/${m[2]}/${m[3]}`
        const f = files.get(key)
        if (method === 'GET') {
          if (f) return ok({ name: m[3].split('/').pop(), path: m[3], sha: f.sha, size: 1, type: 'file', ...(f.big ? {} : { content: f.b64 }) })
          const inside = [...files.keys()].filter((k) => k.startsWith(`${key}/`)).map((k) => k.slice(`${m![1]}/${m![2]}/`.length))
          return inside.length ? ok(inside.map((p) => ({ name: p.split('/').pop(), path: p, sha: 'x', size: 1, type: 'file' }))) : ok({ message: 'not found' }, 404)
        }
        const body = JSON.parse(String(init.body))
        if (f && body.sha !== f.sha) return ok({ message: 'sha' }, 409)
        if (method === 'DELETE') {
          files.delete(key)
          return ok({ commit: { sha: 'c' } })
        }
        files.set(key, { b64: body.content, sha: `s${++n}` })
        return ok({ content: {}, commit: { sha: 'c', message: '' } }, 201)
      }
      return ok({}, 404)
    })
    return { repos, files }
  }

  it('cada uno deja su archivo comprimido en un repositorio privado junto al del proyecto, uno por persona y teléfono', async () => {
    const { repos, files } = door43()
    expect(workRepoOf(to).repo).toBe('qu_reg-servos')
    expect(workPathOf('María José', 'a1b2')).toBe('trabajo/maria-jose-a1b2.servos.json.gz')
    expect((await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')).state).toBe('written')
    expect(repos.get('BSOJ/qu_reg-servos')).toEqual({ private: true })
    // Gzipped: what is kept is not the text.
    expect(Buffer.from(files.get('BSOJ/qu_reg-servos/trabajo/bea-dev-b.servos.json.gz')!.b64, 'base64').subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
    // Left again with the same text, nothing is written; with other text, the file is replaced.
    expect((await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')).state).toBe('same')
    expect((await leaveWork(account, to, '{"de":"Bea","mas":1}', 'Bea', 'dev-b')).state).toBe('written')
    expect([...files.keys()]).toEqual(['BSOJ/qu_reg-servos/trabajo/bea-dev-b.servos.json.gz'])
  })

  it('al traer, llega lo de los demás y no lo que este teléfono dejó; si nadie dejó nada, nada', async () => {
    door43()
    expect(await workLeft(account, to, 'dev-a')).toEqual([])
    await leaveWork(account, to, '{"de":"Ana"}', 'Ana', 'dev-a')
    await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')
    await leaveWork(account, to, '{"de":"Carla"}', 'Carla', 'dev-c')
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea"}', '{"de":"Carla"}'])
  })

  it('un archivo grande, que Door43 no da por la vía de contenidos, se trae por la vía raw', async () => {
    const { files } = door43()
    await leaveWork(account, to, '{"de":"Bea","libro":"Salmos"}', 'Bea', 'dev-b')
    files.get('BSOJ/qu_reg-servos/trabajo/bea-dev-b.servos.json.gz')!.big = true
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea","libro":"Salmos"}'])
  })

  it('el trabajo dejado antes sin comprimir se sigue trayendo, y quien lo dejó lo cambia por el comprimido al dejar otra vez', async () => {
    const { files } = door43()
    await leaveWork(account, to, '{}', 'Ana', 'dev-a')
    files.set('BSOJ/qu_reg-servos/trabajo/bea-dev-b.servos.json', { b64: Buffer.from('{"de":"Bea, antes"}').toString('base64'), sha: 'old' })
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea, antes"}'])
    await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')
    expect([...files.keys()].filter((k) => k.includes('bea'))).toEqual(['BSOJ/qu_reg-servos/trabajo/bea-dev-b.servos.json.gz'])
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea"}'])
  })
})
