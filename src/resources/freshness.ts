/**
 * Which of two copies of a resource is newer: what a pack, a teammate's `.servos` or Door43 has, against what this
 * device has (design, section 7: a newer pack replaces the older one). Each copy is known by its stamp,
 * `{tag}#{published_at}` (`resourceContentStamp`), and by the books it has.
 */

/** How another copy of a resource stands against this device's. */
export type Standing =
  /** This device does not have the resource. */
  | 'new'
  | 'newer'
  | 'same'
  | 'older'
  /** Both say a version, and which is newer cannot be told: nothing is guessed. */
  | 'other'

/** A copy of a resource: its key, its stamp, and the books it has (none for resources kept by article). */
export interface ResourceCopy {
  key: string
  stamp: string
  books: readonly string[]
}

const NO_STAMP = 'nostamp'

/** A stamp's parts: the release tag and when it was published (`:` was written `_`, so it still sorts as a date). */
function partsOf(stamp: string): { tag: string; published: string } {
  const [first = '', second] = stamp.split('#')
  if (second !== undefined) return { tag: first, published: second }
  return /^\d{4}-\d{2}-\d{2}/.test(first) ? { tag: '', published: first } : { tag: first, published: '' }
}

/** The numbers of a tag, to compare `v87` with `v88` or `v9` with `v10`; null when it has none. */
const numbersOf = (tag: string): number[] | null => tag.match(/\d+/g)?.map(Number) ?? null

/**
 * Whether stamp `a` is newer (> 0), the same (0) or older (< 0) than `b`; null when it cannot be told. Released ones
 * are compared by when they were published, then by the numbers of their tags; a copy without a stamp is older than
 * one with it.
 */
export function compareStamps(a: string, b: string): number | null {
  if (a === b) return 0
  if (a === NO_STAMP) return -1
  if (b === NO_STAMP) return 1
  const pa = partsOf(a)
  const pb = partsOf(b)
  if (pa.published && pb.published && pa.published !== pb.published) return pa.published < pb.published ? -1 : 1
  const na = numbersOf(pa.tag)
  const nb = numbersOf(pb.tag)
  if (!na || !nb) return null
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const diff = (na[i] ?? 0) - (nb[i] ?? 0)
    if (diff) return diff
  }
  return pa.tag === pb.tag ? 0 : null
}

/** How another copy stands against this device's (`here`, absent when the device does not have it). */
export function standingOf(theirs: ResourceCopy, here: ResourceCopy | undefined): Standing {
  if (!here) return 'new'
  const order = compareStamps(theirs.stamp, here.stamp)
  if (order === null) return 'other'
  return order > 0 ? 'newer' : order < 0 ? 'older' : 'same'
}

/** A resource of a pack, against this device. */
export interface PackResourceStanding {
  key: string
  standing: Standing
  /**
   * Newer, but the device has books of it that the pack does not bring. A resource is of one release, so it is not
   * replaced: those books would keep a text of the old release under the new one's name, and their notes' quotes,
   * kept by book, would no longer be found.
   */
  lacking: string[]
  /** Books the pack brings of it that the device does not have: a pack of the same release fills them in. */
  adds: string[]
  /** Its copy here was made for an earlier version of the app and cannot be read: any copy of the pack is better. */
  stale: boolean
}

/** What a pack does to this device's resources: which it replaces, and which it leaves as they are. */
export interface PackAgainstDevice {
  resources: PackResourceStanding[]
  /** The resources the pack replaces (opened with `overwrite`). */
  replace: string[]
}

/**
 * Compares a pack's resources with this device's. `books` are the books a book pack brings (a language pack brings
 * every book its resources name). A resource is replaced when the pack's copy is newer and brings every book the
 * device has of it, or when the device's copy can no longer be read.
 */
export function packAgainstDevice(
  pack: { resources: readonly ResourceCopy[]; books?: readonly string[] },
  device: ReadonlyArray<ResourceCopy & { stale?: boolean }>
): PackAgainstDevice {
  const only = pack.books?.length ? new Set(pack.books.map((b) => b.toLowerCase())) : null
  const resources = pack.resources.map((theirs): PackResourceStanding => {
    const here = device.find((r) => r.key === theirs.key)
    const standing = standingOf(theirs, here)
    const brought = new Set(theirs.books.map((b) => b.toLowerCase()).filter((b) => !only || only.has(b)))
    // A resource kept by article (words, academy) names no books: it comes whole.
    const lacking = standing === 'newer' && theirs.books.length ? (here?.books ?? []).filter((b) => !brought.has(b.toLowerCase())) : []
    const have = new Set((here?.books ?? []).map((b) => b.toLowerCase()))
    const adds = [...brought].filter((b) => !have.has(b))
    return { key: theirs.key, standing, lacking, adds, stale: Boolean(here?.stale) }
  })
  return {
    resources,
    replace: resources.filter((r) => r.stale || (r.standing === 'newer' && !r.lacking.length)).map((r) => r.key),
  }
}

/** Whether opening the pack changes anything here: a resource replaced, a new one, or books of the same release added. */
export const bringsAnything = (against: PackAgainstDevice): boolean =>
  against.replace.length > 0 || against.resources.some((a) => a.standing === 'new' || (a.standing === 'same' && a.adds.length > 0))
