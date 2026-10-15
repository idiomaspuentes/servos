/**
 * The part of usfm-ast (`../usfm-ast/packages`) that Servos uses for the alignment, declared here so Servos's strict
 * compiler checks only Servos's code, as `src/resources/btSynergy.d.ts` does for bt-synergy. At run time Vite and
 * Vitest load the real sources (vite.config.ts), and `src/app/projects/alignment.test.ts` runs against them, so a
 * signature that changes there shows up as a failing test here.
 */

declare module '@usfm-tools/types' {
  /** A word of the source a link holds (the original's, or a bridge text's). */
  export interface OriginalWord {
    strong: string
    lemma: string
    morph?: string
    content: string
    occurrence: number
    occurrences: number
  }
  /** A word of the translation a link holds. */
  export interface AlignedWord {
    word: string
    occurrence: number
    occurrences: number
  }
  /** One link: words of the source and the words of the translation that translate them (1:1, 1:N, N:1, N:M). */
  export interface AlignmentGroup {
    sources: OriginalWord[]
    targets: AlignedWord[]
  }
}

declare module '@usfm-tools/editor-core' {
  import type { AlignmentGroup, OriginalWord } from '@usfm-tools/types'
  export type WordToken = { verseSid: string; surface: string; occurrence: number; occurrences: number; index: number }
  export type OriginalWordToken = WordToken & { strong: string; lemma: string; morph?: string }
  export function tokenizeWords(line: string): string[]
  export function normalizeWordForAlignmentMatch(s: string): string
  export function alignmentWordSurfacesEqual(a: string, b: string): boolean
  export function lcsWordAlignment(oldWords: string[], newWords: string[]): { oldKept: Set<number>; newKept: Set<number>; pairing: Map<number, number> }
  export function reconcileAlignments(oldVerseText: string, newVerseText: string, groups: AlignmentGroup[]): AlignmentGroup[]
  export function originalWordMatchesToken(ow: OriginalWord, tok: OriginalWordToken): boolean
}

declare module '@usfm-ast/alignment-box-model' {
  import type { AlignedWord, AlignmentGroup } from '@usfm-tools/types'
  import type { OriginalWordToken, WordToken } from '@usfm-tools/editor-core'
  /** A box: the source words it holds (`targetTokens`, in its terms) and the translation words put in it. */
  export type AlignmentBoxModel = {
    id: string
    targetTokens: OriginalWordToken[]
    targetTokenIndices: number[]
    alignedSourceWords: AlignedWord[]
    groupIndex: number | null
  }
  export function deriveAlignmentBoxes(refTok: OriginalWordToken[], groups: AlignmentGroup[], trTok: WordToken[]): AlignmentBoxModel[]
  export function computeAlignedSourceIndices(trTok: WordToken[], boxes: AlignmentBoxModel[]): boolean[]
  export function addSourcesToBox(refTok: OriginalWordToken[], trTok: WordToken[], groups: AlignmentGroup[], boxId: string, transIndices: number[]): AlignmentGroup[]
  export function removeSourcesFromBox(refTok: OriginalWordToken[], trTok: WordToken[], groups: AlignmentGroup[], boxId: string, transIndices: number[]): AlignmentGroup[]
  export function mergeAlignmentBoxes(
    refTok: OriginalWordToken[],
    trTok: WordToken[],
    groups: AlignmentGroup[],
    boxIds: string[],
    anchorBoxId: string
  ): AlignmentGroup[] | null
  export function splitAlignmentGroupPure(refTok: OriginalWordToken[], trTok: WordToken[], groups: AlignmentGroup[], groupIndex: number): AlignmentGroup[] | null
  export function transIndexForAlignedWord(trTok: WordToken[], aw: AlignedWord): number | null
  export function orderedAlignedTransIndices(box: AlignmentBoxModel, trTok: WordToken[]): number[]
}
