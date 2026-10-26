import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEAM, addToOrg, lookUpPerson, ownsOrg, userFromMessage, type Door43Account } from './door43'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import pt from '../i18n/pt.json'

const account: Door43Account = { host: 'https://qa.door43.org', username: 'ana', token: 't' }

/**
 * A Door43 with one organization, `qu_reg`, owned by `ana`; its people (`members`), its teams, and the accounts that
 * exist. Only an owner may add someone to a team, as on Door43.
 */
function door43({ owners = ['ana'], members = ['ana'], teams = [{ id: 1, name: 'Owners' }], people = ['ana', 'juanp'] } = {}) {
  const asked: string[] = []
  const made: Array<Record<string, unknown>> = []
  const added: Array<{ team: number; user: string }> = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = new URL(url)
    const method = init.method ?? 'GET'
    const path = u.pathname.replace('/api/v1', '')
    asked.push(`${method} ${path}`)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    let m: RegExpMatchArray | null
    if ((m = path.match(/^\/users\/([^/]+)\/orgs\/qu_reg\/permissions$/))) return json({ is_owner: owners.includes(m[1]), can_read: true })
    if ((m = path.match(/^\/users\/([^/]+)$/))) {
      const login = people.find((p) => p.toLowerCase() === decodeURIComponent(m![1]).toLowerCase())
      return login ? json({ id: 7, login, full_name: login === 'juanp' ? 'Juan Pérez' : '' }) : json({ message: 'user does not exist' }, 404)
    }
    if ((m = path.match(/^\/orgs\/qu_reg\/members\/([^/]+)$/))) return new Response(null, { status: members.includes(m[1]) ? 204 : 404 })
    if (path === '/orgs/qu_reg/teams' && method === 'POST') {
      if (!owners.includes('ana')) return json({ message: 'Must be an organization owner' }, 403)
      const body = JSON.parse(String(init.body))
      made.push(body)
      const team = { id: 2, name: body.name }
      teams.push(team)
      return json(team, 201)
    }
    if (path === '/orgs/qu_reg/teams') return json(teams)
    if ((m = path.match(/^\/teams\/(\d+)\/members\/([^/]+)$/)) && method === 'PUT') {
      if (!owners.includes('ana')) return json({ message: 'Must be an organization owner' }, 403)
      added.push({ team: Number(m[1]), user: m[2] })
      return new Response(null, { status: 204 })
    }
    return json({}, 404)
  })
  return { asked, made, added }
}

afterEach(() => vi.unstubAllGlobals())

describe('adding someone to the team’s organization', () => {
  it('knows whether this account owns the organization: only an owner may add someone', async () => {
    door43()
    expect(await ownsOrg(account, 'qu_reg')).toBe(true)
    door43({ owners: [] })
    expect(await ownsOrg(account, 'qu_reg')).toBe(false)
  })

  it('looks the person up first: their name, and whether they are in it already', async () => {
    door43()
    expect(await lookUpPerson(account, 'qu_reg', 'JuanP')).toEqual({ login: 'juanp', fullName: 'Juan Pérez', inOrg: false })
    expect(await lookUpPerson(account, 'qu_reg', 'ana')).toEqual({ login: 'ana', fullName: undefined, inOrg: true })
    expect(await lookUpPerson(account, 'qu_reg', 'nadie')).toBeNull()
  })

  it('makes the translators’ team the first time, to save and publish in every project but not to manage', async () => {
    const { made, added } = door43()
    expect(await addToOrg(account, 'qu_reg', 'juanp')).toBe('added')
    expect(made).toEqual([expect.objectContaining({ name: TEAM, permission: 'write', includes_all_repositories: true, can_create_org_repo: true })])
    expect(added).toEqual([{ team: 2, user: 'juanp' }])
  })

  it('uses the translators’ team it finds, never the owners’', async () => {
    const { made, added } = door43({ teams: [{ id: 1, name: 'Owners' }, { id: 5, name: 'Traductores' }] })
    await addToOrg(account, 'qu_reg', 'juanp')
    expect(made).toEqual([])
    expect(added).toEqual([{ team: 5, user: 'juanp' }])
  })

  it('adds nobody twice', async () => {
    const { added, asked } = door43({ members: ['ana', 'juanp'] })
    expect(await addToOrg(account, 'qu_reg', 'juanp')).toBe('already')
    expect(added).toEqual([])
    expect(asked.some((a) => a.startsWith('POST'))).toBe(false)
  })

  it('says Door43 did not allow it when this account does not own the organization', async () => {
    door43({ owners: [] })
    await expect(addToOrg(account, 'qu_reg', 'juanp')).rejects.toMatchObject({ status: 403 })
  })
})

describe('the user name in the message the person sent', () => {
  const templates = [es, pt, en].map((x) => (x as Record<string, string>)['org.mensaje'])

  it('takes it from the whole message, in any of the app’s languages', () => {
    for (const lang of [es, pt, en]) {
      const message = (lang as Record<string, string>)['org.mensaje'].replace('{usuario}', 'juan.p-2').replace('{org}', 'qu_reg')
      expect(userFromMessage(message, templates)).toBe('juan.p-2')
    }
  })

  it('takes it from a message changed after the name, or with a greeting before it', () => {
    expect(userFromMessage('Hola. Mi usuario de Door43 es juanp. Gracias', templates)).toBe('juanp')
    expect(userFromMessage('my door43 user name is @Rosa_T, add me please', templates)).toBe('Rosa_T')
  })

  it('finds nothing in words without the name, rather than searching for the words', () => {
    expect(userFromMessage('agrégueme por favor', templates)).toBe('')
  })

  it('takes a name written alone as it is, without spaces or an @', () => {
    expect(userFromMessage('  @juanp ', templates)).toBe('juanp')
    expect(userFromMessage('juanp', templates)).toBe('juanp')
  })
})
