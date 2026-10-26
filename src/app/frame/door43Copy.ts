/**
 * A copy of each person's work on Door43, made by itself when there is internet (philosophy, principle 9): if the phone
 * is lost or broken, the work is on Door43 too, and the team can bring it in from «Trabajo del equipo». It is the work
 * the person would leave there by hand (`leaveWork`): one package by person and phone, on the shelf of the project's
 * private repository beside the one it publishes (`{repo}-servos`), replaced each time, so it does not pile up.
 *
 * It is made a few minutes after the work changed, never while a sentence is being typed, and when the app goes behind
 * the others; only with Wi-Fi unless the person said mobile data too; only for a project whose place on Door43 was
 * chosen, by a person who linked an account. Each project chooses: it is on from the start for a project open to
 * whoever has the file, off for one kept to its team. Switched on for one kept to its team, the copy goes sealed with
 * the team's password, as on the memory card (`copies.ts`), and waits while that password is not known here: it is
 * never sent open. The app does not promise a safe network: whoever watches the network can tell that this phone
 * reaches Door43, not what it sends (and in the app for phones, Door43's certificate is checked against the ones the
 * app carries: `door43Pins.ts`).
 *
 * Home says nothing while it works. Only after some days of failing does it say what to do.
 */

import { accountOf, destinationOf, leaveWork, problemOf, type Problem } from '../projects/door43'
import { lock } from '../projects/lockedCopy'
import { loadProjects, privacyOf, type Project } from '../projects/model'
import { shareProject, withSounds } from '../projects/share'
import { teamKey } from '../projects/teamKeys'
import { deviceId } from '../projects/work'
import { onDesktop } from './desktop'
import { isOnline, whenNotTyping } from './online'
import { networkNow } from './door43Pins'

/** Why the last copy could not be made: Door43's problem, or the network not shown to be Door43 (`pin`). */
export type CopyProblem = Problem

export interface Door43CopyState {
  /** Each project switched on or off by the person; one not here follows its default (`copyOnByDefault`). */
  projects: Record<string, boolean>
  /** Mobile data too, not only Wi-Fi. */
  data: boolean
  /** When the last copy went (ISO). */
  at: string | null
  /** When the last try was, and what went wrong in it, if anything. */
  tried: string | null
  problem: CopyProblem | null
  /** Since when every try has failed (ISO): Home speaks only after some days of it. */
  failingSince: string | null
}

const KEY = 'servos.door43copia.'
const PRINT = 'servos.door43copia.huella.'
/** How often a change is looked for while the app is open. */
const EVERY = 3 * 60_000
/** How long failing goes unsaid on Home. */
export const QUIET_DAYS = 3

const empty: Door43CopyState = { projects: {}, data: false, at: null, tried: null, problem: null, failingSince: null }
const listeners = new Set<() => void>()

