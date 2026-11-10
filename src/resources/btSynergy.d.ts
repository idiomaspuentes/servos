/**
 * The part of bt-synergy (`../bt-synergy/packages`) that Servos uses, declared here so Servos's strict compiler checks
 * only Servos's code: those packages are written with other compiler settings. At run time Vite and Vitest load the
 * real sources (vite.config.ts), and the tests in `src/resources` run against them, so a signature that changes there
 * shows up as a failing test here. Keep each declaration next to where it comes from.
 */

declare module '@bt-synergy/resource-catalog' {
  /** `{tag}#{published_at}`, sanitized; `nostamp` when the row has neither. */
  export function resourceContentStamp(metadata: unknown): string
  /** `g` + ten hex of the book's blob sha when the row recorded it at its own release; else `resourceContentStamp`. */
  export function bookContentStamp(metadata: unknown, book: string): string
  /** `usj:{version}`: what a scripture's receipt says it was processed with. */
  export function scriptureIngestSchema(usjProcessingVersion: string): string
  /** The metadata of a `resource:{key}` receipt row, or null. */
  export function readIngestReceiptMeta(entry: unknown): Record<string, unknown> | null
}

declare module '@bt-synergy/usj-processor' {
  export const USJ_PROCESSING_VERSION: string
}

declare module '@bt-synergy/cache-adapter-indexeddb' {
  export type CacheRow = { key: string; entry: unknown }
  /** What a `transactRaw` reads: rows by exact key, and the keys under each prefix. */
  export type RawRead = { keys: string[]; prefixes: string[] }
  /** `rows`: key to the stored entry (absent keys are missing); `prefixKeys`: prefix to the keys that start with it. */
  export type RawFound = { rows: Map<string, unknown>; prefixKeys: Map<string, string[]> }
  /** What a `transactRaw` writes. */
  export type RawWrite = { puts: CacheRow[]; deletes: string[] }
  export class IndexedDBCacheAdapter {
    constructor(options?: { dbName?: string; storeName?: string; version?: number })
    get(key: string): Promise<unknown>
    getByPrefix(prefix: string): Promise<CacheRow[]>
    putRawMany(rows: CacheRow[]): Promise<void>
    hasRawKeys(keys: string[]): Promise<Set<string>>
    /** Reads keys and prefixes, decides (synchronously), then puts and deletes, all in one readwrite transaction. */
    transactRaw(read: RawRead, decide: (found: RawFound) => RawWrite): Promise<void>
  }
  /** Raw bytes by key in a database of their own (parts staging); the bytes are checked by whoever puts them. */
  export class IndexedDBByteStore {
    constructor(options: { dbName: string; storeName?: string })
    put(key: string, bytes: Uint8Array): Promise<void>
    get(key: string): Promise<Uint8Array | null>
    has(key: string): Promise<boolean>
    delete(key: string): Promise<void>
    list(): Promise<Array<{ key: string; size: number; at: string }>>
  }
}

declare module '@bt-synergy/catalog-adapter-indexeddb' {
  export class IndexedDBCatalogAdapter {
    constructor(options?: { dbName?: string; storeName?: string })
    get(key: string): Promise<Record<string, unknown> | null>
    getAll(): Promise<string[]>
    set(key: string, metadata: Record<string, unknown>): Promise<void>
  }
}

