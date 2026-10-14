/**
 * The part of bt-synergy (`../bt-synergy/packages`) that Servos uses, declared here so Servos's strict compiler checks
 * only Servos's code: those packages are written with other compiler settings. At run time Vite and Vitest load the
 * real sources (vite.config.ts), and the tests in `src/resources` run against them, so a signature that changes there
 * shows up as a failing test here. Keep each declaration next to where it comes from.
 */

declare module '@bt-synergy/resource-catalog' {
  /** `{tag}#{published_at}`, sanitized; `nostamp` when the row has neither. */
  export function resourceContentStamp(metadata: unknown): string
}

declare module '@bt-synergy/usj-processor' {
  export const USJ_PROCESSING_VERSION: string
}

declare module '@bt-synergy/cache-adapter-indexeddb' {
  export type CacheRow = { key: string; entry: unknown }
  export class IndexedDBCacheAdapter {
    constructor(options?: { dbName?: string; storeName?: string; version?: number })
    get(key: string): Promise<unknown>
    getByPrefix(prefix: string): Promise<CacheRow[]>
    putRawMany(rows: CacheRow[]): Promise<void>
    hasRawKeys(keys: string[]): Promise<Set<string>>
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
  export type PackLayer = 'receipt' | 'sot' | 'prepared' | 'quote' | 'align' | 'text'
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
  export type PackTarget = unknown
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
    overwrite?: boolean
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
}

declare module '@bt-synergy/resource-pipeline/helps/helpsQuoteCache' {
  export const HELPS_QUOTE_VERSION: number
}

declare module '@bt-synergy/resource-pipeline/helps/helpsCacheKeys' {
  export const HELPS_TEXT_VERSION: number
}
