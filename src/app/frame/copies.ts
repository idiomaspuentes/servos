/**
 * A copy of the work outside the phone (design, section 11; philosophy, principle 9): if the phone is lost or broken,
 * the work is on the memory card (or a USB stick), and «Receive» brings it all back on another phone or a computer.
 * The person chooses the folder once; from then on each project is copied a few minutes after it changed, never while
 * a sentence is being typed, and when the app goes behind the others. The three latest copies of each stay.
 *
 * Some teams translate where the Bible is banned, so how the copy is kept is asked first, with what it means: with a
 * password (recommended), it is sealed and named so it says nothing (`projects/lockedCopy.ts`, `copia-3fa9c1-….dat`);
 * without one, it is the file «Share» makes, which anyone holding the card can open. The key drawn from the password is
 * kept on the phone, unable to leave it; the password is kept nowhere.
 *
 * Only in the app for phones (`android/…/CopiesPlugin.java`); elsewhere none of it runs.
 */

import { loadProjects, type Project } from '../projects/model'
import { keyFrom, lock, type CopyKey } from '../projects/lockedCopy'
import { shareProject, withSounds } from '../projects/share'
import { whenNotTyping } from './online'
import { onPhone } from './phone'

/** Where the copies go, as the person chose it. */
export interface CopyPlace {
  /** The folder, as Android names it (a tree the app may write in). */
  folder: string
  /** How the person would name it: «Tarjeta SD › Servos». */
  label: string
  locked: boolean
}

export interface CopiesState {
  place: CopyPlace | null
  /** When the last copy was written (ISO). */
  at: string | null
  /** Why the last copy could not be written: the card is not there, or something else. */
  failed: 'missing' | 'other' | null
}

interface Native {
  card(): Promise<{ present: boolean; label?: string }>
  choose(): Promise<{ folder?: string; label?: string }>
  ready(options: { folder: string }): Promise<{ ready: boolean }>
  write(options: { folder: string; name: string; prefix: string; text: string; keep: number }): Promise<void>
  erase(options: { folder: string; pattern: string }): Promise<{ erased: number }>
  forget(options: { folder: string }): Promise<void>
}

const STATE = 'servos.copias'
const PRINT = 'servos.copias.huella.'
const SUGGESTED = 'servos.copias.sugerida'
/** How many copies of each project stay. */
export const KEEP = 3
/** How often a change is looked for while the app is open. */
const EVERY = 3 * 60_000

/** The names of the copies the app writes, and nothing else: only these are ever deleted. */
export const COPY_NAME = /^copia-[0-9a-f]{6}-\d{8}-\d{4}\.(dat|servos)(\.parcial)?$/

// The plugin is handed back inside an object: it answers to any method name, `then` too (see phone.ts).
let plugin: Native | undefined
const native = async (): Promise<{ plugin: Native }> => {
  plugin ??= (await import('@capacitor/core')).registerPlugin<Native>('ServosCopies')
  return { plugin }
}

/** Whether copies can be kept here: in the app for phones. */
export const copiesHere = () => onPhone()

// ---- what is remembered ----

const empty: CopiesState = { place: null, at: null, failed: null }
const listeners = new Set<() => void>()

export function copiesState(): CopiesState {
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(STATE) ?? 'null') ?? {}) }
  } catch {
    return empty
  }
}

function setState(change: Partial<CopiesState>) {
  try {
    localStorage.setItem(STATE, JSON.stringify({ ...copiesState(), ...change }))
  } catch {
    /* kept for this visit */
  }
  listeners.forEach((fn) => fn())
}