declare module '@bt-synergy/language-pack' {
  /** `index` is optional (`OPTIONAL_LAYERS`): a reader that does not state its versions skips its parts. */
  export type PackLayer = 'receipt' | 'sot' | 'prepared' | 'quote' | 'align' | 'text' | 'index'
  export type PackKind = 'language' | 'originals' | 'base' | 'book'
  export type PackVersions = Partial<Record<PackLayer, Record<string, string | number>>>
  export type PackRequirement = { key: string; stamp: string }
  export type PackManifestResource = {
    key: string
    role: 'language' | 'original'
    stamp: string
    subject?: string
    title?: string
    rows: Partial<Record<PackLayer, number>>
    books?: string[]
  }
  export type PackManifest = {
    format: string
    formatVersion: string
    language: string
    kind?: PackKind
    books?: string[]
    requires?: PackRequirement[]
    createdAt: string
    createdBy?: string
    layers: PackLayer[]
    versions?: PackVersions
    resources: PackManifestResource[]
  }
  export type PackResourceRole = 'language' | 'original'
  /** What a `transactRaw` reads: rows by exact key, and the keys under each prefix. */
  export type RawRead = { keys: string[]; prefixes: string[] }
  /** `rows`: key to the stored entry (absent keys are missing); `prefixKeys`: prefix to the keys that start with it. */
  export type RawFound = { rows: Map<string, unknown>; prefixKeys: Map<string, string[]> }
  /** What a `transactRaw` writes. */
  export type RawWrite = { puts: CacheRow[]; deletes: string[] }
  /** Where a pack or a part is written: rows as given, catalog rows, and `transactRaw` for applying parts. */
  export type PackTarget = {
    /** Writes rows exactly as given: no splitting, no envelope. */
    putRows(rows: CacheRow[]): Promise<void>
    /** Keys already in the store among `keys`. */
    existingKeys?(keys: string[]): Promise<Set<string>>
    putCatalogRows(rows: Array<{ key: string; metadata: Record<string, unknown> }>): Promise<void>
    /** The catalog row the device already has for a resource. */
    catalogRow?(resourceKey: string): Promise<Record<string, unknown> | null>
    /** Read keys and prefixes, decide, then put and delete in one readwrite transaction (all or nothing). */
    transactRaw?(read: RawRead, decide: (found: RawFound) => RawWrite): Promise<void>
  }
  export type ImportPackResult = {
    manifest: PackManifest
    written: number
    keptExisting: number
    byLayer: Partial<Record<PackLayer, number>>
    skippedLayers: PackLayer[]
    skippedResources: Array<{ key: string; why: string }>
    originals: Array<PackRequirement & { status: 'present' | 'in-pack' | 'missing' | 'other-release' }>
    /** Quote and align rows left out, by resource and layer: made against another release (or blob) of an original than the device's. */
    droppedRows: Record<string, Partial<Record<PackLayer, number>>>
  }
  export type CacheRow = { key: string; entry: unknown }
  export type PackSource = {
    rowsByPrefix(prefix: string): Promise<CacheRow[]>
    catalogRow(key: string): Promise<unknown>
    catalogRows(): Promise<unknown[]>
  }
  export function readPackManifest(bytes: Uint8Array | ArrayBuffer): Promise<PackManifest>
  export function importLanguagePack(params: {
    bytes: Uint8Array | ArrayBuffer
    target: PackTarget
    versions?: PackVersions
    overwrite?: boolean | readonly string[]
    onProgress?: (done: number, total: number) => void
  }): Promise<ImportPackResult>
  export function buildLanguagePack(params: {
    source: PackSource
    language: string
    kind?: PackKind
    books?: string[]
    originalKeys?: string[]
    versions?: PackVersions
  }): Promise<{ bytes: Uint8Array; manifest: PackManifest; skipped: Array<{ key: string; why: string }> }>
  export function packTargetFrom(stores: { cache: unknown; catalog: unknown }): PackTarget
  export function packSourceFrom(stores: { cache: unknown; catalog: unknown }): PackSource

