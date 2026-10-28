/**
 * The packs that come inside the app for phones and computers (`packsInside` in vite.config.ts, for `--mode telefono`
 * and `--mode escritorio`): opened by themselves the first time the app starts, as if the person had received them,
 * so a team can choose its language, write its name and begin a book with nothing else to pass around (decided with
 * Abel on 19 October 2026 for the first workshop). «Recibir textos y ayudas» stays for another language or a newer
 * pack. The web app brings none: a first visit would download them all.
 *
 * Each pack is opened once, known by what it holds (`id`), so a new version of the app that brings a newer pack opens
 * it, and what the device already has newer or the same is left as it is (`packAgainstDevice`).
 */

import { bringsAnything, packAgainstDevice, type PackAgainstDevice } from '../../resources/freshness'
import { whileOnlineIdle } from '../../resources/online/onlineLock'
import { describePack, openPack } from '../../resources/packs'
import { openResourceStores, type ResourceStores } from '../../resources/store'
import { copiesOnDevice, refreshLibrary } from './library'

export interface PackInside {
  file: string
  /** What it holds, drawn from its bytes at build time. */
  id: string
}

const KEPT = 'servos.paquetes.dentro'

/** The packs still to open, in the order the build lists them (the originals first: the texts' quotes need them). */
export function toOpen(inside: readonly PackInside[], opened: readonly string[]): PackInside[] {
  return inside.filter((p) => !opened.includes(p.id))
}

function readOpened(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEPT) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function keepOpened(ids: string[]) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(ids))
  } catch {
    /* without storage they are opened again next time; what is here already is left as it is */
  }
}

/** How far the opening has gone, for home to say it while it lasts. */
export interface InsideState {
  opening: boolean
  /** Of every pack to open, 0 to 1. */
  part: number
}

let state: InsideState = { opening: false, part: 0 }
const listeners = new Set<(s: InsideState) => void>()
const tell = (next: InsideState) => {
  state = next
  listeners.forEach((fn) => fn(state))
}
export const insideState = (): InsideState => state
export function onInside(fn: (s: InsideState) => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/**
 * Opens a pack once what it replaces is decided (`decide`, `packAgainstDevice` against the copies here) inside the
 * section that holds Servos online's applies back: an apply that landed meanwhile is part of what it is decided
 * against. False when the pack brings nothing new, and it is not opened.
 */
export function openDecidingUnderLock(
  stores: ResourceStores,
  bytes: Uint8Array,
  decide: () => PackAgainstDevice,
  options: { file?: string; onProgress?: (done: number, total: number) => void },
  open: (stores: ResourceStores, bytes: Uint8Array, options: Parameters<typeof openPack>[2]) => Promise<unknown> = openPack,
): Promise<boolean> {
  return whileOnlineIdle(async (held) => {
    const against = decide()
    if (!bringsAnything(against)) return false
    await open(stores, bytes, { ...options, replace: against.replace, held })
    return true
  })
}

/** Opens the packs the app brings that this device has not opened yet. Runs once, after the library is read. */
export async function openPacksInside(): Promise<void> {
  const mode = import.meta.env.MODE
  if (mode !== 'telefono' && mode !== 'escritorio') return
  let inside: PackInside[]
  try {
    inside = ((await (await fetch('./paquetes/index.json')).json()) as { packs: PackInside[] }).packs ?? []
  } catch {
    return
  }
  const opened = readOpened()
  const todo = toOpen(inside, opened)
  if (!todo.length) return
  tell({ opening: true, part: 0 })
  const stores = openResourceStores()
  try {
    for (const [i, pack] of todo.entries()) {
      const bytes = new Uint8Array(await (await fetch(`./paquetes/${pack.file}`)).arrayBuffer())
      const summary = await describePack(bytes)
      // A pack made for another version of the app is not opened; it is not tried again either.
      if (!summary.otherVersion) {
        const decide = () => packAgainstDevice({ resources: summary.resources, books: summary.kind === 'book' ? summary.books : undefined }, copiesOnDevice())
        await openDecidingUnderLock(stores, bytes, decide, {
          file: pack.file,
          onProgress: (done, total) => tell({ opening: true, part: (i + (total ? done / total : 0)) / todo.length }),
        })
      }
      opened.push(pack.id)
      keepOpened(opened)
      // What is here is read again after each, so the originals are known when the texts that quote them come.
      await refreshLibrary()
    }
  } catch {
    // Stopped halfway (the app closed, a file could not be read): the next start goes on from the one not ended,
    // and an interrupted opening is filled in by opening the same pack again (`openPack`).
  } finally {
    tell({ opening: false, part: 1 })
  }
}
