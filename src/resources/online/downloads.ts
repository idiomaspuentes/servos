/**
 * The download queue: fetches a plan's parts from the Worker into staging, a few at a time, originals first. Staging
 * is the queue's memory: a part already staged is never fetched again, so a run cut by a dropped connection is resumed
 * by simply running it again with the same plan. Nothing is applied here; the apply waits until every part is staged.
 *
 * When to stop: a part the Worker no longer has means the list is stale (`listaOtraVez`); a 429 means wait
 * (`espera`); a full disk is `sinEspacio`; a part that fails three tries in this run, the caller's abort, or anything
 * that throws is a `falla`. On any of these no new part or try is started, the ones in flight are let finish (and
 * staged when they come), and the run returns once every worker has ended. It never rejects.
 */

import type { PartEntry, PartsStaging } from '@bt-synergy/language-pack'
import { fetchPart as realFetchPart } from './packsClient'

/** Parts and bytes staged of all the plan's parts (already staged ones count as done from the start). */
export type Progress = { done: number; total: number; bytesDone: number; bytesTotal: number }

export type QueueResult =
  | { kind: 'listo' }
  | { kind: 'listaOtraVez' }
  | { kind: 'espera'; retryAfter: number }
  | { kind: 'sinEspacio' }
  | { kind: 'falla'; message: string }

type Stop = Exclude<QueueResult, { kind: 'listo' }>

/** Parts fetched at once. */
export const AT_ONCE = 4

/** Tries of one part in one run before the run is a `falla`. */
export const TRIES = 3

export type DownloadInput = {
  server: string
  parts: PartEntry[]
  /** The shas of the originals list's parts: fetched first. */
  originals: Set<string>
  staging: PartsStaging
  onProgress?: (p: Progress) => void
  fetchPart?: typeof realFetchPart
  /** Parts in flight at once (default 4; anything not a finite number of at least 1 is the default). */
  at?: number
  /** The caller's abort: requests in flight end, no new one starts, and the run is a `falla`. */
  signal?: AbortSignal
}

const short = (sha: string) => sha.slice(0, 12)
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** When two reasons stop one run, the one that says more wins: a stale list has to be fetched again in any case, a
 *  wait says when to come back, a full disk names its own cure. */
const RANK: Record<Stop['kind'], number> = { listaOtraVez: 4, espera: 3, sinEspacio: 2, falla: 1 }

export async function downloadParts(input: DownloadInput): Promise<QueueResult> {
  const fetchOne = input.fetchPart ?? realFetchPart
  const at = Number.isFinite(input.at) && input.at! >= 1 ? Math.floor(input.at!) : AT_ONCE
  const { signal } = input

  let stop: Stop | null = null
  const stopWith = (why: Stop) => {
    if (!stop || RANK[why.kind] > RANK[stop.kind]) stop = why
    else if (stop.kind === 'espera' && why.kind === 'espera') {
      stop = { kind: 'espera', retryAfter: Math.max(stop.retryAfter, why.retryAfter) }
    }
  }
  const cancelled = () => stopWith({ kind: 'falla', message: 'download cancelled' })
  if (signal?.aborted) return { kind: 'falla', message: 'download cancelled' }
  signal?.addEventListener('abort', cancelled, { once: true })

  try {
    // One entry per sha (two slots may share a part), originals first, the plan's order kept otherwise.
    const unique = [...new Map(input.parts.map((p) => [p.sha256, p])).values()]
    const ordered = [
      ...unique.filter((p) => input.originals.has(p.sha256)),
      ...unique.filter((p) => !input.originals.has(p.sha256)),
    ]

    let already: boolean[]
    try {
      already = await Promise.all(ordered.map((p) => input.staging.has(p.sha256)))
    } catch (e) {
      return { kind: 'falla', message: `staging could not be read: ${messageOf(e)}` }
    }
    const progress: Progress = { done: 0, total: ordered.length, bytesDone: 0, bytesTotal: 0 }
    const queue: PartEntry[] = []
    ordered.forEach((p, i) => {
      progress.bytesTotal += p.bytes
      if (already[i]) {
        progress.done++
        progress.bytesDone += p.bytes
      } else queue.push(p)
    })
    const report = () => {
      try {
        input.onProgress?.({ ...progress })
      } catch (e) {
        stopWith({ kind: 'falla', message: `progress could not be shown: ${messageOf(e)}` })
      }
    }
    report()

    const fetchAndStage = async (part: PartEntry): Promise<void> => {
      for (let tryNo = 1; tryNo <= TRIES; tryNo++) {
        if (stop) return
        const answer = await fetchOne(input.server, part.sha256, signal ? { signal } : undefined)
        switch (answer.kind) {
          case 'listo':
            try {
              await input.staging.put(part.sha256, answer.bytes)
            } catch (e) {
              // Fetching it again would not help: a full disk is said as such, anything else is a falla.
              if ((e as { name?: unknown } | null)?.name === 'QuotaExceededError') stopWith({ kind: 'sinEspacio' })
              else stopWith({ kind: 'falla', message: `part ${short(part.sha256)} could not be staged: ${messageOf(e)}` })
              return
            }
            progress.done++
            progress.bytesDone += part.bytes
            report()
            return
          case 'parteNoEstá':
            stopWith({ kind: 'listaOtraVez' })
            return
          case 'espera':
            stopWith({ kind: 'espera', retryAfter: answer.retryAfter })
            return
          case 'falla':
            break
        }
      }
      stopWith({ kind: 'falla', message: `part ${short(part.sha256)} failed ${TRIES} tries` })
    }

    // Each worker catches what it throws, so the run ends only when every worker has: none keeps taking parts
    // after the run has answered.
    const worker = async () => {
      while (!stop) {
        const part = queue.shift()
        if (!part) return
        try {
          await fetchAndStage(part)
        } catch (e) {
          stopWith({ kind: 'falla', message: `part ${short(part.sha256)}: ${messageOf(e)}` })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(at, queue.length) }, worker))

    return stop ?? { kind: 'listo' }
  } finally {
    signal?.removeEventListener('abort', cancelled)
  }
}
