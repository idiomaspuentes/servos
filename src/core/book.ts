/**
 * The book as places: every `\v` is one, a bridge is one place covering all its numbers. What is compared is the
 * text as it is read, so changing only the format or the alignment of a verse changes nothing here. Built on the
 * verse merge taken from Taller (`src/usfm`).
 */
import { listVerseSpans, normalizeVerseText } from "../usfm/usfmEdit";
import { patchTrunkByVerse } from "../usfm/usfmTrunkPatch";
import { verseSlotsOf } from "../usfm/usfmVerseMerge";
import { textKey } from "./textKey";
import type { Place } from "./types";

export type BookPlace = Place & { text: string; key: string };

export const placeId = (place: Place): string => `${place.chapter}:${place.from}-${place.to}`;

export const samePlace = (a: Place, b: Place): boolean => a.chapter === b.chapter && a.from === b.from && a.to === b.to;

export const intersects = (a: Place, b: Place): boolean => a.chapter === b.chapter && a.from <= b.to && b.from <= a.to;

/** Every place of the book with its text as it is read, in book order. */
export function placesOf(usfm: string): BookPlace[] {
  return verseSlotsOf(usfm).map((slot) => {
    const text = normalizeVerseText(slot.text);
    return { chapter: slot.chapter, from: slot.from, to: slot.to, text, key: textKey(text) };
  });
}

/** The text of a range as one string: the texts of the places inside it, in order. */
export function textOfRange(places: BookPlace[], range: Place): string {
  return places
    .filter((place) => intersects(place, range))
    .map((place) => place.text)
    .filter(Boolean)
    .join(" ");
}

/**
 * The USFM of a range of a book, enough to put those verses into another copy of it: its header, the chapter
 * marker, and the verses as they are written (with their notes, poetry and alignment).
 */
export function usfmOfRange(usfm: string, range: Place): string {
  const spans = listVerseSpans(usfm).filter((span) => span.chapter === range.chapter && span.verse <= range.to && span.verseTo >= range.from);
  if (!spans.length) return "";
  const head = usfm.slice(0, Math.max(0, usfm.search(/\\c\s+\d+/))).trimEnd();
  const body = usfm.slice(spans[0]!.start, spans[spans.length - 1]!.end).trimEnd();
  return `${head ? `${head}\n` : ""}\\c ${range.chapter}\n${body}\n`;
}

/**
 * Puts the verses of `range` from `source` into `book`, leaving everything else byte for byte. `source` may be a
 * whole book or just those verses (`usfmOfRange`).
 */
export function putRange(book: string, source: string, range: Place): string {
  return patchTrunkByVerse(book, [source], { ancestor: book, scope: range }).usfm;
}
