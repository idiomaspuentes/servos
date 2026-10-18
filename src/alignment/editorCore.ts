/**
 * The part of usfm-ast's `@usfm-tools/editor-core` the alignment needs, and nothing more: how a verse is split into
 * words, how words are compared for alignment, and how links follow a verse's words when its text changes. The whole
 * package brings git and an XML parser with it; the box model (`@usfm-ast/alignment-box-model`) imports these names
 * from it, and this file is what that import reaches in Servos (`vite.config.ts`).
 */

export { alignmentWordSurfacesEqual, lcsWordAlignment, normalizeWordForAlignmentMatch, tokenizeWords } from 'usfm-ast/usfm-editor-core/src/word-diff'
export { reconcileAlignments } from 'usfm-ast/usfm-editor-core/src/alignment-reconcile'
export { originalWordMatchesToken } from 'usfm-ast/usfm-editor-core/src/alignment-provenance'
export type { OriginalWordToken, WordToken } from 'usfm-ast/usfm-editor-core/src/word-identity'