  // The parts importer (format 2.0): a language's parts list, the plan against the register, staging, apply.
  /** The format of a parts list and its parts, used in their compat key. */
  export const PARTS_FORMAT_VERSION: '2.0.0'
  /** The folder a list lives in: the format (major.minor) and the five versions that decide whether rows are reusable. */
  export function compatKeyOf(formatVersion: string, versions: PackVersions): string
  export type PartKind = 'book' | 'alignments' | 'original' | 'macula' | 'tw' | 'ta' | 'titles' | 'lexicon' | 'obs' | 'index'
  export type PartEntry = {
    sha256: string
    bytes: number
    rows: number
    kind: PartKind
    resource: string
    /** Lowercase. */
    book?: string
    group?: string
    /** What the next build compares to carry it. */
    fingerprint: string
    layers: PackLayer[]
  }
  /** A unit (`shared`, `book <b>`) and the fingerprint of everything it is built from. */
  export type PartsUnit = { id: string; fingerprint: string }
  export type PartsListResource = {
    key: string
    /** `resourceContentStamp` of its catalog row. */
    stamp: string
    role: PackResourceRole
    subject: string
    title: string
    books?: string[]
    /** The resource's catalog row, without the catalog's own bookkeeping. */
    metadata: unknown
  }
  /** The parts list (schema 2): every part of a language, with each resource's catalog row and release stamp. */
  export type PartsList = {
    schema: 2
    /** `es-419`, or `originals`. */
    language: string
    compat: string
    /** The code its parts were built and fingerprinted with. */
    code: string
    versions: PackVersions
    resources: PartsListResource[]
    parts: PartEntry[]
    /** A language's list: the originals list its quote and align rows were made against, at its content address. */
    originals?: { path: string; sha256: string }
    units?: PartsUnit[]
    /** Language list only: the stamp of every resource the build read, by key. */
    stamps?: Record<string, string>
  }
  export type PartRow = { layer: PackLayer; key: string; value: unknown }
  /** The bytes of a part file (gzipped rows) with its sha256 name. */
  export function writePart(rows: Iterable<PartRow>): Promise<{ bytes: Uint8Array; sha256: string; rows: number }>
  export function sha256Hex(bytes: Uint8Array): Promise<string>
  /** The unit (`shared`, `book <b>`) a part belongs to. */
  export function unitOfPart(part: Pick<PartEntry, 'kind' | 'book'>): string
  /** `catalog/{compat}/{language}.json`. */
  export function partsListPath(compat: string, language: string): string
  /** `catalog/{compat}/originals/{sha256}.json`. */
  export function originalsListPath(compat: string, sha256: string): string
  /** `parts/{sha256}.part.gz`. */
  export function partPath(sha256: string): string
  /** The register's prefix in the resources store. */
  export const REGISTER_PREFIX: 'parts-slot:'
  export type SlotRecord = {
    /** The part that fills the slot. */
    sha256: string
    /** Every row key the part wrote, chapter chunks included. */
    keys: string[]
    /** The list that named it: its `language`, or `originals`. */
    list: string
    /** When it was applied (ISO). */
    at: string
  }
  /** What the device holds, by slot id. */
  export type Register = Map<string, SlotRecord>
  /** The register from raw rows of the store (rows of other prefixes are skipped). */
  export function readRegister(rows: Iterable<{ key: string; entry: unknown }>): Register
  /** The unit (`shared`, `book <b>`) a slot id is in. */
  export function unitOfSlotId(id: string): string
  /** Where a part goes: its kind, resource, and book or group. */
  export type PartSlot = { kind: PartKind; resource: string; book?: string; group?: string }
  /** `kind:resource[:book][:group]`: the register's key for a slot. */
  export function slotId(slot: PartSlot): string
  /** The slot a list entry fills. */
  export function slotOfEntry(entry: PartEntry): PartSlot
  export type PlanInput = {
    list: PartsList
    originals?: PartsList
    register: Register
    /** Unit ids: `shared`, `book <b>`. */
    chosen: string[]
    /** This app's processing versions, by layer: the same it gives `applyParts`. Without them, optional layers' parts are skipped. */
    versions?: PackVersions
  }
  /** Why a reader leaves a listed part out: a kind or a layer it does not know, or an optional layer of other versions. */
  export type SkipReason = 'kind' | 'layer' | 'version'
  export type PartsPlan = {
    /** Parts of the chosen units whose slot the device lacks or holds with another sha, one per slot. */
    download: PartEntry[]
    /** Slot ids this language's list put on the device in the chosen units that the lists no longer name. */
    remove: string[]
    /** The chosen units `download` or `remove` touch, in apply order. */
    units: string[]
    /** Sum of `download[].bytes`. */
    bytes: number
    /**
     * Parts the lists name that this reader cannot use: neither downloaded nor removed. One of an unknown kind or layer
     * leaves its resource incomplete (no receipt, not `offline`); one of optional layers alone is left out as if unlisted.
     */
    skipped: Array<{ entry: PartEntry; reason: SkipReason }>
    /** The versions the plan judged parts by (`PlanInput.versions`), when given. */
    versions?: PackVersions
  }
  export type Coverage = Map<string, { present: number; missing: number; missingBytes: number; whole: boolean }>
  /** What to download and remove for the chosen units; pure. Throws when a list names an originals list not given. */
  export function planParts(input: PlanInput): PartsPlan
  /** Per resource: its chosen parts held and missing, the missing ones' bytes, and whether all its parts are held. */
  export function partsCoverage(input: PlanInput): Coverage
  /** Where downloaded parts wait, verified, until they are applied. */
  export interface PartsStaging {
    put(sha: string, bytes: Uint8Array): Promise<void>
    get(sha: string): Promise<Uint8Array | null>
    has(sha: string): Promise<boolean>
    delete(sha: string): Promise<void>
    list(): Promise<Array<{ sha: string; size: number; at: string }>>
  }
  /** Bytes by key: `IndexedDBByteStore` satisfies it, as does `memoryByteStore()`. */
  export type ByteStore = {
    put(key: string, bytes: Uint8Array): Promise<void>
    get(key: string): Promise<Uint8Array | null>
    has(key: string): Promise<boolean>
    delete(key: string): Promise<void>
    list(): Promise<Array<{ key: string; size: number; at: string }>>
  }
  /** Staging over a byte store; `put` refuses bytes whose sha256 is not their name. */
  export function stagingFrom(store: ByteStore): PartsStaging
  /** A byte store in memory, for tests. */
  export function memoryByteStore(): ByteStore
  export type ApplyInput = {
    target: PackTarget
    staging: PartsStaging
    plan: PartsPlan
    list: PartsList
    originals?: PartsList
    /** The register the plan was made from. */
    register: Register
    /** The units the person chose (the plan's input). */
    chosen: string[]
    /** This app's processing versions, by layer. */
    versions: PackVersions
    /** Apply time (ms); `Date.now` by default. */
    now?: () => number
  }
  /** Why: `quota` is a full disk, `missing` a part not in staging, `versions` a list made with other versions. */
  export type ApplyFailureReason = 'missing' | 'quota' | 'invalid' | 'versions' | 'error'
  /** What failed, by `scope`: a unit not applied, catalog rows not written (a stale flag), or the receipts pass. */
  export type ApplyFailure =
    | { scope: 'unit'; unit: string; reason: ApplyFailureReason; message: string }
    | { scope: 'catalog'; unit?: string; reason: ApplyFailureReason; message: string }
    | { scope: 'receipts'; reason: ApplyFailureReason; message: string }
  export type ApplyResult = {
    /** Set when no unit was applied: `versions` (update the app) or `missing` (a part is not yet staged). */
    refused?: { reason: 'versions' | 'missing'; message: string }
    /** Units whose transaction committed, in apply order. */
    applied: string[]
    failed: ApplyFailure[]
    /** Resources an applied unit touched that are whole afterwards. */
    completed: string[]
    /** An original or MACULA slot was replaced: other languages' aligned quotes may miss. */
    originalsReplaced: boolean
    /** Sum of the applied parts' `bytes`. */
    bytesApplied: number
  }
  /** Applies one plan, a unit at a time, each in one transaction with its register rows. */
  export function applyParts(input: ApplyInput): Promise<ApplyResult>
}

