/**
 * Who uses this phone: the names of the people who work on it, and who is working now. Each change carries the name
 * of whoever made it (philosophy, principle 8), so the name chosen must survive closing the app; on a shared phone,
 * anyone can add their own.
 */

const KEY = 'servos.prototipo.personas'

/** The people of the example the prototype comes with. */
export const EXAMPLE_PEOPLE = ['Ana', 'Bea', 'Carlos']

export interface People {
  names: string[]
  current: string
}

/** Who uses this phone, or null the first time it is opened. */
export function loadPeople(): People | null {
  try {
    const raw = localStorage.getItem(KEY)
    const people = raw ? (JSON.parse(raw) as People) : null
    return people?.names?.length && people.current ? people : null
  } catch {
    return null
  }
}

export function savePeople(people: People) {
  try {
    localStorage.setItem(KEY, JSON.stringify(people))
  } catch {
    /* kept for this visit */
  }
}

/** A name added, once (the same name with other capitals is the same person), and made the one working. */
export function addPerson(people: People | null, name: string): People {
  const clean = name.trim().replace(/\s+/g, ' ')
  const names = people?.names ?? []
  const same = names.find((n) => n.toLocaleLowerCase() === clean.toLocaleLowerCase())
  return { names: same ? names : [...names, clean], current: same ?? clean }
}
