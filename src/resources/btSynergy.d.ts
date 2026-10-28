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
