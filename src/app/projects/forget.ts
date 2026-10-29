/**
 * A project deleted for good, from the archive, after the person said yes twice (archiving it, then deleting it): all
 * of it goes from this device. Its books and their journals, its recordings and their sounds, its glossary, each
 * person's place and checks in its books, where it goes on Door43 and what was uploaded, what waited for internet, its
 * team password, the memory card's fingerprint of it. What is outside the device stays: the copy already on the memory
 * card and what was uploaded to Door43 (decided with Abel on 28 October 2026), and the confirmation says so.
 *
 * The project itself is taken out of the list by whoever keeps it (`App`); this forgets what is kept under its id.
 */

import { forgetBooksOf } from './bookText'
import { dropProject } from './outbox'
import { forgetSounds, takeIdsWhere } from './recordings'
import { forgetTeamKeys } from './teamKeys'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The keys of this device that belong to a project, of those given: every key of a book as the project keeps it
 * (`…jon~project…`, `scope.ts`), and those kept by the project's id.
 */
export function keysOfProject(id: string, keys: string[]): string[] {
  const book = new RegExp(`~${escape(id)}(\\.|$)`)
  const byId = [
    `servos.prototipo.glosario.${id}.`,
    `servos.prototipo.door43.subido.${id}.`,
    `servos.prototipo.door43.visto.${id}.`,
    `servos.prototipo.sugerencia.nombre.${id}.`,
  ]
  const exact = [
    `servos.prototipo.glosario.${id}`,
    `servos.prototipo.glosarioCompartido.${id}`,
    `servos.prototipo.door43.destino.${id}`,
    `servos.copias.huella.${id}`,
    `servos.prototipo.recientes.${id}`,
  ]
  return keys.filter((k) => k.startsWith('servos.') && (book.test(k) || exact.includes(k) || byId.some((p) => k.startsWith(p))))
}

/** Forgets from this device everything kept for a project. */
export async function forgetProject(id: string): Promise<void> {
  const mine = (book: string) => book.endsWith(`~${id}`)
  // A sound another project also names (a take received into both) stays.
  const sounds = takeIdsWhere(mine)
  for (const other of takeIdsWhere((book) => !mine(book))) sounds.delete(other)
  forgetBooksOf(id)
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '')
    for (const k of keysOfProject(id, keys)) localStorage.removeItem(k)
  } catch {
    /* nothing kept here to forget */
  }
  dropProject(id)
  await Promise.all([forgetSounds(sounds).catch(() => {}), forgetTeamKeys(id).catch(() => {})])
}
