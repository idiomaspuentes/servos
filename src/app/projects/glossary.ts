/**
 * The project's glossary: how the team translates a word of the original, so every translator writes it the same way.
 * An entry hangs from the original word (its lemma and Strong number), not from a word of a bridge text, so a word
 * touched in the TPL, the TPS or the original finds the same entry.
 *
 * Its rows are Taller's (`src/domain/glossary.ts` there, `docs/GLOSARIO_DOOR43.md`): the same TSV columns, the same
 * three files by the original's language, kept in the language's `<lang>_tg` repository on Door43. A glossary shared
 * as a file between computers, published to Door43, or made in Taller is one format. Servos adds one column, `By`
 * (who wrote the entry last), which Taller reads past.
 *
 * In the prototype the glossary lives in this browser, by project.
 */

export type GlossaryScope = 'tpl' | 'tps' | 'helps' | 'all'
export type GlossaryStatus = 'proposed' | 'agreed'

export interface GlossaryEntry {
  id: string
  /** Word(s) of the original; several, joined by ` + `, for an expression. */
  lemma: string
  /** Strong number(s), `;` between the words of an expression. */
  strong: string
  english: string[]
  sense: string
  /** How the team translates it. */
  rendering: string
  /** Other ways it may be translated. */
  alternatives: string[]
  /** Ways the team chose not to translate it. */
  avoid: string[]
  scope: GlossaryScope
  variants: string[]
  twLink: string
  examples: string[]
  status: GlossaryStatus
  note: string
  /** Who wrote the entry last. */
  by: string
}

export const GLOSSARY_COLUMNS = [
  'ID',
  'Lemma',
  'Strong',
  'English',
  'Sense',
  'Rendering',
  'Alternatives',
  'Avoid',
  'Scope',
  'Variants',
  'TWLink',
  'Examples',
  'Status',
  'Note',
  'By',
] as const

/** The three files of the resource, by the language of the original. */
export type GlossaryFile = 'tg_grc.tsv' | 'tg_hbo.tsv' | 'tg_en.tsv'

/** The Strong number of the word itself: a Hebrew prefix (`c:H6419`, `b:d:H1234`) is left out. */
export const baseStrong = (strong: string) => (strong.split(':').pop() ?? '').trim()

/** `G…` → Greek, `H…` → Hebrew and Aramaic, nothing → English only. */
export function glossaryFileFor(strong: string): GlossaryFile {
  const first = baseStrong(strong.split(';')[0] ?? '')
  if (/^G/i.test(first)) return 'tg_grc.tsv'
  if (/^H/i.test(first)) return 'tg_hbo.tsv'
  return 'tg_en.tsv'
}

const list = (cell: string | undefined) =>
  (cell ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
const clean = (cell: string) => cell.replace(/[\t\r\n]+/g, ' ').trim()

export function parseGlossary(tsv: string): GlossaryEntry[] {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const header = lines[0].split('\t').map((cell) => cell.trim().toLowerCase())
  const out: GlossaryEntry[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    const cell = (name: (typeof GLOSSARY_COLUMNS)[number]) => {
      const at = header.indexOf(name.toLowerCase())
      return at >= 0 ? (cells[at] ?? '').trim() : ''
    }
    if (!cell('ID') || !cell('Lemma')) continue
    const scope = cell('Scope').toLowerCase()
    out.push({
      id: cell('ID'),
      lemma: cell('Lemma'),
      strong: cell('Strong'),
      english: list(cell('English')),
      sense: cell('Sense'),
      rendering: cell('Rendering'),
      alternatives: list(cell('Alternatives')),
      avoid: list(cell('Avoid')),
      scope: scope === 'tpl' || scope === 'tps' || scope === 'helps' ? scope : 'all',
      variants: list(cell('Variants')),
      twLink: cell('TWLink'),
      examples: list(cell('Examples')),
      status: cell('Status').toLowerCase() === 'agreed' ? 'agreed' : 'proposed',
      note: cell('Note'),
      by: cell('By'),
    })
  }
  return out
}

export function serializeGlossary(entries: GlossaryEntry[]): string {
  const row = (e: GlossaryEntry) =>
    [
      e.id,
      e.lemma,
      e.strong,
      e.english.join('; '),
      e.sense,
      e.rendering,
      e.alternatives.join('; '),
      e.avoid.join('; '),
      e.scope,
      e.variants.join('; '),
      e.twLink,
      e.examples.join('; '),
      e.status,
      e.note,
      e.by,
    ]
      .map(clean)
      .join('\t')
  return `${[GLOSSARY_COLUMNS.join('\t'), ...entries.map(row)].join('\n')}\n`
}

/** A short id no other row has, as Taller makes them: a letter first, four characters. */
export function newGlossaryId(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken)
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const all = `${letters}0123456789`
  for (;;) {
    let id = letters[Math.floor(random() * letters.length)]
    for (let i = 0; i < 3; i++) id += all[Math.floor(random() * all.length)]
    if (!used.has(id)) return id
  }
}

