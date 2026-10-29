import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrgError, createTeamOrg, findOrgs, validName, type Door43Account } from './door43'

const account: Door43Account = { host: 'https://qa.door43.org', username: 'ana', token: 't' }

/** A Door43 showing `shown` organizations, 50 a page, that makes one and says when a name is taken. */
function door43(shown: string[]) {
  const made: Array<{ username: string; visibility: string }> = []
  const asked: string[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = new URL(url)
    asked.push(`${init.method ?? 'GET'} ${u.pathname}${u.search}`)
    if (u.pathname === '/api/v1/orgs' && init.method === 'POST') {
      const body = JSON.parse(String(init.body))
      if (shown.includes(body.username)) return new Response(JSON.stringify({ message: `user already exists [name: ${body.username}]` }), { status: 422 })
      made.push(body)
      return new Response(JSON.stringify({ id: 9, name: body.username }), { status: 201 })
    }
    if (u.pathname === '/api/v1/orgs') {
      const page = Number(u.searchParams.get('page'))
      const limit = Number(u.searchParams.get('limit'))
      return new Response(JSON.stringify(shown.slice((page - 1) * limit, page * limit).map((name) => ({ name }))))
    }
    return new Response('{}', { status: 404 })
  })
  return { made, asked }
}

afterEach(() => vi.unstubAllGlobals())

describe('the team’s organization on Door43', () => {
  it('finds organizations by part of their name, the one named exactly first, among every page Door43 shows', async () => {
    const shown = [...Array.from({ length: 120 }, (_, i) => `team-${i}`), 'equipo-kichwa', 'Kichwa', 'kichwa_reg']
    const { asked } = door43(shown)
    expect(await findOrgs({ ...account, host: 'https://a.example' }, 'kichwa')).toEqual(['Kichwa', 'kichwa_reg', 'equipo-kichwa'])
    // Three pages hold them all: Door43 is asked until a page comes short, a few pages at a time.
    expect(asked.filter((a) => a.startsWith('GET /api/v1/orgs')).length).toBeLessThanOrEqual(4)
    // Asked again in the same visit, the list is not brought again.
    expect(await findOrgs({ ...account, host: 'https://a.example' }, 'TEAM-11')).toEqual(['team-11', 'team-110', 'team-111', 'team-112', 'team-113', 'team-114', 'team-115', 'team-116', 'team-117', 'team-118', 'team-119'])
    expect(asked.filter((a) => a.startsWith('GET /api/v1/orgs')).length).toBeLessThanOrEqual(4)
  })

  it('makes an organization only its members see, or one anyone sees', async () => {
    const { made } = door43([])
    expect(await createTeamOrg(account, 'qu_reg', true)).toBe('qu_reg')
    await createTeamOrg(account, 'qu_pub', false)
    expect(made).toEqual([expect.objectContaining({ username: 'qu_reg', visibility: 'private' }), expect.objectContaining({ username: 'qu_pub', visibility: 'public' })])
  })

  it('says when the name is taken', async () => {
    door43(['qu_reg'])
    await expect(createTeamOrg(account, 'qu_reg', true)).rejects.toEqual(new OrgError('taken'))
  })

  it('takes only the names Door43 takes', () => {
    expect(validName('qu_reg')).toBe(true)
    expect(validName('Equipo-Kichwa.2')).toBe(true)
    expect(validName('equipo kichwa')).toBe(false)
    expect(validName('kichwá')).toBe(false)
    expect(validName('-equipo')).toBe(false)
  })
})
