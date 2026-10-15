/**
 * What a mini app is, for Servos (design, section 4; philosophy, principle 10). A mini app declares little and draws
 * only its center: the frame (header, position line, helps panel, menus) belongs to the app, and data comes through one
 * door (`MiniAppContext`). One registry, no other: what made tc-study hard to extend was a registry per concern
 * (resource types, panel entries, modes, groups, viewers, loaders, plugins).
 *
 * Mini apps are built into the app for now. Nothing here stops them from being loaded from a pack later: a mini app
 * is plain data plus one component, and it reaches the device's data only through the context it is given.
 */

import type { ComponentType, ReactNode } from 'react'
import type { BaseLanguage, T, Texts } from '../i18n/i18n'
import type { PrototypeData } from '../../prototype/data'
import type { GlossaryEntry } from '../projects/glossary'
import type { Phase } from '../projects/model'

/** What a mini app can ask the device for. The catalog says honestly what is missing (philosophy, principle 8). */
export type ResourceNeed = 'text' | 'notes' | 'questions' | 'words' | 'academy'

/**
 * Where the introductions stand among the verses of a position: before the first verse, the book's (in the first
 * chapter) and then the chapter's, for a mini app that reads them (`MiniApp.intros`).
 */
export const BOOK_INTRO = -1
export const CHAPTER_INTRO = 0

/** A verse at a time, or a section (the translators' sections of the chapter) at a time. */
export type Unit = 'verse' | 'section'

/** Where the person is: a verse of a chapter of a book. */
export interface Position {
  book: string
  chapter: number
  verse: number
}

/** The one door to data. In the prototype it serves a fixed chapter; wired, it reads `src/resources`. */
export interface MiniAppContext {
  t: T
  person: { name: string }
  /** The project the book belongs to: what is shared across its books (its glossary). */
  project: { id: string; name: string; languageCode: string; font?: string }
  data: PrototypeData
  /** The bridge text shown (`TPL` or `TPS`). */
  textAbbreviation: string
  /** The verse texts of the current chapter in the bridge text shown. */
  verseText(verse: number): string
  position: Position
  goTo(position: Position): void
  /** Whether the person works a verse at a time or a section at a time (`MiniApp.sections`). */
  unit: Unit
  /** The verses open: the verse, or every verse of its section. */
  shown: number[]
  /** The chapters of the book on this device, and each one's texts and helps: for a mini app that goes through the book. */
  chapters: number[]
  chapterData(chapter: number): PrototypeData | null
  /** Words of the bridge text to mark in the open verse (from the help the person is reading). */
  marked: string | null
  /** What the frame can do for a mini app. */
  frame: {
    /** Show the other bridge text. */
    switchText(): void
    /** Open the whole chapter in a sheet. */
    showChapter(): void
    /**
     * The helps panel for a mini app that places it itself (`helps: false`), e.g. in a pane: of the open verse, or of
     * the verses given (a section's, all together). With the study's notes on them as «Comments», unless
     * `comments: false` (the study itself, which shows them as its own pane). With the project's `glossary`, its
     * entries about the words of those verses as «Glossary».
     */
    helps(verses?: number[], options?: { comments?: boolean; glossary?: GlossaryEntry[] }): ReactNode
    /** What the header says about the work (philosophy, principle 8): nothing changed yet, or saved on this phone. */
    setSaved(state: 'sinCambios' | 'guardado'): void
    /** Work a verse or a section at a time; the position line then moves by that. Kept for the next visit. */
    setUnit(unit: Unit): void
    /**
     * On to the next verse or section, as the position line's arrow does; or, when this mini app was opened from
     * another one to do something there, back to it: the next verse is not part of what was being done.
     */
    next(): void
    /**
     * Opens another mini app of the project at a place (the editor, to correct a verse while reviewing it); its back
     * arrow returns here.
     */
    open(appId: string, at: Position): void
  }
}

export interface MiniAppCenterProps {
  context: MiniAppContext
}

export interface MiniAppAction {
  /** Text keys of the mini app's own group, or of the frame's. */
  label: string
  /** Whether it is offered where the person is (separating verses, only where some are joined); always, without it. */
  when?(context: MiniAppContext): boolean
  /**
   * Its label when the mini app was opened from another one (the editor from the review), where `frame.next` goes
   * back to it rather than on: «Save and go back». Given `{app}`, the other one's name.
   */
  returning?: string
  description?: string
  run(context: MiniAppContext): void
}

export interface MiniApp {
  /** Stable id, also the group of its texts (`{id}.{name}`). */
  id: string
  /** The step it belongs to. A project chooses which mini apps each step uses. */
  phase: Phase
  /** For a step with several of the same kind (review): what this one looks at, a text key («notas»…). */
  checks?: string
  /** Its texts in the three base languages; `nombre` and `descripcion` are required. */
  texts: Record<BaseLanguage, Texts & { nombre: string; descripcion: string }>
  needs: ResourceNeed[]
  /**
   * What it goes by until the person chooses (with `sections`, in the place sheet): a verse, or a section. Chapter and
   * book come when a mini app needs them.
   */
  unit: Unit
  /** Whether the person may also work a section at a time: then the frame moves by sections and opens all its verses. */
  sections?: boolean
  /**
   * Whether the book starts with its introduction and each chapter with its own, when the notes have them: the frame
   * then stops at them first (`BOOK_INTRO`, `CHAPTER_INTRO` as the verse).
   */
  intros?: boolean
  /** Whether the helps panel shows under its center. */
  helps: boolean
  /**
   * Whether its center takes the height the keyboard leaves: the frame then sizes the screen to what is visible,
   * so a box being written in and what it is translated from are never under the keyboard.
   */
  fills?: boolean
  /** Whether it changes the project's text; then the header says whether the work is saved (philosophy, principle 8). */
  writes: boolean
  /**
   * Whether its work on a verse is done (written, checked…): what the book screen, the chapter list and the verse list
   * count and mark. A mini app without it shows no progress.
   */
  done?(at: Position): boolean
  /**
   * Whether the frame's position line (‹ Jonah 1:2 ›) is shown: not for a mini app that goes by something else than
   * verses and has its own way on (the reviewers go note by note), so the foot has one way on, not two.
   */
  positionLine?: boolean
  /** Its one filled button (philosophy, principle 7), usually leading to the next verse or step. */
  primary?: MiniAppAction
  /** Its "More" menu: what it uses rarely. */
  more?: MiniAppAction[]
  Center: ComponentType<MiniAppCenterProps>
  /** Shown in the catalog but not openable yet. */
  comingSoon?: boolean
}
