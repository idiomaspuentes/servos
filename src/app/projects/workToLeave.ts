/**
 * The work a person leaves on Door43 for a project, as it would go now (philosophy, principle 9). Every way it goes
 * takes it from here: by hand from «Trabajo del equipo», as an errand that waited for internet (`outbox.ts`), and as
 * the copy made by itself (`frame/door43Copy.ts`). For a project kept to its team it is sealed with the team's key,
 * as on the memory card; while that key is not on this phone there is nothing to leave: it is never sent open.
 */

import { lock } from './lockedCopy'
import { privacyOf, type Project } from './model'
import { shareProject, withSounds } from './share'
import { teamKey } from './teamKeys'

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha = async (text: string) => hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

/**
 * The work to leave, with every take's sound, and a print of it that is the same while the work is the same; null for
 * a project kept to its team while the team's key is not on this phone.
 */
export async function workToLeave(project: Project, person: string): Promise<{ text: string; print: string } | null> {
  const team = privacyOf(project) === 'equipo'
  const key = team ? await teamKey(project.id) : null
  if (team && !key) return null
  const books = project.books.map((b) => b.code)
  const print = await sha(`${key ? [...key.salt].join(',') : 'abierta'}\n${JSON.stringify(shareProject(project, books, person, new Date(0)))}`)
  const text = JSON.stringify(await withSounds(shareProject(project, books, person)))
  return { text: key ? await lock(text, key, 'compartido') : text, print }
}

/** Whether a project's work waits for the team's password to be known on this phone before it can be left. */
export async function waitsForTeamPassword(project: Project): Promise<boolean> {
  return privacyOf(project) === 'equipo' && !(await teamKey(project.id))
}
