/**
 * What a format 3 pack gives beside a book's texts and helps, as the screens read it today (`companions.ts`,
 * `library.ts`): the articles of the word and the Academy, the lexicon entries of the original's words, and what MACULA
 * says of the book.
 *
 * - **Articles** come in sections (`art.cddl`); an article's markdown is its title and its sections under their headings,
 *   as format 2.0 kept the published file, with its links written back as `rc:` links (`rcLinks`).
 * - **Lexicon** entries come in groups of a thousand Strong numbers (`lex:G5`); format 2.0 kept one file a number
 *   (`{brief, long, entries}`), which is rebuilt here, the verses of each sense written back as the lexicon writes them
 *   (`{"TIT": "1:7,9;2:3"}`, the Hebrew in the Hebrew Bible's numbering), and read with the same `normalizeLexiconFile`.
 * - **MACULA** travels inside the book of the original (`orig.cddl`, `macula`), as published.
 */

import { BOOKS, lexView, type ArticleModel, type LexEntry, type LexSense, type OrigModel } from '@bt-synergy/language-pack-v3'
import type { PackReader } from '@bt-synergy/language-pack-client'
import { inHebrewNumbering } from '../../lexicon/hebrewNumbering'
import { normalizeLexiconFile, strongParts, type LexiconFile } from '../../lexicon/lexicon'
import { normalizeReferentFile, type ReferentFile } from '../../original/referents'
import { normalizeTreeFile, type TreeFile } from '../../original/syntaxTree'
import type { ArticleRef } from '../articleLinks'
import { rcLinks } from './helpsV3'
import { articleIdV3 } from './lookups'

type Article = { title: string; markdown: string }

/** Gives the screen a turn when enough work went by since the last (`pacer` in bookV3); nothing by default. */
export type Pace = () => Promise<void>
const noPace: Pace = async () => {}

/** An article's markdown, as the published file has it: its title, then each section under its heading. */
function markdownOf(article: Pick<ArticleModel, 'title' | 'subtitle'> & { sections: ArticleModel['sections'] }, kind: ArticleRef['kind']): string {
  const parts = [`# ${article.title}`]
  if (kind === 'ta' && article.subtitle) parts.push(`## ${article.subtitle}`)
  for (const s of article.sections) {
    if (s.level > 0 && s.title !== undefined) parts.push(`${'#'.repeat(s.level)} ${s.title}`)
    if (s.md.trim()) parts.push(s.md.trim())
  }
  return rcLinks(parts.join('\n\n')) + '\n'
}

/** An article of a word or of the Academy, with its title, or null when its group is not installed or lacks it. */
export async function readArticleV3(reader: PackReader, ref: ArticleRef): Promise<Article | null> {
  const answer = await reader.article(articleIdV3(ref), 'all')
  const data = answer.data
  if (!data) return null
  // `article` gives the sections; the subtitle (tA) is only in the model.
  const unit = reader.unitOf('art', data.id)
  const model = unit ? (await reader.articles(unit.slice('art:'.length)))?.find((a) => a.id === data.id) : undefined
  return { title: data.title, markdown: markdownOf({ title: data.title, subtitle: model?.subtitle, sections: data.sections }, ref.kind) }
}

/**
 * The articles a book's chapters name, by path: a word's titled by its title, the Academy's by its first heading. One
 * not installed is kept as `chapterData` keeps it: titled by its name, with no text.
 */
