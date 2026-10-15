import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileOf, fingerprint, manifestOf, problemOf, proposedRepo, publish } from './door43'
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
