import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachToRelease, fileOf, fingerprint, hostName, leaveWork, manifestOf, markVersion, problemOf, proposedRepo, publish, signIn, wantsQa, workLeft, workNameOf, workRepoOf } from './door43'
import { DcsApiError } from '../../door43/dcs'
import { fakeDoor43 } from './fakeDoor43'

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

  const door43 = () => fakeDoor43(to.host)
  const names = (assets: Map<number, { name: string }>) => [...assets.values()].map((a) => a.name)

  it('cada uno deja su trabajo comprimido como adjunto del release «trabajo» de un repositorio privado, uno por persona y teléfono', async () => {
    const { repos, releases, assets } = door43()
    expect(workRepoOf(to).repo).toBe('qu_reg-servos')
    expect(workNameOf('María José', 'a1b2')).toBe('maria-jose-a1b2.servos.json.gz')
    expect((await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')).state).toBe('written')
    expect(repos.get('BSOJ/qu_reg-servos')).toEqual({ private: true })
    expect(releases.get('BSOJ/qu_reg-servos@trabajo')?.prerelease).toBe(true)
    // Gzipped: what is kept is not the text.
    expect([...[...assets.values()][0].bytes.subarray(0, 2)]).toEqual([0x1f, 0x8b])
    // Left again: the attachment is replaced in place, no second one, nothing piled up.
    await leaveWork(account, to, '{"de":"Bea","mas":1}', 'Bea', 'dev-b')
    expect(names(assets)).toEqual(['bea-dev-b.servos.json.gz'])
  })

  it('al traer, llega lo de los demás y no lo que este teléfono dejó; si nadie dejó nada, nada', async () => {
    door43()
    expect(await workLeft(account, to, 'dev-a')).toEqual([])
    await leaveWork(account, to, '{"de":"Ana"}', 'Ana', 'dev-a')
    await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')
    await leaveWork(account, to, '{"de":"Carla"}', 'Carla', 'dev-c')
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea"}', '{"de":"Carla"}'])
  })

  it('una versión marcada lleva el audio como adjunto, aparte de la historia del repositorio', async () => {
    const { repos, releases, assets } = door43()
    repos.set('BSOJ/qu_reg', { private: false })
    const release = await markVersion(account, to, 3, 'Versión de prueba')
    await attachToRelease(account, to, release.id, 'audio-JON.zip', new Uint8Array([0x50, 0x4b, 3, 4]))
    expect(releases.get('BSOJ/qu_reg@v3')?.id).toBe(release.id)
    expect([...assets.values()].map((a) => [a.release, a.name, a.bytes.length])).toEqual([[release.id, 'audio-JON.zip', 4]])
  })

  it('lo que un Servos anterior dejó como archivo del repositorio se sigue trayendo, y quien lo dejó lo quita al dejar otra vez', async () => {
    const { files, assets } = door43()
    await leaveWork(account, to, '{}', 'Ana', 'dev-a')
    files.set('BSOJ/qu_reg-servos/trabajo/bea-dev-b.servos.json', { b64: Buffer.from('{"de":"Bea, antes"}').toString('base64'), sha: 'old' })
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea, antes"}'])
    await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b')
    expect([...files.keys()]).toEqual([])
    expect(names(assets)).toEqual(['ana-dev-a.servos.json.gz', 'bea-dev-b.servos.json.gz'])
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text)).toEqual(['{"de":"Bea"}'])
  })
})

