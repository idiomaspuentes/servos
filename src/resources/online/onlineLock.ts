/**
 * Opening a pack and a Servos online run never overlap. Both write the resources and the parts register: an apply
 * landing while a pack is opened could leave a slot claiming rows the pack wrote over, should the app close before
 * `openPack`'s second pass (spec §3). So a pack opening (`whileOnlineIdle`) waits for the run in flight and holds new
 * runs back until it ends, and a run (`asOnlineRun`) waits for an opening in flight.
 *
 * Kept apart from `onlineResources.ts` so `packs.ts` can use it without importing the online flow, which imports the
 * library, which imports `packs.ts`.
 *
 * No deadlock: a run, once let in, never waits for an opening again, and an opening never starts a run. Nothing that
 * runs inside either may call the other (an online run never opens a pack; `openPack` never checks online).
 */

/** The pack opening in flight; ends when it ends. */
let opening: Promise<void> | null = null
/** The online runs let in (one, but for a run stopped and still ending); each ends when its body ends. */
const running = new Set<Promise<void>>()

function hold(): { done: Promise<void>; end: () => void } {
  let end!: () => void
  const done = new Promise<void>((resolve) => (end = resolve))
  return { done, end }
}

/**
 * Runs `fn` with no online run beside it: waits for an opening in flight (openings go one after another), then for
 * the online run in flight, and keeps new runs waiting until `fn` ends, whether it ends well or throws.
 */
export async function whileOnlineIdle<T>(fn: () => Promise<T>): Promise<T> {
  while (opening) await opening
  const me = hold()
  opening = me.done
  try {
    while (running.size) await Promise.all(running)
    return await fn()
  } finally {
    if (opening === me.done) opening = null
    me.end()
  }
}

/** An online run's body: let in once no pack is being opened, and holding openings back until it ends. */
export async function asOnlineRun<T>(body: () => Promise<T>): Promise<T> {
  // Checked and taken in one step after each wait: an opening that came meanwhile is waited for too.
  while (opening) await opening
  const me = hold()
  running.add(me.done)
  try {
    return await body()
  } finally {
    running.delete(me.done)
    me.end()
  }
}
