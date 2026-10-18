/**
 * What each language has on this device, book by book: the resources its packs left, which of them a project's books
 * are read from (`BookSources`), and for a book whether it can be opened, what of it is missing, and why: «not on this
 * device» (its language published it; receive its pack) is not «not yet in the language» (no release has it)
 * (philosophy, principle 8). Read from keys alone, never from the rows, which weigh megabytes.
 */

import { readIngestReceiptMeta, scriptureIngestSchema } from '@bt-synergy/resource-catalog'
import { unwrapVersioned } from '@bt-synergy/resource-pipeline/cache/versionedEnvelope'
import { SCRIPTURE_PREPARE_VERSION } from '@bt-synergy/resource-pipeline/scripture/scripturePreparer'
import { USJ_PROCESSING_VERSION } from '@bt-synergy/usj-processor'
import { LEXICON_SUBJECTS, MACULA } from './companions'
import { BIBLE_ORDER, inBibleOrder, kindOf, type ResourceKind } from './reading'
import { GREEK, HEBREW, type BookSources, type Original } from './screenData'
import { keysUnder, type ResourceStores } from './store'

export interface ResourceHere {
  key: string
  owner: string
  language: string
  resourceId: string
  kind: ResourceKind
  /** The catalog's subject: what tells the lexicons and MACULA apart, which are of no tc-study kind. */
  subject: string
  title: string
  /** Books prepared on this device (lowercase, Bible order). Empty for resources kept by article (words, academy). */
  books: string[]
  /** Books its release has, on this device or not (from the catalog). */
  inRelease: string[]
  /** For resources kept by article: whether its articles are on this device. */
  articles: boolean
  /**
   * A text processed by another version of the code than the one Servos reads with (its pack was made before the app
   * changed how it reads the text): its rows are there and cannot be read; its pack, made again, has to be received.
   */
  stale: boolean
}

export interface DeviceIndex {
  resources: ResourceHere[]
}

/** The prepared rows each kind of resource is read from (`prepared:{type}:{key}:{book}:…`). */
const PREPARED: Partial<Record<ResourceKind, string>> = {
  scripture: 'scripture',
  original: 'scripture',
  notes: 'notes',
  questions: 'questions',
  'word-links': 'words-links',
}

/** Every resource of every language on this device, with its books. */
export async function deviceIndex(stores: ResourceStores): Promise<DeviceIndex> {
  const resources: ResourceHere[] = []
  for (const key of await stores.catalog.getAll()) {
    const meta = await stores.catalog.get(key)
    if (!meta) continue
    const kind = kindOf(meta.subject)
    const type = PREPARED[kind]
    const books = new Set<string>()
    // A text's table of chapters, to know by one small row which version prepared its chapters.
    let nav: string | null = null
    if (type) {
      const prefix = `prepared:${type}:${key}:`
      for (const k of await keysUnder(stores, prefix)) {
        const [book, unit] = k.slice(prefix.length).split(':')
        if (book) books.add(book.toLowerCase())
        if (unit === 'nav') nav ??= k
      }
    }
    const content = (meta as { contentMetadata?: { books?: string[]; ingredients?: Array<{ identifier?: string }> } }).contentMetadata
    const schema = kind === 'scripture' || kind === 'original' ? readIngestReceiptMeta(await stores.cache.get(`resource:${key}`))?.ingestSchema : undefined
    const inRelease = content?.books ?? content?.ingredients?.map((i) => i.identifier ?? '') ?? []
    resources.push({
      key,
      owner: String(meta.owner ?? key.split('/')[0]),
      language: String(meta.language ?? key.split('/')[1] ?? ''),
      resourceId: String(meta.resourceId ?? key.split('/').pop()),
      kind,
      subject: String(meta.subject ?? ''),
      title: String(meta.title ?? key),
      books: inBibleOrder(books),
      inRelease: inBibleOrder(inRelease.map((b) => b.toLowerCase()).filter((b) => BIBLE_ORDER.includes(b))),
      articles: kind === 'scripture' || kind === 'original' || PREPARED[kind] ? false : (await keysUnder(stores, `${key}/`, 1)).length > 0,
      stale:
        (typeof schema === 'string' && schema !== scriptureIngestSchema(USJ_PROCESSING_VERSION)) ||
        (type === 'scripture' && nav !== null && unwrapVersioned(await stores.cache.get(nav), SCRIPTURE_PREPARE_VERSION) === null),
    })
  }
  return { resources: resources.sort((a, b) => a.key.localeCompare(b.key)) }
}

/** The languages whose bridge texts are on this device (not the originals'), in the order of their codes. */
export function languagesOnDevice(index: DeviceIndex): string[] {
  return [...new Set(index.resources.filter((r) => r.kind === 'scripture').map((r) => r.language))].sort()
}

/** The original a book is translated from: the Hebrew for the Old Testament, the Greek for the New. */
export function originalOf(book: string): Original {
  return BIBLE_ORDER.indexOf(book.toLowerCase()) >= BIBLE_ORDER.indexOf('mat') ? GREEK : HEBREW
}

const isLiteral = (r: ResourceHere) => r.kind === 'scripture' && /lt$/.test(r.resourceId)
const isSimple = (r: ResourceHere) => r.kind === 'scripture' && /st$/.test(r.resourceId)

