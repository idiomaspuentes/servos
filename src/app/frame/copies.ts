/**
 * A copy of the work outside the phone (design, section 11; philosophy, principle 9): if the phone is lost or broken,
 * the work is on the memory card (or a USB stick), and «Receive» brings it all back on another phone or a computer.
 * The person chooses the folder once; from then on each project is copied a few minutes after it changed, never while
 * a sentence is being typed, and when the app goes behind the others. The three latest copies of each stay.
 *
 * Each project is copied as it chose who can see its work (`Privacy`; philosophy, principle 9). One kept to its team
 * is sealed with the team's password, the same that seals what it shares and opens what it receives
 * (`projects/teamKeys.ts`), and named so it says nothing (`copia-3fa9c1-….dat`): on another phone, «Receive» asks for
 * that password, or opens it by itself where the team's key is kept. One open to whoever has the file is the file
 * «Share» makes. A project kept to its team whose password was never chosen or typed on this phone waits, and is named,
 * until it is: it is never copied open.
 *
 * Only in the app for phones (`android/…/CopiesPlugin.java`); elsewhere none of it runs.
 */

import { loadProjects, privacyOf, type Project } from '../projects/model'
import { lock } from '../projects/lockedCopy'
import { teamKey } from '../projects/teamKeys'
import { shareProject, withSounds } from '../projects/share'
import { whenNotTyping } from './online'
import { onPhone } from './phone'

/** Where the copies go, as the person chose it. */
export interface CopyPlace {
  /** The folder, as Android names it (a tree the app may write in). */
  folder: string
  /** How the person would name it: «Tarjeta SD › Servos». */
  label: string
}

export interface CopiesState {
  place: CopyPlace | null
  /** When the last copy was written (ISO). */
  at: string | null
  /** Why the last copy could not be written: the card is not there, or something else. */
  failed: 'missing' | 'other' | null
  /** The projects kept to their team that wait for the team's password on this phone to be copied. */
  waiting?: Array<{ id: string; name: string }>
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

/**
 * What a project's copy would hold, without the moment it is made: the same work, kept the same way, gives the same
 * print (a key that changes, a password chosen again, makes a new copy).
 */
export async function printOf(project: Project, person: string, place: CopyPlace, salt: Uint8Array | null): Promise<string> {
  const file = shareProject(project, project.books.map((b) => b.code), person, new Date(0))
  return sha(`${place.folder}\n${salt ? [...salt].join(',') : 'abierta'}\n${JSON.stringify(file)}`)
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

/** Sets the copies up: the folder, asked to the person; then the first copy is made at once. */
export async function setUpCopies(person: string): Promise<'done' | 'declined' | 'failed'> {
  try {
    const { plugin } = await native()
    const chosen = await plugin.choose()
    if (!chosen.folder) return 'declined'
    // Each project is copied afresh to the new place.
    setState({ place: { folder: chosen.folder, label: chosen.label ?? '' }, at: null, failed: null })
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
  const { plugin } = await native()
  if (!(await plugin.ready({ folder: place.folder })).ready) return setState({ failed: 'missing' })
  let wrote = false
  const waiting: Array<{ id: string; name: string }> = []
  for (const project of loadProjects()) {
    // Kept to its team: sealed with the team's key, or not copied at all until the password is known here.
    const team = privacyOf(project) === 'equipo'
    const key = team ? await teamKey(project.id) : null
    if (team && !key) {
      waiting.push({ id: project.id, name: project.name })
      continue
    }
    const print = await printOf(project, person, place, key?.salt ?? null)
    if (!always && localStorage.getItem(PRINT + project.id) === print) continue
    try {
      const file = await withSounds(shareProject(project, project.books.map((b) => b.code), person))
      const text = JSON.stringify(file)
      const { name, prefix } = await copyName(project.id, new Date(), key !== null)
      await plugin.write({ folder: place.folder, name, prefix, text: key ? await lock(text, key, 'compartido') : text, keep: KEEP })
      localStorage.setItem(PRINT + project.id, print)
      wrote = true
    } catch {
      return setState({ failed: (await plugin.ready({ folder: place.folder }).catch(() => ({ ready: false }))).ready ? 'other' : 'missing' })
    }
  }
  if (JSON.stringify(waiting) !== JSON.stringify(copiesState().waiting ?? [])) setState({ waiting })
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

/** Stops copying: the folder is forgotten (the copies already made stay, unless erased first). */
export async function stopCopies() {
  const { place } = copiesState()
  if (place) await (await native()).plugin.forget({ folder: place.folder }).catch(() => {})
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