declare module '@bt-synergy/resource-pipeline/prepare/prepareKeys' {
  export type PrepareTier = 'light' | 'full'
  /** `prepared:{type}:{key}:{book}:{unit}:{tier}`. */
  export function preparedUnitKey(typeId: string, resourceKey: string, bookId: string, unit: string | number, tier: PrepareTier): string
}

declare module '@bt-synergy/resource-pipeline/cache/versionedEnvelope' {
  export function unwrapVersioned<T>(entry: unknown, expectedVersion: number): T | null
}

declare module '@bt-synergy/resource-pipeline/scripture/scripturePreparer' {
  export const SCRIPTURE_PREPARE_VERSION: number
  export type LightInline =
    | { kind: 'verse'; chapterNumber: number; verseNumber: number }
    | { kind: 'text'; text: string }
    | { kind: 'heading'; text: string }
    | { kind: 'note'; caller: string; text: string }
    | { kind: 'xref'; caller: string; text: string }
  export interface LightBlock {
    marker: string
    role: string
    indentLevel: number
    chapterNumber: number
    verseNumbers: number[]
    inline: LightInline[]
  }
  export interface ScriptureLightChapter {
    version: number
    unit: number
    blocks: LightBlock[]
  }
  /** A word of the full tier: its surface, occurrence, its own match key and the original words it is aligned to (indices into `matchKeys`). */
  export interface InternedToken {
    c: string
    o: number
    k: number
    a?: number[]
    /** A ketiv's qere (from the note after it), and the index of its match key. */
    qc?: string
    q?: number
  }
  export type FullInline = LightInline | { kind: 'token'; token: InternedToken }
  export interface FullBlock {
    marker: string
    role: string
    indentLevel: number
    chapterNumber: number
    verseNumbers: number[]
    inline: FullInline[]
  }
  export interface ScriptureFullChapter {
    version: number
    unit: number
    /** Folded semantic ids (`jon 2:2:קראתי:1`). */
    matchKeys: string[]
    blocks: FullBlock[]
  }
  export interface ScriptureNavRecord {
    version: number
    resourceKey?: string
    bookId: string
    bookName: string
    chapters: Array<{ number: number; verseCount: number }>
  }
}