describe('el trabajo de un proyecto de «Solo el equipo» en Door43 no dice de quién es ni qué lo deja', () => {
  afterEach(() => vi.unstubAllGlobals())
  const account = { host: 'https://qa.door43.org', username: 'ana', token: 't' }
  const to = { host: 'https://qa.door43.org', owner: 'BSOJ', repo: 'qu_reg' }
  const names = (assets: Map<number, { name: string }>) => [...assets.values()].map((a) => a.name)
  const QUIET = /^[0-9a-f]{8}-[0-9a-f]{8}\.dat$/

  it('el nombre son dos huellas cortas: ni la persona, ni el teléfono, ni Servos', async () => {
    const { assets } = fakeDoor43(to.host)
    expect((await leaveWork(account, to, '{"de":"María José"}', 'María José', 'dev-a', 'equipo')).state).toBe('written')
    const [name] = names(assets)
    expect(name).toMatch(QUIET)
    expect(name).not.toMatch(/maria|jose|dev-a|servos/i)
    // Left again: replaced in place.
    await leaveWork(account, to, '{"de":"María José","mas":1}', 'María José', 'dev-a', 'equipo')
    expect(names(assets)).toEqual([name])
  })

  it('dos personas en un teléfono dejan dos; el mismo teléfono no se reconoce de un proyecto a otro', async () => {
    const { assets } = fakeDoor43(to.host)
    await leaveWork(account, to, '{}', 'Ana', 'dev-a', 'equipo')
    await leaveWork(account, to, '{}', 'Bea', 'dev-a', 'equipo')
    await leaveWork(account, { ...to, repo: 'qu_otro' }, '{}', 'Ana', 'dev-a', 'equipo')
    const [ana, bea, otro] = names(assets)
    expect(new Set([ana, bea, otro]).size).toBe(3)
    // The phone's part is the same on one project's shelf (it tells this phone's own apart), not across projects.
    expect(ana.slice(0, 8)).toBe(bea.slice(0, 8))
    expect(otro.slice(0, 8)).not.toBe(ana.slice(0, 8))
  })

  it('el release no nombra a Servos, y uno hecho antes con su nombre se calla al dejar', async () => {
    const { releases } = fakeDoor43(to.host)
    await leaveWork(account, to, '{}', 'Ana', 'dev-a')
    expect(releases.get('BSOJ/qu_reg-servos@trabajo')?.body).toContain('Servos')
    await leaveWork(account, to, '{}', 'Ana', 'dev-a', 'equipo')
    const shelf = releases.get('BSOJ/qu_reg-servos@trabajo')!
    expect([shelf.name, shelf.body, shelf.prerelease]).toEqual(['trabajo', '', true])
    // Made quiet from the start.
    const { releases: fresh } = fakeDoor43(to.host)
    await leaveWork(account, to, '{}', 'Ana', 'dev-a', 'equipo')
    expect([fresh.get('BSOJ/qu_reg-servos@trabajo')?.name, fresh.get('BSOJ/qu_reg-servos@trabajo')?.body]).toEqual(['trabajo', ''])
  })

  it('lo que el teléfono dejó con su nombre de antes se quita al dejar sin nombre, y el commit no nombra a nadie', async () => {
    const { assets, files, messages } = fakeDoor43(to.host)
    await leaveWork(account, to, '{"de":"Ana, antes"}', 'Ana', 'dev-a')
    files.set('BSOJ/qu_reg-servos/trabajo/ana-dev-a.servos.json', { b64: Buffer.from('{}').toString('base64'), sha: 'old' })
    await leaveWork(account, to, '{"de":"Ana"}', 'Ana', 'dev-a', 'equipo')
    expect(names(assets)).toHaveLength(1)
    expect(names(assets)[0]).toMatch(QUIET)
    expect([...files.keys()]).toEqual([])
    expect(messages.join(' ')).not.toMatch(/ana/i)
  })

  it('al traer, llega lo de los demás, con nombre o sin él, y no lo de este teléfono', async () => {
    const { files } = fakeDoor43(to.host)
    await leaveWork(account, to, '{"de":"Ana"}', 'Ana', 'dev-a', 'equipo')
    await leaveWork(account, to, '{"de":"Eva"}', 'Eva', 'dev-a', 'equipo')
    await leaveWork(account, to, '{"de":"Bea"}', 'Bea', 'dev-b', 'equipo')
    // Left before by an earlier Servos, with names: on the shelf and as a file of the repository.
    await leaveWork(account, to, '{"de":"Carla"}', 'Carla', 'dev-c')
    files.set('BSOJ/qu_reg-servos/trabajo/dora-dev-d.servos.json', { b64: Buffer.from('{"de":"Dora"}').toString('base64'), sha: 'old' })
    files.set('BSOJ/qu_reg-servos/trabajo/ana-dev-a.servos.json', { b64: Buffer.from('{"de":"Ana, antes"}').toString('base64'), sha: 'old2' })
    expect((await workLeft(account, to, 'dev-a')).map((x) => x.text).sort()).toEqual(['{"de":"Bea"}', '{"de":"Carla"}', '{"de":"Dora"}'])
    expect((await workLeft(account, to, 'dev-b')).map((x) => x.text).sort()).toEqual(['{"de":"Ana"}', '{"de":"Ana, antes"}', '{"de":"Carla"}', '{"de":"Dora"}', '{"de":"Eva"}'])
  })
})

describe('which Door43', () => {
  const kept = new Map<string, string>()
  const storage = {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
    removeItem: (k: string) => void kept.delete(k),
  }
  afterEach(() => vi.unstubAllGlobals())

  it('QA only for whoever opened the app with ?server=qa, kept until ?server=door43', () => {
    vi.stubGlobal('localStorage', storage)
    expect(wantsQa('')).toBe(false)
    expect(wantsQa('?server=qa')).toBe(true)
    // The installed app opens without the question: still QA.
    expect(wantsQa('')).toBe(true)
    expect(wantsQa('?server=door43')).toBe(false)
    expect(wantsQa('')).toBe(false)
  })

  it('an account linked to QA before is still named QA', () => {
    expect(hostName('https://qa.door43.org')).toBe('qa')
    expect(hostName('https://git.door43.org')).toBe('door43')
  })
})
