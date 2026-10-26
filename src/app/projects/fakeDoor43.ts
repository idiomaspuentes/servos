/**
 * A Door43 in memory, for the tests: repositories made by an organization, files kept as base64 (created, updated with
 * the sha they have, deleted), and releases whose attachments are uploaded as a form, listed, deleted, and downloaded
 * from `/attachments/…` only with the key. `offline()` makes it unreachable, as a phone without internet.
 */

import { vi } from 'vitest'

export const TOKEN = 't'

export function fakeDoor43(host = 'https://qa.door43.org') {
  const repos = new Map<string, { private: boolean }>()
  const files = new Map<string, { b64: string; sha: string }>()
  const releases = new Map<string, { id: number; tag_name: string; prerelease: boolean; name?: string; body?: string }>()
  const assets = new Map<number, { id: number; release: number; name: string; bytes: Uint8Array; uuid: string }>()
  const calls: string[] = []
  /** The messages of the commits made (files written or deleted). */
  const messages: string[] = []
  let n = 0
  let reachable = true
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    if (!reachable) throw new TypeError('Failed to fetch')
    const u = new URL(url)
    const path = decodeURIComponent(u.pathname.replace('/api/v1', ''))
    const method = init.method ?? 'GET'
    calls.push(`${method} ${path}`)
    const keyed = (init.headers as Record<string, string> | undefined)?.Authorization === `token ${TOKEN}`
    const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    let m = /^\/attachments\/(.+)$/.exec(path)
    if (m) {
      const a = [...assets.values()].find((x) => x.uuid === m![1])
      return a && keyed ? new Response(new Uint8Array(a.bytes)) : new Response('Not Found', { status: 404 })
    }
    m = /^\/repos\/([^/]+)\/([^/]+)$/.exec(path)
    if (m) return repos.has(`${m[1]}/${m[2]}`) ? ok({ name: m[2] }) : ok({ message: 'not found' }, 404)
    m = /^\/orgs?\/([^/]+)\/repos$/.exec(path)
    if (m && method === 'POST') {
      const body = JSON.parse(String(init.body))
      repos.set(`${m[1]}/${body.name}`, { private: Boolean(body.private) })
      return ok({}, 201)
    }
    m = /^\/repos\/([^/]+)\/([^/]+)\/(.*)$/.exec(path)
    if (!m || !repos.has(`${m[1]}/${m[2]}`)) return ok({ message: 'not found' }, 404)
    const repo = `${m[1]}/${m[2]}`
    const rest = m[3]
    let r = /^releases\/tags\/(.+)$/.exec(rest)
    if (r) {
      const rel = releases.get(`${repo}@${r[1]}`)
      return rel ? ok(rel) : ok({ message: 'not found' }, 404)
    }
    if (rest === 'releases' && method === 'GET') return ok([...releases.entries()].filter(([k]) => k.startsWith(`${repo}@`)).map(([, v]) => v))
    if (rest === 'releases' && method === 'POST') {
      const body = JSON.parse(String(init.body))
      if (releases.has(`${repo}@${body.tag_name}`)) return ok({ message: 'Release is has no Tag' }, 409)
      const rel = { id: ++n, tag_name: body.tag_name, prerelease: Boolean(body.prerelease), name: String(body.name ?? ''), body: String(body.body ?? '') }
      releases.set(`${repo}@${body.tag_name}`, rel)
      return ok(rel, 201)
    }
    r = /^releases\/(\d+)$/.exec(rest)
    if (r && method === 'PATCH') {
      const rel = [...releases.values()].find((x) => x.id === Number(r![1]))
      if (!rel) return ok({ message: 'not found' }, 404)
      Object.assign(rel, JSON.parse(String(init.body)))
      return ok(rel)
    }
    r = /^releases\/(\d+)\/assets(?:\/(\d+))?$/.exec(rest)
    if (r) {
      const release = Number(r[1])
      if (method === 'GET') return ok([...assets.values()].filter((a) => a.release === release).map((a) => ({ id: a.id, name: a.name, size: a.bytes.length, browser_download_url: `${host}/attachments/${a.uuid}` })))
      if (method === 'DELETE') {
        assets.delete(Number(r[2]))
        return new Response(null, { status: 204 })
      }
      const file = (init.body as FormData).get('attachment') as Blob
      const a = { id: ++n, release, name: u.searchParams.get('name')!, bytes: new Uint8Array(await file.arrayBuffer()), uuid: `u${n}` }
      assets.set(a.id, a)
      return ok({ id: a.id, name: a.name, size: a.bytes.length, browser_download_url: `${host}/attachments/${a.uuid}` }, 201)
    }
    if (/^contents\/?$/.test(rest) && method === 'GET') {
      // The repository's top: its files, not those in folders.
      const top = [...files.keys()].filter((k) => k.startsWith(`${repo}/`)).map((k) => k.slice(`${repo}/`.length)).filter((p) => !p.includes('/'))
      return ok(top.map((p) => ({ name: p, path: p, sha: files.get(`${repo}/${p}`)!.sha, size: 1, type: 'file' })))
    }
    r = /^contents\/(.+)$/.exec(rest)
    if (r) {
      const key = `${repo}/${r[1]}`
      const f = files.get(key)
      if (method === 'GET') {
        if (f) return ok({ name: r[1].split('/').pop(), path: r[1], sha: f.sha, size: 1, type: 'file', content: f.b64 })
        const inside = [...files.keys()].filter((k) => k.startsWith(`${key}/`)).map((k) => k.slice(`${repo}/`.length))
        return inside.length ? ok(inside.map((p) => ({ name: p.split('/').pop(), path: p, sha: 'x', size: 1, type: 'file' }))) : ok({ message: 'not found' }, 404)
      }
      if (method === 'DELETE') {
        messages.push(JSON.parse(String(init.body ?? '{}')).message ?? '')
        files.delete(key)
        return ok({ commit: { sha: 'c' } })
      }
      const body = JSON.parse(String(init.body))
      if (method === 'POST' && f) return ok({ message: 'already exists' }, 422)
      if (method === 'PUT' && f?.sha !== body.sha) return ok({ message: 'sha does not match' }, 409)
      messages.push(body.message ?? '')
      files.set(key, { b64: body.content, sha: `s${++n}` })
      return ok({ content: { path: r[1], sha: files.get(key)!.sha }, commit: { sha: `c${n}` } }, method === 'POST' ? 201 : 200)
    }
    return ok({}, 404)
  })
  return {
    repos,
    files,
    releases,
    assets,
    calls,
    messages,
    offline: () => void (reachable = false),
    online: () => void (reachable = true),
    /** A file's text, as kept. */
    text: (key: string) => (files.has(key) ? Buffer.from(files.get(key)!.b64, 'base64').toString('utf8') : null),
  }
}