declare module '@bt-synergy/resource-pipeline/notes/notesPreparer' {
  export const NOTES_PREPARE_VERSION: number
  export interface NotesLightRow {
    id: string
    reference: string
    quote: string
    body: string
    note: string
    supportReference: string
    tags: string
    occurrence: string
    isIntro?: boolean
  }
  export interface NotesLightChapter {
    version: number
    unit: number
    notes: NotesLightRow[]
  }
}

declare module '@bt-synergy/resource-pipeline/helps/helpsAlignCache' {
  export const HELPS_ALIGN_VERSION: number
  /** Positions of the aligned words in the prepared full chapter, and their texts. `m: 0` is a settled miss. */
  export type CachedAlignRow = { p: number[]; m: 0 | 1 | 2; t?: string[] }
  export type CachedAlignments = Record<string, CachedAlignRow>
  /** The text's stamp in an align key: `bookContentStamp` + `+{prepareVersion}` (the scripture prepare version). */
  export function targetBookStamp(metadata: unknown, book: string, prepareVersion?: number): string
}

declare module '@bt-synergy/resource-pipeline/helps/helpsQuoteCache' {
  export const HELPS_QUOTE_VERSION: number
}

declare module '@bt-synergy/resource-pipeline/helps/helpsCacheKeys' {
  export const HELPS_TEXT_VERSION: number
}

/**
 * Language packs format 3: the model types of `packages/language-pack-v3` (its `src/model.ts`) that Servos reads, and the
 * few functions it calls, kept to the library's signatures.
 */