/** The words of the original an entry is about, by their Strong numbers without prefixes: `H6419;H3068`. */
const wordsKey = (strong: string) =>
  strong
    .split(';')
    .map(baseStrong)
    .filter(Boolean)
    .join(';')

/** The entry about exactly these words of the original (one, or an expression), if the glossary has one. */
export const entryFor = (entries: GlossaryEntry[], strong: string) => entries.find((e) => wordsKey(e.strong) === wordsKey(strong)) ?? null

/** The entries about any of these words of the original: an expression holding one of them counts. */
export function entriesAbout(entries: GlossaryEntry[], strongs: string[]): GlossaryEntry[] {
  const wanted = new Set(strongs.map(baseStrong).filter(Boolean))
  return entries.filter((e) => e.strong.split(';').some((s) => wanted.has(baseStrong(s))))
}

/** Puts an entry in: replaces the one with its id, or goes last. */
export const upsertEntry = (entries: GlossaryEntry[], entry: GlossaryEntry) =>
  entries.some((e) => e.id === entry.id) ? entries.map((e) => (e.id === entry.id ? entry : e)) : [...entries, entry]

export interface Gathered {
  added: number
  same: number
  /** Entries about the same words with another rendering: theirs kept as an alternative, for the team to agree. */
  joined: number
}

/**
 * Gathers a glossary received from another computer (or Door43) into this one. Nothing here is lost: an entry about
 * words this glossary has no entry for comes in; one about the same words with another rendering adds that rendering
 * to the alternatives (and the other's alternatives), so the team sees both and agrees on one.
 */
export function gatherGlossary(mine: GlossaryEntry[], theirs: GlossaryEntry[]): { entries: GlossaryEntry[]; gathered: Gathered } {
  let entries = [...mine]
  const gathered: Gathered = { added: 0, same: 0, joined: 0 }
  for (const entry of theirs) {
    const here = entryFor(entries, entry.strong) ?? entries.find((e) => !e.strong && e.lemma === entry.lemma) ?? null
    if (!here) {
      const id = entries.some((e) => e.id === entry.id) ? newGlossaryId(entries.map((e) => e.id)) : entry.id
      entries = [...entries, { ...entry, id }]
      gathered.added++
      continue
    }
    const forms = [entry.rendering, ...entry.alternatives].filter((f) => f && f !== here.rendering && !here.alternatives.includes(f))
    if (!forms.length) {
      gathered.same++
      continue
    }
    entries = upsertEntry(entries, { ...here, alternatives: [...here.alternatives, ...forms], status: 'proposed' })
    gathered.joined++
  }
  return { entries, gathered }
}

const storeKey = (project: string) => `servos.prototipo.glosario.${project}`

export function readGlossary(project: string): GlossaryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(storeKey(project)) ?? '[]') as GlossaryEntry[]
  } catch {
    return []
  }
}

export function keepGlossary(project: string, entries: GlossaryEntry[]) {
  try {
    localStorage.setItem(storeKey(project), JSON.stringify(entries))
  } catch {
    /* kept for this visit */
  }
}
