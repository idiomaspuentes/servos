/**
 * Door43 over a network that may be watched (philosophy, principle 9). The app cannot tell whether a network is safe,
 * and does not say it can. What it can do is make sure that what it sends goes to Door43 and to no one in the middle:
 * in the app for phones, every request to Door43 goes through Android itself (`Door43Plugin.java`), which checks
 * Door43's certificate against the keys the app carries (`res/xml/network_security_config.xml`: the ones of the
 * authorities Door43's certificates come from, and a backup, renewed with each version of the app). Another
 * certificate, one a network puts in the middle, and nothing is sent: the request fails as `NotDoor43`, and the app
 * says that today nothing went, and that the work is still on the phone.
 *
 * The WebView would accept any certificate the phone trusts, so on the phone Door43's requests do not go through it.
 * Elsewhere (a browser, the app for computers) they go as they always did.
 */

import { onPhone } from './phone'

/** The certificate a network presented was not one of Door43's: nothing was sent. */
export class NotDoor43 extends Error {
  constructor(readonly host: string) {
    super(`The certificate of ${host} was not Door43's`)
    this.name = 'NotDoor43'
  }
}

/** The Door43 servers whose certificates the app for phones checks (their sub-domains too). */
export const PINNED = ['door43.org']
export const isPinned = (url: string) => {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && PINNED.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

interface Native {
  request(options: { url: string; method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; headers: Record<string, string>; body: string }>
  network(): Promise<{ kind: 'wifi' | 'datos' | 'ninguna' }>
}
let plugin: Native | undefined
const native = async (): Promise<{ plugin: Native }> => {
  plugin ??= (await import('@capacitor/core')).registerPlugin<Native>('ServosDoor43')
  return { plugin }
}

/** The network the phone is on now: Wi-Fi (or any that is not paid by use), mobile data, or none. */
export async function networkNow(): Promise<'wifi' | 'datos' | 'ninguna'> {
  if (onPhone()) {
    try {
      return (await (await native()).plugin.network()).kind
    } catch {
      return 'datos'
    }
  }
  const connection = (navigator as Navigator & { connection?: { type?: string } }).connection
  return connection?.type === 'cellular' ? 'datos' : 'wifi'
}

const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** A request to Door43 made by Android, its certificate checked; the answer as `fetch` gives it. */
async function pinnedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // A form (an attachment) or any body is turned into its bytes, with the type that goes with them.
  const request = new Request(input, init)
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => (headers[k] = v))
  const bytes = request.method === 'GET' || request.method === 'HEAD' ? null : new Uint8Array(await request.arrayBuffer())
  let answer: { status: number; headers: Record<string, string>; body: string }
  try {
    answer = await (await native()).plugin.request({ url: request.url, method: request.method, headers, ...(bytes?.length ? { body: toBase64(bytes) } : {}) })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'NOT_DOOR43') throw new NotDoor43(new URL(request.url).hostname)
    // No way out, as fetch says it.
    if (code === 'OFFLINE') throw new TypeError('Failed to fetch')
    throw e
  }
  const empty = answer.status === 204 || answer.status === 304
  return new Response(empty ? null : fromBase64(answer.body), { status: answer.status, headers: answer.headers })
}

/** In the app for phones, sends every request to Door43 through Android, its certificate checked. Once, at start. */
export function guardDoor43() {
  if (!onPhone()) return
  const plain = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return isPinned(url) ? pinnedFetch(input, init) : plain(input, init)
  }
}