declare module '@bt-synergy/language-pack-v3' {
  /** At `position` (pieces before it) a chapter or verse starts (`arg`: its number as published, `"1-2"`), a node opens (`"type:marker"`) or the last one closes (`""`). */
  export type Event = [position: number, kind: 'chapter' | 'verse' | 'open' | 'close', arg: string]
  /** A piece of a text: a word (`isWord`) or what lies between words. */
  export type Piece = [text: string, isWord: boolean]
  export type OrigWord = { form: string; lemma: string; strong: string; morph: string; other?: Record<string, string> }
  /** One book of the original: a word's position is its index in `words`, footnotes included. */
  export type OrigModel = {
    book: string
    key: string
    stamp: string
    words: OrigWord[]
    pieces: Piece[]
    events: Event[]
    attrs?: Record<number, Record<string, string>>
    macula?: { release: string; trees?: unknown; referents?: unknown }
  }
  /** A bridge text of a book; `align` has one list per word piece: the original positions it translates. */
  export type TextModel = {
    res: string
    pieces: Piece[]
    events: Event[]
    attrs?: Record<number, Record<string, string>>
    align?: number[][]
    alignMissing?: [word: number, verse: number, original: string, occurrence: number][]
  }
  /** A note, question or word link. `from`/`to` are verse ids; `quote` the original positions of its quote (`-1`: none). */
  export type HelpRow = {
    id: string
    ref: string
    from: number
    to: number
    concept?: string
    cols: Record<string, string | boolean>
    quote?: number[]
    quoteKinds?: [piece: number, kind: string][]
    quoteMissing?: [piece: number, verse: number, word: string, occurrence: number][]
  }
  export type HelpTable = { res: string; rows: HelpRow[] }
  export type BookModel = {
    lang: string
    book: string
    orig: [string, string]
    res: [string, string][]
    texts: TextModel[]
    notes?: HelpTable
    questions?: HelpTable
    links?: HelpTable
  }
  export type Role =
    | 'intro'
    | 'definition'
    | 'facts'
    | 'translation-suggestions'
    | 'examples'
    | 'strategies'
    | 'description'
    | 'reason'
    | 'bible-references'
    | 'word-data'
    | 'unknown'
  export type SectionModel = { sid: string; level: number; role: Role; title?: string; lang: string; md: string; aliases?: string[] }
  export type ArticleModel = {
    id: string
    res: string
    title: string
    subtitle?: string
    related?: string[]
    aliases?: string[]
    sections: SectionModel[]
  }
  /** `refs` are verse-id ranges `[from, to]` in our numbering. */
  export type LexSense = {
    code?: string
    definition?: string
    glosses?: string[]
    domain?: string
    domainCode?: string
    comments?: string
    etymology?: string
    lang?: string
    definitionLang?: string
    refs?: [number, number][]
  }
  export type LexEntry = {
    res: string
    strong: string
    lemma: string
    brief?: string
    long?: string
    pos?: string[]
    senses: LexSense[]
    notes?: string[]
    aramaic?: boolean
    source?: string
    review?: string
  }
  /** A checked segment: its header and its tables (read with a view). */
  export type Segment = { h: { class: string; [field: string]: unknown }; t: Record<string, unknown>; ulen?: number }
  export function lexView(seg: Segment): { group: string; entries: LexEntry[] }
  /** The 66 books; a book's number is its index plus 1. */
  export const BOOKS: readonly string[]
  /** `LLCCCVVV`: `verseId('tit', 2, 11)` is 56002011. */
  export function verseId(book: string, chapter: number, verse: number): number
  /** A source of format 2.0 rows (a pack read as rows). */
  export type RowSource = { resources(lang: string): Promise<unknown[]> }
  export function zipSource(zip: Uint8Array, originals?: RowSource): Promise<RowSource & { language: string }>
}

/**
 * Language packs format 3: the surface of `packages/language-pack-client` (its `src/index.ts`) that Servos calls, kept
 * to the library's signatures. Data types Servos does not read yet are left loose (`unknown`).
 */