/** Tells when the copies' state changes; gives back how to stop. */
export function onCopies(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Whether the suggestion on home was answered («Not now», or copies set up). */
export const suggestionAnswered = (): boolean => {
  try {
    return localStorage.getItem(SUGGESTED) !== null
  } catch {
    return true
  }
}
export function answerSuggestion() {
  try {
    localStorage.setItem(SUGGESTED, new Date().toISOString())
  } catch {
    /* asked again next time */
  }
  listeners.forEach((fn) => fn())
}

// The key, in the phone's own database: a key object that cannot be read out, only used.
const DB = 'servos-copias'
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore('llave')
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
async function keepKey(key: CopyKey | null) {
  const d = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction('llave', 'readwrite')
    if (key) tx.objectStore('llave').put(key, 'llave')
    else tx.objectStore('llave').delete('llave')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function keptKey(): Promise<CopyKey | null> {
  const d = await db()
  return new Promise((resolve) => {
    const get = d.transaction('llave').objectStore('llave').get('llave')
    get.onsuccess = () => resolve((get.result as CopyKey | undefined) ?? null)
    get.onerror = () => resolve(null)
  })
}

// ---- names ----

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha = async (text: string) => hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
const two = (n: number) => String(n).padStart(2, '0')

/**
 * A copy's name: `copia-`, six letters that tell the project apart without naming it, and when it was made (local
 * time), so the names sort by age; `.dat` when sealed, `.servos` when open.
 */
export async function copyName(projectId: string, at: Date, locked: boolean): Promise<{ name: string; prefix: string }> {
  const prefix = `copia-${(await sha(projectId)).slice(0, 6)}-`
  const stamp = `${at.getFullYear()}${two(at.getMonth() + 1)}${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}`
  return { name: `${prefix}${stamp}.${locked ? 'dat' : 'servos'}`, prefix }
}

/** What a project's copy would hold, without the moment it is made: the same work gives the same print. */
export async function printOf(project: Project, person: string, place: CopyPlace): Promise<string> {
  const file = shareProject(project, project.books.map((b) => b.code), person, new Date(0))
  return sha(`${place.folder}\n${place.locked}\n${JSON.stringify(file)}`)
}

// ---- what the person does ----

/** Whether a memory card or a USB stick is in the phone now. */
export async function cardInPhone(): Promise<boolean> {
  if (!copiesHere()) return false
  try {
    return (await (await native()).plugin.card()).present
  } catch {
    return false
  }
}

/**
 * Sets the copies up: the folder, asked to the person, and how they are kept. With a password, the key is drawn from
 * it and kept. Then the first copy is made at once. Gives back whether a folder was chosen.
 */
export async function setUpCopies(password: string | null, person: string): Promise<'done' | 'declined' | 'failed'> {
  try {
    const { plugin } = await native()
    const chosen = await plugin.choose()
    if (!chosen.folder) return 'declined'
    await keepKey(password === null ? null : await keyFrom(password))
    // Each project is copied afresh to the new place.
    setState({ place: { folder: chosen.folder, label: chosen.label ?? '', locked: password !== null }, at: null, failed: null })
    answerSuggestion()
    await copyNow(person)
    return 'done'
  } catch {
    return 'failed'
  }
}

let busy: Promise<void> | null = null

/** Copies each project that changed since its last copy (or all, `always`). */
export function copyNow(person: string, always = false): Promise<void> {
  busy ??= copyChanged(person, always).finally(() => {
    busy = null
  })
  return busy
}

async function copyChanged(person: string, always: boolean) {
  const { place } = copiesState()
  if (!place || !copiesHere()) return
  const key = place.locked ? await keptKey() : null
  if (place.locked && !key) return setState({ failed: 'other' })
  const { plugin } = await native()
  if (!(await plugin.ready({ folder: place.folder })).ready) return setState({ failed: 'missing' })
  let wrote = false
  for (const project of loadProjects()) {
    const print = await printOf(project, person, place)
    if (!always && localStorage.getItem(PRINT + project.id) === print) continue
    try {
      const file = await withSounds(shareProject(project, project.books.map((b) => b.code), person))
      const text = JSON.stringify(file)
      const { name, prefix } = await copyName(project.id, new Date(), place.locked)
      await plugin.write({ folder: place.folder, name, prefix, text: key ? await lock(text, key) : text, keep: KEEP })
      localStorage.setItem(PRINT + project.id, print)
      wrote = true
    } catch {
      return setState({ failed: (await plugin.ready({ folder: place.folder }).catch(() => ({ ready: false }))).ready ? 'other' : 'missing' })
    }
  }
  if (wrote) setState({ at: new Date().toISOString(), failed: null })
  else if (copiesState().failed) setState({ failed: null })
}

/** Deletes every copy the app wrote in the folder (only those: `COPY_NAME`). Gives back how many. */
export async function eraseCopies(): Promise<number | null> {
  const { place } = copiesState()
  if (!place) return 0
  try {
    const { erased } = await (await native()).plugin.erase({ folder: place.folder, pattern: COPY_NAME.source })
    forgetPrints()
    return erased
  } catch {
    return null
  }
}

/** Stops copying: the folder and the key are forgotten (the copies already made stay, unless erased first). */
export async function stopCopies() {
  const { place } = copiesState()
  if (place) await (await native()).plugin.forget({ folder: place.folder }).catch(() => {})
  await keepKey(null).catch(() => {})
  forgetPrints()
  setState({ place: null, at: null, failed: null })
}

function forgetPrints() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PRINT)) localStorage.removeItem(k)
  } catch {
    /* the next copy writes all */
  }
}

/**
 * Keeps copying while the app is open: a few minutes after a change, never while something is typed, and at once when
 * the app goes behind the others (it may not come back). `person` says who is working, or null before anyone is.
 */
export function keepCopying(person: () => string | null): () => void {
  if (!copiesHere()) return () => {}
  let waiting: (() => void) | null = null
  const tick = () => {
    const who = person()
    if (!who || waiting || !copiesState().place) return
    waiting = whenNotTyping(() => {
      waiting = null
      void copyNow(who)
    })
  }
  const leaving = () => {
    const who = person()
    if (document.visibilityState === 'hidden' && who && copiesState().place) void copyNow(who)
  }
  const timer = setInterval(tick, EVERY)
  document.addEventListener('visibilitychange', leaving)
  return () => {
    clearInterval(timer)
    waiting?.()
    document.removeEventListener('visibilitychange', leaving)
  }
}
