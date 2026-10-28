/**
 * Opening a pack and applying downloaded parts never overlap. Both write the resources and the parts register: an
 * apply landing while a pack is opened could leave a slot claiming rows the pack wrote over, should the app close
 * before `openPack`'s second pass (spec §3). Downloading into staging touches neither, so it goes on beside an opening.
 *
 * - A pack opening (`whileOnlineIdle`) waits for an apply in flight and holds new applies back until it ends.
 * - An apply (`asOnlineApply`) waits for an opening in flight, then plans again from the register as it is (a pack
 *   may have been opened while its parts came) and applies that plan.
 *
 * A section that opens a pack and does more around it (ReceivePack reads what the translated verses read before, and
 * compares after) holds the lock for all of it, and hands `openPack` its `HeldLock` so the opening does not wait for
 * itself.
 *
 * Kept apart from `onlineResources.ts` so `packs.ts` can use it without importing the online flow, which imports the
 * library, which imports `packs.ts`.
 *
 * No deadlock: an apply, once let in, never waits for an opening, and an opening never starts an apply. Nothing that
 * runs inside either may wait for the other (an apply never opens a pack; an opening never waits for Servos online).
 */

/** Proof that a section holds the lock: given to `fn` by `whileOnlineIdle`, good only while that section lasts. */
export type HeldLock = { readonly section: object }

/** The opening (or section) in flight; `done` ends when it ends. */
let opening: { done: Promise<void>; held: HeldLock } | null = null
/** The applies let in (one, but for one stopped and still ending); each ends when it ends. */
const applying = new Set<Promise<void>>()

function hold(): { done: Promise<void>; end: () => void } {
  let end!: () => void
  const done = new Promise<void>((resolve) => (end = resolve))
  return { done, end }
}

/**
 * Runs `fn` with no apply beside it: waits for an opening in flight (openings go one after another), then for the
 * applies already let in, and keeps new applies waiting until `fn` ends, whether it ends well or throws.
 */
export async function whileOnlineIdle<T>(fn: (held: HeldLock) => Promise<T>): Promise<T> {
  while (opening) await opening.done
  const me = hold()
  const held: HeldLock = { section: {} }
  opening = { done: me.done, held }
  try {
    while (applying.size) await Promise.all(applying)
    return await fn(held)
  } finally {
    if (opening?.held === held) opening = null
    me.end()
  }
}

/** Whether `held` is the section holding the lock now (a token kept after its section ended is not). */
export const holdsOnlineLock = (held: HeldLock | undefined): boolean => !!held && opening?.held === held

/** An apply of downloaded parts: let in once no pack is being opened, and holding openings back until it ends. */
export async function asOnlineApply<T>(body: () => Promise<T>): Promise<T> {
  // Checked and taken in one step after each wait: an opening that came meanwhile is waited for too.
  while (opening) await opening.done
  const me = hold()
  applying.add(me.done)
  try {
    return await body()
  } finally {
    applying.delete(me.done)
    me.end()
  }
}