export async function articlesV3(reader: PackReader, tw: string[], ta: string[], pace: Pace = noPace): Promise<{ tw: Record<string, Article>; ta: Record<string, Article> }> {
  const out = { tw: {} as Record<string, Article>, ta: {} as Record<string, Article> }
  for (const path of tw) {
    await pace()
    const found = await readArticleV3(reader, { kind: 'tw', path })
    out.tw[path] = found ?? { title: path.replace(/^bible\//, '').split('/').pop()!, markdown: '' }
  }
  for (const path of ta) {
    await pace()
    const found = await readArticleV3(reader, { kind: 'ta', path })
    out.ta[path] = found ? { title: found.markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path, markdown: found.markdown } : { title: path, markdown: '' }
  }
  return out
}

/** Verse-id ranges as a lexicon writes them, by book (`{"JON": "1:1,3;2:1-4"}`), the Hebrew in the Hebrew Bible's numbering. */
function packedRefs(ranges: [number, number][], hebrew: boolean): Record<string, string> {
  const byBook = new Map<string, Map<number, string[]>>()
  const at = (id: number) => {
    const book = BOOKS[Math.floor(id / 1_000_000) - 1] ?? ''
    const ours = { chapter: Math.floor((id % 1_000_000) / 1_000), verse: id % 1_000 }
    return { book: book.toUpperCase(), ...(hebrew ? inHebrewNumbering(book, ours) : ours) }
  }
  for (const [from, to] of ranges) {
    const a = at(from)
    const b = at(to)
    if (!a.book) continue
    const verses = byBook.get(a.book) ?? new Map<number, string[]>()
    byBook.set(a.book, verses)
    const list = verses.get(a.chapter) ?? []
    verses.set(a.chapter, list)
    list.push(from === to ? `${a.verse}` : a.chapter === b.chapter ? `${a.verse}-${b.verse}` : `${a.verse}-${b.chapter}:${b.verse}`)
  }
  return Object.fromEntries([...byBook].map(([book, chapters]) => [book, [...chapters].map(([c, vs]) => `${c}:${vs.join(',')}`).join(';')]))
}

const NUMBER = /^[GH]0*([0-9]+)/

/** One file of format 2.0 (one Strong number) from the entries format 3 groups. */
function fileOf(entries: LexEntry[]): LexiconFile | null {
  const hebrew = entries[0]?.strong.startsWith('H') ?? false
  const sense = ({ refs, ...rest }: LexSense) => ({ ...rest, ...(refs?.length ? { refs: packedRefs(refs, hebrew) } : {}) })
  return normalizeLexiconFile({
    brief: entries[0]?.brief ?? '',
    long: entries[0]?.long ?? '',
    entries: entries.map(({ res: _res, brief: _brief, long: _long, senses, ...entry }) => ({ ...entry, senses: senses.map(sense) })),
  })
}

/** The lexicon unit of a Strong number: a thousand numbers each (`lex:G5`). */
const lexGroup = (letter: 'G' | 'H', number: number) => `lex:${letter}${Math.floor(number / 1000)}`

/** The lexicon units these Strong numbers (as the original writes them, `G54850`) are found in, as `lexiconV3` reads them. */
export function lexGroupsOf(strongs: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const strong of strongs) for (const part of strongParts(strong)) out.add(lexGroup(part.kind === 'greek' ? 'G' : 'H', part.number))
  return out
}

/**
 * The lexicon entries of these Strong numbers (as the original writes them), keyed as `keepLexicon` keeps them
 * (`greek:5228`). Each group (about a thousand entries) is indexed once by number: filtering it again for every number,
 * a regular expression an entry, took Psalms' 2500 numbers most of a second on a desktop.
 */
export async function lexiconV3(reader: PackReader, strongs: string[], pace: Pace = noPace): Promise<Record<string, LexiconFile>> {
  const wanted = new Map<string, { letter: 'G' | 'H'; number: number }>()
  for (const strong of strongs)
    for (const part of strongParts(strong)) wanted.set(`${part.kind}:${part.number}`, { letter: part.kind === 'greek' ? 'G' : 'H', number: part.number })
  const groups = new Map<string, Map<string, LexEntry[]> | null>()
  const out: Record<string, LexiconFile> = {}
  for (const [key, { letter, number }] of wanted) {
    await pace()
    const group = lexGroup(letter, number)
    if (!groups.has(group)) {
      const segment = reader.installed(group) ? (await reader.segments(group))?.[0] : undefined
      let byNumber: Map<string, LexEntry[]> | null = null
      if (segment) {
        byNumber = new Map()
        for (const e of lexView(segment).entries) {
          const n = NUMBER.exec(e.strong)?.[1]
          if (n === undefined) continue
          const at = `${e.strong[0]}${Number(n)}`
          const list = byNumber.get(at)
          if (list) list.push(e)
          else byNumber.set(at, [e])
        }
      }
      groups.set(group, byNumber)
    }
    const entries = groups.get(group)?.get(`${letter}${number}`) ?? []
    const file = entries.length ? fileOf(entries) : null
    if (file) out[key] = file
  }
  return out
}

/** What MACULA says of the book, as `readMacula` gives it: each part null when the original has none. */
export function maculaV3(orig: OrigModel): { trees: TreeFile | null; referents: ReferentFile | null } {
  return { trees: normalizeTreeFile(orig.macula?.trees ?? null), referents: normalizeReferentFile(orig.macula?.referents ?? null) }
}
