/**
 * The diary of a book: every change to a verse, with who made it and from which text. Nothing in it is ever
 * rewritten; changes and decisions are only added.
 */
import { placeId, placesOf, samePlace, textOfRange, type BookPlace } from "./book";
import { textKey } from "./textKey";
import { personKey, type BookState, type Entry, type Person, type PersonKey, type Place } from "./types";

/** The highest running number of `by` this diary holds: how far this book has taken in that person's changes. */
export function seenUpTo(state: Pick<BookState, "journal">, by: PersonKey): number {
  let max = 0;
  for (const entry of state.journal) if (entry.by === by && entry.seq > max) max = entry.seq;
  return max;
}

/** The change that left `place` with the text of key `key`: the last one in the diary for that place and text. */
export function producerOf(state: Pick<BookState, "journal">, place: Place, key: string): Entry | undefined {
  for (let i = state.journal.length - 1; i >= 0; i--) {
    const entry = state.journal[i]!;
    if (entry.key === key && samePlace(entry.place, place)) return entry;
  }
  return undefined;
}

export function entry(params: {
  by: PersonKey;
  seq: number;
  place: Place;
  base: string;
  text: string;
  at: string;
  kind?: Entry["kind"];
  over?: string[];
  after?: string[];
}): Entry {
  const { by, seq, place, base, text, at } = params;
  return {
    id: `${by}#${seq}`,
    by,
    seq,
    place: { chapter: place.chapter, from: place.from, to: place.to },
    base,
    text,
    key: textKey(text),
    at,
    kind: params.kind ?? "edit",
    ...(params.over ? { over: params.over } : {}),
    ...(params.after?.length ? { after: params.after } : {}),
  };
}

/**
 * The changes `person` made by turning the book `before` into `after`, one per place whose text changed. A place
 * that is new (a bridge where there were separate verses, or the reverse) counts as changed, and its base is the
 * text that range had before.
 */
export function changesBetween(before: string, after: string, person: Person, firstSeq: number, at: string): Entry[] {
  const old = placesOf(before);
  const byId = new Map(old.map((place) => [placeId(place), place]));
  const out: Entry[] = [];
  for (const place of placesOf(after)) {
    const was: BookPlace | undefined = byId.get(placeId(place));
    const baseText = was ? was.text : textOfRange(old, place);
    if (was && was.key === place.key) continue;
    if (!was && !place.text && !baseText) continue;
    out.push(entry({ by: personKey(person), seq: firstSeq + out.length, place, base: textKey(baseText), text: place.text, at }));
  }
  return out;
}

/** A new book from a file someone already has: every verse with text is a change of theirs, from empty. */
export function startBook(params: { book: string; usfm: string; person: Person; at: string }): BookState {
  const journal = changesBetween("", params.usfm, params.person, 1, params.at);
  return { book: params.book, usfm: params.usfm, journal, pending: [] };
}

/** What `person` wrote: the book becomes `usfm`, and each verse they changed goes into the diary. */
export function recordEdits(state: BookState, person: Person, usfm: string, at: string): BookState {
  const changes = changesBetween(state.usfm, usfm, person, seenUpTo(state, personKey(person)) + 1, at);
  if (!changes.length && usfm === state.usfm) return state;
  return { ...state, usfm, journal: [...state.journal, ...changes] };
}
