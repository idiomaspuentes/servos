/**
 * The download queue: fetches a plan's parts from the Worker into staging, a few at a time, originals first. Staging
 * is the queue's memory: a part already staged is never fetched again, so a run cut by a dropped connection is resumed
 * by simply running it again with the same plan. Nothing is applied here; the apply waits until every part is staged.
 *
 * When to stop: a part the Worker no longer has means the list is stale (`listaOtraVez`); a 429 means wait
 * (`espera`); a part that fails three tries in this run is a `falla`. On any of these no new part is started, the
 * ones in flight are let finish (and staged when they come), and then the run returns.
 */

import type { PartEntry, PartsStaging } from '@bt-synergy/language-pack'
import { fetchPart as realFetchPart } from './packsClient'

/** Parts and bytes staged of all the plan's parts (already staged ones count as done from the start). */
export type Progress = { done: number; total: number; bytesDone: number; bytesTotal: number }

export type QueueResult =
  | { kind: 'listo' }
  | { kind: 'listaOtraVez' }
  | { kind: 'espera'; retryAfter: number }
  | { kind: 'falla'; message: string }

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
  /** Parts in flight at once (default 4). */
  at?: number
}

const short = (sha: string) => sha.slice(0, 12)

export async function downloadParts(input: DownloadInput): Promise<QueueResult> {
  const fetchOne = input.fetchPart ?? realFetchPart
  const at = Math.max(1, input.at ?? AT_ONCE)

  // One entry per sha (two slots may share a part), originals first, the plan's order kept otherwise.
  const unique = [...new Map(input.parts.map((p) => [p.sha256, p])).values()]
  const ordered = [
    ...unique.filter((p) => input.originals.has(p.sha256)),
    ...unique.filter((p) => !input.originals.has(p.sha256)),
  ]

  const already = await Promise.all(ordered.map((p) => input.staging.has(p.sha256)))
  const progress: Progress = { done: 0, total: ordered.length, bytesDone: 0, bytesTotal: 0 }
  const queue: PartEntry[] = []
  ordered.forEach((p, i) => {
    progress.bytesTotal += p.bytes
    if (already[i]) {
      progress.done++
      progress.bytesDone += p.bytes
    } else queue.push(p)
  })
  const report = () => input.onProgress?.({ ...progress })
  report()
  if (queue.length === 0) return { kind: 'listo' }

  // Why the run stopped, if it did. A stale list outranks a wait, and a wait outranks a falla: fetching the list
  // again is needed in any case, and a wait says when to come back.
  let stop: Exclude<QueueResult, { kind: 'listo' }> | null = null
  const rank = { listaOtraVez: 3, espera: 2, falla: 1 } as const
  const stopWith = (why: Exclude<QueueResult, { kind: 'listo' }>) => {
    if (!stop || rank[why.kind] > rank[stop.kind]) stop = why
    else if (stop.kind === 'espera' && why.kind === 'espera') stop = { kind: 'espera', retryAfter: Math.max(stop.retryAfter, why.retryAfter) }
  }

  const fetchAndStage = async (part: PartEntry): Promise<void> => {
    for (let tryNo = 1; tryNo <= TRIES; tryNo++) {
      if (stop) return
      const answer = await fetchOne(input.server, part.sha256)
      switch (answer.kind) {
        case 'listo':
          try {
            await input.staging.put(part.sha256, answer.bytes)
          } catch (e) {
            // Staging refused or could not keep it (a full disk): fetching it again would not help.
            stopWith({ kind: 'falla', message: `part ${short(part.sha256)} could not be staged: ${(e as Error)?.message ?? e}` })
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

  const worker = async () => {
    while (!stop) {
      const part = queue.shift()
      if (!part) return
      await fetchAndStage(part)
    }
  }
  await Promise.all(Array.from({ length: Math.min(at, queue.length) }, worker))

  return stop ?? { kind: 'listo' }
}
