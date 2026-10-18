/**
 * The project the app is in. Two projects of a phone may translate the same book (Jonah into Kichwa and into Cusco
 * Quechua): each keeps its own work of it, its text, alignment, checks, notes and recordings. What keeps that work
 * asks here which project it is, so a book's code is enough to call it by: `scoped('jon')` is `jon~biblia-kichwa`.
 *
 * The app says the project when it shows one of its screens (`setProject`); what works across projects says it for
 * each (`inProject`): home's progress of every book, sharing a project, receiving into one, adding a book. Outside any
 * project the code is alone, and finds nothing kept: a place that forgets to say the project shows empty, it never
 * shows another project's work.
 */

let current: string | null = null

export const setProject = (id: string | null) => {
  current = id
}

/** The project the app is in, or null outside any. */
export const currentProject = (): string | null => current

/** Runs something in a project, and comes back to the one the app was in. */
export function inProject<T>(id: string, run: () => T): T {
  const was = current
  current = id
  try {
    return run()
  } finally {
    current = was
  }
}

/** A book of the project the app is in, as its work is kept. */
export const scoped = (code: string): string => (current ? `${code}~${current}` : code)

/**
 * Where work was kept by the book alone (before each project kept its own): the families of keys, and where the
 * book's code stands in them (`servos.prototipo.alineacion.jon.…` has it fourth; a person's place, fifth).
 */
const FAMILIES: Array<{ prefix: string; at: number }> = [
  { prefix: 'servos.prototipo.alineacion.fuente.', at: 4 },
  { prefix: 'servos.prototipo.alineacion.', at: 3 },
  { prefix: 'servos.prototipo.revisionNota.', at: 3 },
  { prefix: 'servos.prototipo.revisionPalabra.', at: 3 },
  { prefix: 'servos.prototipo.pasaje.', at: 3 },
  { prefix: 'servos.prototipo.observacion.', at: 3 },
  { prefix: 'servos.prototipo.grabacion.', at: 3 },
  { prefix: 'servos.prototipo.comprension.', at: 3 },
  { prefix: 'servos.prototipo.posicion.', at: 4 },
  { prefix: 'servos.prototipo.ultimaApp.', at: 4 },
]

/**
 * Work kept by the book alone goes to each project that has the book (each starts with what it showed until now),
 * once; the shared copy is then forgotten, so a project that adds the book later does not take another's work.
 */
export function moveWorkToProjects(projects: Array<{ id: string; books: Array<{ code: string }> }>) {
  let keys: string[] = []
  try {
    keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(Boolean)
  } catch {
    return
  }
  for (const key of keys) {
    const family = FAMILIES.find((f) => key.startsWith(f.prefix))
    if (!family || (family.prefix === 'servos.prototipo.alineacion.' && key.startsWith('servos.prototipo.alineacion.fuente.'))) continue
    const parts = key.split('.')
    const code = parts[family.at]
    if (!code || code.includes('~')) continue
    try {
      const value = localStorage.getItem(key)
      for (const p of projects.filter((x) => x.books.some((b) => b.code === code))) {
        const moved = [...parts.slice(0, family.at), `${code}~${p.id}`, ...parts.slice(family.at + 1)].join('.')
        if (value !== null && localStorage.getItem(moved) === null) localStorage.setItem(moved, value)
      }
      localStorage.removeItem(key)
    } catch {
      /* what did not fit stays where it was */
    }
  }
}