declare module '@bt-synergy/language-pack-client' {
  export const CLIENT_ERROR_CODES: readonly [
    'E_DOWNGRADE',
    'E_COMMON',
    'E_NO_BASE',
    'E_NO_PACK',
    'E_NETWORK',
    'E_STORE',
    'E_NOT_INSTALLED',
    'E_ARG',
  ]
  export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number]
  export class ClientError extends Error {
    code: ClientErrorCode
    status?: number
    /** Seconds, for a 429. */
    retryAfter?: number
  }

  /** Keeps segments by id (64 lowercase hex) and one installed-state record. */
  export interface BlobStore {
    has(id: string): Promise<boolean>
    get(id: string): Promise<Uint8Array | undefined>
    put(id: string, bytes: Uint8Array): Promise<void>
    delete(id: string): Promise<void>
    ids(): Promise<string[]>
    getState(): Promise<unknown>
    setState(state: never): Promise<void>
  }
  export function memoryStore(): BlobStore
  export function indexedDbStore(o?: { name?: string; indexedDB?: IDBFactory }): Promise<BlobStore>

  export interface PackSource {
    catalog(
      name: string,
      o?: { etag?: string; signal?: AbortSignal },
    ): Promise<{ bytes: Uint8Array; etag?: string } | 'not-modified'>
    segment(id: string, signal?: AbortSignal): Promise<Uint8Array>
  }
  export function httpSource(o: { base: string; fetch?: typeof fetch }): PackSource

  /** Ed25519 public keys (32 raw bytes) by key id. Given, even empty, it demands signatures. */
  export type TrustPolicy = { trustedKeys?: Record<string, Uint8Array> }

  export type InstalledCatalog = {
    name: string
    publisher: string
    revision: number
    id: string
    origin: 'published' | 'local'
    etag?: string
  }
  /** A resource a catalog lists (`catalog.cddl`, `resource`); `books` is the book set. */
  export type CatalogResource = {
    key: string
    title: string
    subject: string
    release: string
    license: string
    rights?: string
    attribution?: string
    books: Uint8Array
  }
  /** A catalog file read and checked; only the tables Servos reads are typed. */
  export type VerifiedCatalog = {
    id: string
    name: string
    publisher: string
    revision: number
    origin: 'published' | 'local'
    catalog: {
      resources: CatalogResource[]
      requires?: [catalog: string, revision: number, id: Uint8Array][]
      units: { id: string; needs?: string[]; segments: number[]; optional?: boolean }[]
    }
  }
  export function verifyCatalogFile(
    bytes: Uint8Array,
    policy: TrustPolicy,
    o: { from: 'network' | 'transfer' | 'store' | 'bridge'; expectedId?: string },
  ): Promise<VerifiedCatalog>
  export type InstalledState = {
    v: 1
    published: Record<string, InstalledCatalog>
    active: Record<string, InstalledCatalog>
    units: Record<string, unknown>
    aliases?: Record<string, string>
  }
  export type Want = { books?: string[]; units?: string[]; aligned?: true | string[]; defaults?: boolean }
  /** `bytes`: what this install has stored so far (a running total). */
  export type Progress = { done: number; total: number; bytes: number; key: string }
  /** The units a want names, with what they need, in order; `bytes` of the segments not in `have`. */
  export function planInstall(
    catalogs: VerifiedCatalog[],
    state: InstalledState,
    want: Want,
    have: ReadonlySet<string>,
  ): { steps: { key: string; complete: boolean }[]; bytes: number; unknown: string[] }
  export type InstallReport = {
    activated: string[]
    waiting: { key: string; missing: string[] }[]
    fetched: string[]
    bytes: number
    unknown: string[]
  }
  /** An installed unit whose segments changed in a newer catalog: `bytes` of the segments it does not have yet. */
  export type Update = { key: string; from: number; to: number; bytes: number }
  export type RefreshReport = {
    catalogs: InstalledCatalog[]
    updates: Update[]
    unchanged: boolean
    missingCommon?: { name: string; revision: number; id: string }
  }
  export type Status = {
    lang: string
    published?: InstalledCatalog
    active?: InstalledCatalog
    units: { key: string; revision: number; installed: boolean; optional: boolean; bytes: number }[]
    updates: Update[]
    missingCommon?: RefreshReport['missingCommon']
  }
  export type ImportReport = {
    catalogs: InstalledCatalog[]
    stored: string[]
    rejected: { id: string; code: string }[]
    skipped?: true
    missing: string[]
    activated: string[]
    waiting: { key: string; missing: string[] }[]
  }

  export interface LanguagePackClient {
    open(lang: string): Promise<PackReader>
    /** A format 1.1 pack bridged on the device into format 3 (a local catalog); `originals` are the rows of the originals. */
    importOldPack(
      zip: Uint8Array,
      o?: { originals?: import('@bt-synergy/language-pack-v3').RowSource; device?: string; now?: string; confirmDowngrade?: boolean },
    ): Promise<ImportReport>
    refresh(lang: string, o?: { confirmDowngrade?: boolean; signal?: AbortSignal }): Promise<RefreshReport>
    install(
      lang: string,
      want?: Want,
      o?: { signal?: AbortSignal; onProgress?: (p: Progress) => void; concurrency?: number },
    ): Promise<InstallReport>
    status(lang: string): Promise<Status>
    prune(): Promise<{ removed: string[] }>
    verify(): Promise<{ bad: string[] }>
    importTransfer(bytes: Uint8Array, o?: { confirmDowngrade?: boolean }): Promise<ImportReport>
    exportTransfer(o: {
      lang: string
      mode: 'full' | 'update'
      books?: string[]
      units?: string[]
      base?: Uint8Array[]
    }): Promise<Uint8Array>
    indexProblems(): { segment?: string; message: string }[]
  }
  export function createClient(o: {
    store: BlobStore
    source?: PackSource
    trust: TrustPolicy
    index?: unknown
  }): LanguagePackClient

  export type QueryName =
    | 'passage'
    | 'concept'
    | 'article'
    | 'renderings'
    | 'search'
    | 'topics'
    | 'books'
    | 'context'
  export type Cite = { res: string; release: string; id?: string; ref?: string; section?: string }
  export type NotInstalled = { book?: string; unit: string; bytes: number; what?: string }
  /** `none` means the source does not cover the book; it is not zero. */
  export type CellState = 'count' | 'zero' | 'none' | 'partial'
  export type Answer<T> = {
    query: QueryName
    /** null when the unit that answers is not installed. */
    data: T | null
    cites: Cite[]
    revision: { lang?: number; common?: number; units: Record<string, number> }
    coverage?: Record<string, CellState>
    notInstalled: NotInstalled[]
  }
  export type PassageData = {
    book: string
    ref: string
    texts: { res: string; text: string }[]
    notes: unknown[]
    questions: unknown[]
    links: unknown[]
  }

  /** How the installed texts render the words of one Strong (`strong` is the key the table resolved). */
  export type RenderingsData = { strong: string; renderings: { text: string; count: number; refs: string[] }[] }
  /** One book of a `books` answer; `bytes` when it is not installed and a catalog lists it. */
  export type BookCell = { state: CellState; count?: number; verses?: number; installed: boolean; bytes?: number }
  /** `installed: false` (and no cells) when the map that answers is not on the device. */
  export type BooksData = { installed?: false; books: Record<string, BookCell> }

  export type ArticleData = {
    id: string
    title: string
    sections: (import('@bt-synergy/language-pack-v3').SectionModel & { otherLang: boolean })[]
    more: { sid: string; title?: string; role: import('@bt-synergy/language-pack-v3').Role }[]
  }

  export interface PackReader {
    lang: string
    /** Segments that were stored but do not read as the segment their id says. */
    problems: { id: string; code: string }[]
    revisions(): { lang?: number; common?: number }
    installed(unit: string): boolean
    listed(unit: string): boolean
    size(unit: string): number
    unitOf(cls: 'book' | 'art' | 'orig', key: string): string | undefined
    unitRevision(unit: string): number | undefined
    book(book: string): Promise<import('@bt-synergy/language-pack-v3').BookModel | undefined>
    orig(book: string): Promise<import('@bt-synergy/language-pack-v3').OrigModel | undefined>
    articles(group: string): Promise<import('@bt-synergy/language-pack-v3').ArticleModel[] | undefined>
    /** The checked segments of an installed unit (`lex:G5`), or `undefined` when it is not installed. */
    segments(unit: string): Promise<import('@bt-synergy/language-pack-v3').Segment[] | undefined>
    passage(ref: string): Promise<Answer<PassageData>>
    article(id: string, section?: string | 'all'): Promise<Answer<ArticleData>>
    context(ref: string): Promise<Answer<unknown>>
    concept(id: string): Promise<Answer<unknown>>
    topics(q?: { category?: string; book?: string }): Promise<Answer<unknown>>
    books(q: { article: string } | { concept: string }): Promise<Answer<BooksData>>
    renderings(q: { strong: string } | { book: string; word: number }): Promise<Answer<RenderingsData>>
    search(text: string, filters?: { books?: string[]; kinds?: string[]; limit?: number }): Promise<Answer<unknown[]>>
  }
}
