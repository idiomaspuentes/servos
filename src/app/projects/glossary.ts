/**
 * The project's glossary: how the team translates a word of the original, so every translator writes it the same way.
 * An entry hangs from the original word (its lemma and Strong number), not from a word of a bridge text, so a word
 * touched in the TPL, the TPS or the original finds the same entry.
 *
 * It is kept one file a word, as the lexicons are (`content/H7121.json`, `content/G2316.json`): a glossary that grows
 * to thousands of words is never read whole. A chapter reads only its words' files, and two translators adding
 * different words never touch the same file. On Door43 it is the language's `<lang>_tg` repository with that layout.
 * Each file is `{ "strong": "H7121", "entries": [...] }`; an entry keeps Taller's columns (`src/domain/glossary.ts`
 * there), so Taller's TSV is read and written too, to bring a glossary from it or give one to it. An expression lives in
 * the file of its first word.
 *
 * In the prototype the files live in this browser, by project.
 */

import { strongCode, strongParts } from '../../lexicon/lexicon'

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
  /** When it was written last (ISO): what is shared is what changed since the last time. */
  changed?: string
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

/** What gathering changed: the entries to write back, each into its word's file. */
export interface GatherResult {
  entries: GlossaryEntry[]
  gathered: Gathered
  changed: GlossaryEntry[]
}

/**
 * Gathers a glossary received from another computer (or Door43) into this one. Nothing here is lost: an entry about
 * words this glossary has no entry for comes in; one about the same words with another rendering adds that rendering
 * to the alternatives (and the other's alternatives), so the team sees both and agrees on one.
 */
export function gatherGlossary(mine: GlossaryEntry[], theirs: GlossaryEntry[]): GatherResult {
  let entries = [...mine]
  const gathered: Gathered = { added: 0, same: 0, joined: 0 }
  const changed: GlossaryEntry[] = []
  for (const entry of theirs) {
    const here = entryFor(entries, entry.strong) ?? entries.find((e) => !e.strong && e.lemma === entry.lemma) ?? null
    if (!here) {
      const id = entries.some((e) => e.id === entry.id) ? newGlossaryId(entries.map((e) => e.id)) : entry.id
      entries = [...entries, { ...entry, id }]
      changed.push({ ...entry, id })
      gathered.added++
      continue
    }
    const forms = [entry.rendering, ...entry.alternatives].filter((f) => f && f !== here.rendering && !here.alternatives.includes(f))
    if (!forms.length) {
      gathered.same++
      continue
    }
    const joined = { ...here, alternatives: [...here.alternatives, ...forms], status: 'proposed' as const }
    entries = upsertEntry(entries, joined)
    changed.push(joined)
    gathered.joined++
  }
  return { entries, gathered, changed }
}

/** The file an entry lives in: its first word's Strong number as the lexicons write it (H7121, G2316, H1254a). */
export function glossaryCode(strong: string): string {
  const part = strongParts(strong.split(';')[0])[0]
  return part ? strongCode(part) : 'sin-original'
}

/** One file of the glossary: the entries about one word of the original (and the expressions it begins). */
export interface GlossaryFileOfWord {
  strong: string
  entries: GlossaryEntry[]
}

const prefix = (project: string) => `servos.prototipo.glosario.${project}.`

function readFileOf(project: string, code: string): GlossaryEntry[] {
  try {
    return (JSON.parse(localStorage.getItem(prefix(project) + code) ?? 'null') as GlossaryFileOfWord | null)?.entries ?? []
  } catch {
    return []
  }
}

function writeFileOf(project: string, code: string, entries: GlossaryEntry[]) {
  try {
    if (entries.length) localStorage.setItem(prefix(project) + code, JSON.stringify({ strong: code, entries } satisfies GlossaryFileOfWord))
    else localStorage.removeItem(prefix(project) + code)
  } catch {
    /* kept for this visit */
  }
}

/** A glossary kept by an earlier prototype as one list goes into its words' files, once. */
function fromOneList(project: string) {
  try {
    const old = localStorage.getItem(`servos.prototipo.glosario.${project}`)
    if (!old) return
    for (const entry of JSON.parse(old) as GlossaryEntry[]) {
      const code = glossaryCode(entry.strong)
      writeFileOf(project, code, upsertEntry(readFileOf(project, code), entry))
    }
    localStorage.removeItem(`servos.prototipo.glosario.${project}`)
  } catch {
    /* left as it was */
  }
}

/** The entries about these words of the original: only their files are read. */
export function readGlossaryFor(project: string, strongs: string[]): GlossaryEntry[] {
  fromOneList(project)
  const codes = new Set(strongs.flatMap((s) => strongParts(s).map(strongCode)))
  return [...codes].flatMap((code) => readFileOf(project, code))
}

/** The whole glossary, for its own screen and for sharing it. */
export function readGlossary(project: string): GlossaryEntry[] {
  fromOneList(project)
  const out: GlossaryEntry[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix(project))) out.push(...readFileOf(project, key.slice(prefix(project).length)))
    }
  } catch {
    /* nothing to read */
  }
  return out
}

/** Writes an entry into its word's file, stamped with when. */
export function saveGlossaryEntry(project: string, entry: GlossaryEntry, now = new Date()) {
  const code = glossaryCode(entry.strong)
  const stamped = { ...entry, changed: now.toISOString() }
  writeFileOf(project, code, upsertEntry(readFileOf(project, code), stamped))
}

/**
 * A glossary to pass to another computer: the files of the words whose entries changed since `since` (all of them
 * without it), so what travels is what is new, however big the glossary is.
 */
export function glossaryBundle(entries: GlossaryEntry[], since?: string): string {
  const files: Record<string, GlossaryEntry[]> = {}
  for (const e of entries) if (!since || (e.changed ?? '') > since) (files[glossaryCode(e.strong)] ??= []).push(e)
  return JSON.stringify({ format: 'servos-glosario', version: 1, files })
}

/** What a received glossary holds: a bundle from Servos, or Taller's TSV. */
export function readBundle(text: string): GlossaryEntry[] {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      const bundle = JSON.parse(trimmed) as { format?: string; files?: Record<string, GlossaryEntry[]> }
      return bundle.format === 'servos-glosario' ? Object.values(bundle.files ?? {}).flat() : []
    } catch {
      return []
    }
  }
  return parseGlossary(trimmed)
}

const sharedKey = (project: string) => `servos.prototipo.glosarioCompartido.${project}`

/** When this computer last shared its glossary. */
export function lastShared(project: string): string | undefined {
  try {
    return localStorage.getItem(sharedKey(project)) ?? undefined
  } catch {
    return undefined
  }
}

export function markShared(project: string, now = new Date()) {
  try {
    localStorage.setItem(sharedKey(project), now.toISOString())
  } catch {
    /* asked again next time */
  }
}