export function door43CopyState(person: string): Door43CopyState {
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(KEY + person) ?? 'null') ?? {}) }
  } catch {
    return empty
  }
}
function setState(person: string, change: Partial<Door43CopyState>) {
  try {
    localStorage.setItem(KEY + person, JSON.stringify({ ...door43CopyState(person), ...change }))
  } catch {
    /* kept for this visit */
  }
  listeners.forEach((fn) => fn())
}
export function onDoor43Copy(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** On from the start for a project open to whoever has the file; off for one kept to its team. */
export const copyOnByDefault = (project: Pick<Project, 'privacy'>) => privacyOf(project) !== 'equipo'
export const copyOn = (person: string, project: Pick<Project, 'id' | 'privacy'>) => door43CopyState(person).projects[project.id] ?? copyOnByDefault(project)

/** Switches a project's copy on or off: the person's choice, kept. Switched on, the first copy goes when it can. */
export function setCopyOn(person: string, projectId: string, on: boolean) {
  setState(person, { projects: { ...door43CopyState(person).projects, [projectId]: on } })
  if (on) void copyToDoor43Now(person)
}
export const setCopyData = (person: string, data: boolean) => setState(person, { data })

/** Mobile data is not for the copy unless the person said so: the Wi-Fi a phone has, a computer always. */
export async function networkAllows(person: string): Promise<boolean> {
  if (door43CopyState(person).data || onDesktop()) return true
  return (await networkNow()) !== 'datos'
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha = async (text: string) => hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

/**
 * The work a person leaves on Door43 for a project, as it would go now: sealed with the team's key for a project kept
 * to its team (null while that key is not on this phone: it is never sent open), and a print of it that is the same
 * while the work is the same.
 */
export async function workToLeave(project: Project, person: string): Promise<{ text: string; print: string } | null> {
  const team = privacyOf(project) === 'equipo'
  const key = team ? await teamKey(project.id) : null
  if (team && !key) return null
  const print = await sha(`${key ? [...key.salt].join(',') : 'abierta'}\n${JSON.stringify(shareProject(project, project.books.map((b) => b.code), person, new Date(0)))}`)
  const text = JSON.stringify(await withSounds(shareProject(project, project.books.map((b) => b.code), person)))
  return { text: key ? await lock(text, key, 'compartido') : text, print }
}

/** What a project's copy waits for, to say it: the place on Door43 chosen, or the team's password on this phone. */
export async function copyWaitsFor(project: Project): Promise<'lugar' | 'contrasena' | null> {
  if (!destinationOf(project.id)) return 'lugar'
  if (privacyOf(project) === 'equipo' && !(await teamKey(project.id))) return 'contrasena'
  return null
}

let busy: Promise<void> | null = null

/** Copies each project switched on that changed since its last copy (or all, `always`), when it can go now. */
export function copyToDoor43Now(person: string, always = false): Promise<void> {
  busy ??= copyChanged(person, always).finally(() => {
    busy = null
  })
  return busy
}

async function copyChanged(person: string, always: boolean) {
  const account = accountOf(person)
  if (!account || !isOnline() || !(await networkAllows(person))) return
  let wrote = false
  let failed: CopyProblem | null = null
  for (const project of loadProjects()) {
    const to = destinationOf(project.id)
    if (!to || !copyOn(person, project)) continue
    try {
      const work = await workToLeave(project, person)
      if (!work) continue
      const printKey = `${PRINT}${person}.${project.id}`
      if (!always && localStorage.getItem(printKey) === work.print) continue
      const done = await leaveWork(account, to, work.text, person, deviceId(), privacyOf(project))
      if (done.state === 'failed') {
        failed = done.problem ?? 'other'
        continue
      }
      localStorage.setItem(printKey, work.print)
      wrote = true
    } catch (e) {
      failed = problemOf(e)
    }
  }
  const now = new Date().toISOString()
  if (failed) {
    // Not reaching Door43 while the phone says it is online (a network with no way out) is a failure too.
    setState(person, { tried: now, problem: failed, failingSince: door43CopyState(person).failingSince ?? now })
  } else if (wrote || door43CopyState(person).problem) {
    setState(person, { tried: now, problem: null, failingSince: null, ...(wrote ? { at: now } : {}) })
  }
}

/** Whether Home should say the copy keeps failing: only after some days of it. */
export function failingLong(state: Door43CopyState, now = new Date()): boolean {
  return Boolean(state.failingSince && now.getTime() - new Date(state.failingSince).getTime() >= QUIET_DAYS * 86_400_000)
}

/** Forgets what was copied: the next copy sends all again (an account linked again, another place). */
export function forgetDoor43Prints(person: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`${PRINT}${person}.`)) localStorage.removeItem(k)
  } catch {
    /* the next copy sends all */
  }
  setState(person, { problem: null, failingSince: null })
}

/**
 * Keeps copying to Door43 while the app is open: a few minutes after a change, never while something is typed, when
 * internet comes back, and at once when the app goes behind the others (it may not come back).
 */
export function keepCopyingToDoor43(person: () => string | null): () => void {
  let waiting: (() => void) | null = null
  const tick = () => {
    const who = person()
    if (!who || waiting || !accountOf(who)) return
    waiting = whenNotTyping(() => {
      waiting = null
      void copyToDoor43Now(who)
    })
  }
  const leaving = () => {
    const who = person()
    if (document.visibilityState === 'hidden' && who && accountOf(who)) void copyToDoor43Now(who)
  }
  const timer = setInterval(tick, EVERY)
  document.addEventListener('visibilitychange', leaving)
  window.addEventListener('online', tick)
  return () => {
    clearInterval(timer)
    waiting?.()
    document.removeEventListener('visibilitychange', leaving)
    window.removeEventListener('online', tick)
  }
}