/**
 * The resources a language's books are read from: its literal bridge text (the one with most books, if several
 * owners publish one) and, from the same owner first, the simple one, notes, questions and word links; the word
 * articles of the word links' owner, the academy of the notes'. Null when the language has no literal text here.
 */
export function sourcesFor(index: DeviceIndex, language: string): Omit<BookSources, 'original'> | null {
  const of = index.resources.filter((r) => r.language === language)
  const literal = of.filter(isLiteral).sort((a, b) => b.books.length - a.books.length)[0]
  if (!literal) return null
  const pick = (test: (r: ResourceHere) => boolean, owner = literal.owner) =>
    of.filter(test).sort((a, b) => Number(b.owner === owner) - Number(a.owner === owner) || b.books.length - a.books.length)[0]
  const notes = pick((r) => r.kind === 'notes')
  const wordLinks = pick((r) => r.kind === 'word-links')
  const words = pick((r) => r.kind === 'words' && r.articles, wordLinks?.owner)
  const academy = pick((r) => r.kind === 'academy' && r.articles, notes?.owner)
  return {
    language,
    owner: `${literal.owner}/${language}`,
    literal: literal.key,
    ...(pick(isSimple) ? { simple: pick(isSimple)!.key } : {}),
    ...(notes ? { notes: notes.key } : {}),
    ...(pick((r) => r.kind === 'questions') ? { questions: pick((r) => r.kind === 'questions')!.key } : {}),
    ...(wordLinks ? { wordLinks: wordLinks.key } : {}),
    ...(words ? { words: words.key } : {}),
    ...(academy ? { academy: academy.key } : {}),
  }
}

/** A part of a book's sources, as the screens name it. */
export type SourcePart = 'literal' | 'simple' | 'notes' | 'questions' | 'wordLinks'

export interface Availability {
  /** It can be opened: its literal text and its original are on this device. */
  here: boolean
  /** What of it is on this device. */
  has: Record<SourcePart, boolean>
  /** What its language published for it that is not on this device: a pack brings it. */
  notOnDevice: SourcePart[]
  /** What its language has not published for it yet. */
  notInLanguage: SourcePart[]
  /** Its original is not on this device: the originals' pack brings it. */
  needsOriginal: boolean
  /** Its text or its original is here but was made for another version of the app: its pack has to be received again. */
  stale: boolean
  /** The book's sources, when it can be opened. */
  sources: BookSources | null
  /** What Servos reads beside them: the lexicon of its original in the language, and MACULA's sentences and referents. */
  extras: { lexicon: boolean; macula: boolean }
}

/** Whether a book of a language can be opened here, what is missing, and why. */
export function availability(index: DeviceIndex, language: string, book: string): Availability {
  const code = book.toLowerCase()
  const chosen = sourcesFor(index, language)
  const of = index.resources.filter((r) => r.language === language)
  const original = originalOf(code)
  const originalHere = index.resources.some((r) => r.key === original.key && r.books.includes(code))
  const resourceFor = (part: SourcePart): ResourceHere | undefined => {
    const key = chosen?.[part]
    if (key) return index.resources.find((r) => r.key === key)
    // Not chosen (not on this device at all): any of the language's that would be, to tell published from not.
    const test: Record<SourcePart, (r: ResourceHere) => boolean> = {
      literal: isLiteral,
      simple: isSimple,
      notes: (r) => r.kind === 'notes',
      questions: (r) => r.kind === 'questions',
      wordLinks: (r) => r.kind === 'word-links',
    }
    return of.find(test[part])
  }
  const parts: SourcePart[] = ['literal', 'simple', 'notes', 'questions', 'wordLinks']
  const has = Object.fromEntries(parts.map((p) => [p, Boolean(resourceFor(p)?.books.includes(code))])) as Record<SourcePart, boolean>
  const notOnDevice = parts.filter((p) => !has[p] && Boolean(resourceFor(p)?.inRelease.includes(code)))
  const notInLanguage = parts.filter((p) => !has[p] && !notOnDevice.includes(p))
  const stale = Boolean(resourceFor('literal')?.stale && has.literal) || Boolean(originalHere && index.resources.find((r) => r.key === original.key)?.stale)
  const here = has.literal && originalHere && !stale
  // The lexicon of the book's original in its language (its literal text's owner's first), and MACULA for the book.
  const testament = original === GREEK ? 'greek' : 'hebrew'
  const lexicon = of
    .filter((r) => r.subject === LEXICON_SUBJECTS[testament] && r.articles)
    .sort((a, b) => Number(b.owner === chosen?.owner.split('/')[0]) - Number(a.owner === chosen?.owner.split('/')[0]))[0]
  const macula = index.resources.find((r) => r.key === MACULA[testament] && r.articles && r.inRelease.includes(code))
  return {
    here,
    has,
    notOnDevice,
    notInLanguage,
    needsOriginal: !originalHere,
    stale,
    sources: here && chosen ? { ...chosen, original, ...(lexicon ? { lexicon: lexicon.key } : {}), ...(macula ? { macula: macula.key } : {}) } : null,
    extras: { lexicon: Boolean(lexicon), macula: Boolean(macula) },
  }
}
