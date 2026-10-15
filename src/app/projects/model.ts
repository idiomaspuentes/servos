/**
 * Projects, the way translationCore 4 makes them (`src/views/modals/AddProject.jsx`, `NewBible.jsx`): a project is
 * a Bible (or a set of Bible stories) in one language; books are added to it one by one; each book goes through the
 * steps, and each step has the mini apps the project chose.
 *
 * In the prototype projects live in this browser (localStorage). Wired, a project is a Resource Container on the
 * device (`manifest.yaml` and the books), like usfm-editor's, with Servos's journal beside each book.
 */

export type Phase = 'estudio' | 'traduccion' | 'revision' | 'comunitaria' | 'publicacion'
export const PHASES: Phase[] = ['estudio', 'traduccion', 'revision', 'comunitaria', 'publicacion']

export interface BookEntry {
  /** USFM code, lowercase. */
  code: string
  /** The step the book is in. */
  phase: Phase
}

export interface Project {
  id: string
  kind: 'bible' | 'obs'
  name: string
  languageName: string
  languageCode: string
  direction: 'ltr' | 'rtl'
  /** The language of the bridge texts and helps the project reads (a language pack on the device). */
  helpsLanguage: string
  font: string
  versification: string
  books: BookEntry[]
  /** For each step, the ids of the mini apps the project uses, in order. Chosen by whoever coordinates. */
  miniApps: Record<Phase, string[]>
}

export const DEFAULT_MINI_APPS: Record<Phase, string[]> = {
  estudio: ['estudio'],
  traduccion: ['editor'],
  revision: ['revisorNotas', 'revisorPalabras', 'alineador'],
  comunitaria: ['comunitaria'],
  publicacion: ['publicar'],
}

/** Book codes in Bible order, with their Spanish names (wired, names come from the bridge text's own headers). */
export const BOOKS: Array<[string, string]> = [
  ['gen', 'Génesis'], ['exo', 'Éxodo'], ['lev', 'Levítico'], ['num', 'Números'], ['deu', 'Deuteronomio'],
  ['jos', 'Josué'], ['jdg', 'Jueces'], ['rut', 'Rut'], ['1sa', '1 Samuel'], ['2sa', '2 Samuel'], ['1ki', '1 Reyes'],
  ['2ki', '2 Reyes'], ['1ch', '1 Crónicas'], ['2ch', '2 Crónicas'], ['ezr', 'Esdras'], ['neh', 'Nehemías'],
  ['est', 'Ester'], ['job', 'Job'], ['psa', 'Salmos'], ['pro', 'Proverbios'], ['ecc', 'Eclesiastés'],
  ['sng', 'Cantares'], ['isa', 'Isaías'], ['jer', 'Jeremías'], ['lam', 'Lamentaciones'], ['ezk', 'Ezequiel'],
  ['dan', 'Daniel'], ['hos', 'Oseas'], ['jol', 'Joel'], ['amo', 'Amós'], ['oba', 'Abdías'], ['jon', 'Jonás'],
  ['mic', 'Miqueas'], ['nam', 'Nahúm'], ['hab', 'Habacuc'], ['zep', 'Sofonías'], ['hag', 'Hageo'],
  ['zec', 'Zacarías'], ['mal', 'Malaquías'], ['mat', 'Mateo'], ['mrk', 'Marcos'], ['luk', 'Lucas'], ['jhn', 'Juan'],
  ['act', 'Hechos'], ['rom', 'Romanos'], ['1co', '1 Corintios'], ['2co', '2 Corintios'], ['gal', 'Gálatas'],
  ['eph', 'Efesios'], ['php', 'Filipenses'], ['col', 'Colosenses'], ['1th', '1 Tesalonicenses'],
  ['2th', '2 Tesalonicenses'], ['1ti', '1 Timoteo'], ['2ti', '2 Timoteo'], ['tit', 'Tito'], ['phm', 'Filemón'],
  ['heb', 'Hebreos'], ['jas', 'Santiago'], ['1pe', '1 Pedro'], ['2pe', '2 Pedro'], ['1jn', '1 Juan'],
  ['2jn', '2 Juan'], ['3jn', '3 Juan'], ['jud', 'Judas'], ['rev', 'Apocalipsis'],
]

export const bookName = (code: string) => BOOKS.find(([c]) => c === code)?.[1] ?? code.toUpperCase()

const STORAGE_KEY = 'servos.prototipo.proyectos'

/** What the prototype starts with: a Bible with Jonah and Titus under way and Ruth just added. */
const SEED: Project[] = [
  {
    id: 'biblia-kichwa',
    kind: 'bible',
    name: 'Biblia en kichwa',
    languageName: 'Kichwa',
    languageCode: 'qu',
    direction: 'ltr',
    helpsLanguage: 'es-419',
    font: 'Charis SIL',
    versification: 'eng',
    books: [
      { code: 'jon', phase: 'traduccion' },
      { code: 'tit', phase: 'traduccion' },
      { code: 'rut', phase: 'estudio' },
    ],
    miniApps: DEFAULT_MINI_APPS,
  },
]

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return withNewSeedBooks(JSON.parse(raw) as Project[])
  } catch {
    /* blocked storage: start from the example */
  }
  return SEED
}

/**
 * A browser that kept the example from an earlier version gets the books added to it since (Jonah, for its poem), and
 * the mini apps (aligning). Only the example: what a coordinator chose for a project of their own is theirs.
 */
function withNewSeedBooks(projects: Project[]): Project[] {
  return projects.map((p) => {
    const seed = SEED.find((s) => s.id === p.id)
    if (!seed) return p
    const missing = seed.books.filter((b) => !p.books.some((x) => x.code === b.code))
    const apps = Object.fromEntries(
      Object.entries(seed.miniApps).map(([phase, ids]) => {
        const kept = p.miniApps?.[phase as Phase] ?? []
        return [phase, [...kept, ...ids.filter((id) => !kept.includes(id))]]
      })
    ) as Project['miniApps']
    return { ...p, books: missing.length ? [...missing, ...p.books] : p.books, miniApps: apps }
  })
}

export function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch {
    /* the change stays until the page closes */
  }
}

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'proyecto'
  )
}
