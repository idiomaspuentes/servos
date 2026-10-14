/**
 * The data of a book being translated, as it travels in a work package: the USFM, the diary of every change to a
 * verse, and the conflicts found on this device that nobody has decided yet.
 */

/** A person of an installation: the name they typed and the id the app gave that device. Shown by name only. */
export type Person = { name: string; device: string };

/** `name@device`: how a person is written in the diary, so two Juans of two villages are told apart. */
export type PersonKey = string;

/** A place in the book: `\v 3` is `(c, 3, 3)`, a bridge `\v 3-4` is `(c, 3, 4)`. */
export type Place = { chapter: number; from: number; to: number };

/**
 * One line of the diary. Every change to a verse is one, and so is every decision of a merge: who, their own
 * running number, the place, the text the verse had before (by its key) and the text it has after.
 */
export type Entry = {
  /** `by#seq`: the same change keeps its id on every device it reaches. */
  id: string;
  by: PersonKey;
  /** Running number of this person's changes, from 1. */
  seq: number;
  place: Place;
  /** Key of the text the verse had when the change was made; `""` when it was empty. */
  base: string;
  /** The text as it is read (no alignment, notes as anchors, spaces collapsed), and its key. */
  text: string;
  key: string;
  at: string;
  kind: "edit" | "decision";
  /** For a decision: the keys of the versions that were compared. The same pair is not asked again. */
  over?: string[];
};

/** Two versions of a place that both changed from the same text: a person decides. */
export type Conflict = {
  id: string;
  place: Place;
  /** `texto`: same place, two texts. `estructura`: a bridge against separate verses, both with text. */
  kind: "texto" | "estructura";
  mine: { text: string; key: string; by?: PersonKey };
  theirs: {
    text: string;
    key: string;
    by?: PersonKey;
    /** The USFM of their verses, enough to put them in the book if they are chosen. */
    usfm: string;
  };
  foundAt: string;
  foundBy: PersonKey;
};

export type BookState = {
  /** Three-letter book code, e.g. `EZR`. */
  book: string;
  usfm: string;
  journal: Entry[];
  pending: Conflict[];
};

export const personKey = (person: Person): PersonKey => `${person.name.trim()}@${person.device.trim()}`;
