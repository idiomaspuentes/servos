/**
 * Bringing another copy of the book into this one, verse by verse (design, section 6). What does not clash joins
 * by itself; only two changes of the same place from the same text, made apart, reach a person. Their decision goes
 * into the diary, travels with the book, and is not asked again. A choice still open travels too: whoever receives the
 * book sees it where they have one of its two versions, and a decision made anywhere settles it everywhere.
 */
import { intersects, placeId, placesOf, putRangeAsIs, usfmOfRange, type BookPlace } from "./book";
import { entry, producerOf, seenUpTo } from "./journal";
import { personKey, type BookState, type Conflict, type Entry, type Person, type Place } from "./types";

/** What a merge did, place by place. */
export type MergeReport = {
  /** Places that now have the other copy's text. */
  taken: Place[];
  /** Places where this copy's text stays although the other one differs (it was already seen, or is older). */
  kept: Place[];
  /** Places settled by a decision somebody already took between those same two versions. */
  decided: Place[];
  /** New conflicts, left for a person. */
  conflicts: Conflict[];
  /** How many changes of the other copy's diary were new here. */
  newEntries: number;
};

type Verdict = "keep" | "take" | "decided-keep" | "decided-take" | "conflict";

/**
 * Decides one place both copies have with the same range. `mine` and `theirs` are their texts; the diaries tell
 * which change left each text there and whether the other copy has already taken it in.
 */
function verdictFor(params: { place: Place; mine: BookPlace; theirs: BookPlace; me: BookState; other: BookState; decisions: Entry[] }): Verdict {
  const { place, mine, theirs, me, other } = params;
  if (mine.key === theirs.key) return "keep";
  // An empty verse is one never written, or one emptied on purpose: then the diary has the change that emptied it,
  // with the text it took away, and it is weighed as any other change (it does not bring back what was taken away,
  // and what was changed after it is not lost to it).
  if (!theirs.text) {
    const emptied = producerOf(other, place, theirs.key);
    if (!emptied || seenUpTo(me, emptied.by) >= emptied.seq) return "keep";
    if (emptied.base === mine.key) return "take";
  } else if (!mine.text) {
    const emptied = producerOf(me, place, mine.key);
    if (!emptied || seenUpTo(other, emptied.by) >= emptied.seq) return "take";
    if (emptied.base === theirs.key) return "keep";
  }
  // Somebody already chose between exactly these two versions.
  const decision = [...params.decisions].reverse().find((row) => row.over?.includes(mine.key) && row.over.includes(theirs.key) && intersects(row.place, place));
  if (decision?.key === mine.key) return "decided-keep";
  if (decision?.key === theirs.key) return "decided-take";
  // Either copy still waits for a person to choose between these two: having taken the other's change in its diary is
  // not having chosen it.
  const pair = [mine.key, theirs.key].sort().join("|");
  if ([...me.pending, ...other.pending].some((c) => [c.mine.key, c.theirs.key].sort().join("|") === pair && intersects(c.place, place))) return "conflict";
  const theirsBy = producerOf(other, place, theirs.key);
  const mineBy = producerOf(me, place, mine.key);
  // A decision between this text and another (a new one written while deciding, perhaps) comes after it.
  if (theirsBy?.kind === "decision" && theirsBy.over?.includes(mine.key)) return "take";
  if (mineBy?.kind === "decision" && mineBy.over?.includes(theirs.key)) return "keep";
  // Their text came from a change this copy has already taken in: what is here now came after it.
  if (theirsBy && seenUpTo(me, theirsBy.by) >= theirsBy.seq) return "keep";
  // This copy's text came from a change they had already taken in: theirs came after it.
  if (mineBy && seenUpTo(other, mineBy.by) >= mineBy.seq) return "take";
  // Made apart, but one of them started from the other's text.
  if (theirsBy && theirsBy.base === mine.key) return "take";
  if (mineBy && mineBy.base === theirs.key) return "keep";
  return "conflict";
}

/** Groups of places of both copies that overlap, per chapter: a bridge and the verses it covers are one group. */
function groups(mine: BookPlace[], theirs: BookPlace[]): { range: Place; mine: BookPlace[]; theirs: BookPlace[] }[] {
  const all = [...mine.map((place) => ({ place, side: 0 })), ...theirs.map((place) => ({ place, side: 1 }))].sort(
    (a, b) => a.place.chapter - b.place.chapter || a.place.from - b.place.from || a.side - b.side,
  );
  const out: { range: Place; mine: BookPlace[]; theirs: BookPlace[] }[] = [];
  for (const { place, side } of all) {
    const last = out[out.length - 1];
    if (last && intersects(last.range, place)) {
      last.range = { chapter: place.chapter, from: Math.min(last.range.from, place.from), to: Math.max(last.range.to, place.to) };
      (side ? last.theirs : last.mine).push(place);
    } else {
      out.push({ range: { chapter: place.chapter, from: place.from, to: place.to }, mine: side ? [] : [place], theirs: side ? [place] : [] });
    }
  }
  return out;
}

const conflictId = (place: Place, a: string, b: string): string => `${placeId(place)}:${[a, b].sort().join("|")}`;

/** The key of what a copy says over a stretch: its place's, or its places' joined (as a structure conflict keeps it). */
const keyOver = (places: BookPlace[], range: Place): string =>
  places
    .filter((place) => intersects(place, range))
    .map((place) => place.key)
    .join("+");

/** Somebody already chose between a conflict's two versions. */
const settledBy = (decisions: Entry[], c: Conflict): boolean =>
  decisions.some((row) => row.over?.includes(c.mine.key) && row.over.includes(c.theirs.key) && intersects(row.place, c.place));

/**
 * Brings `other` into `me`. The book takes the other copy's verses where they win, the diary takes in every change
 * of theirs it did not have, and each real conflict is left in `pending` (one already pending is not added twice).
 * `by` is whoever is merging; `at` is when.
 */
export function mergeInto(me: BookState, other: BookState, by: Person, at: string): { state: BookState; report: MergeReport } {
  if (me.book !== other.book) throw new Error(`No se pueden mezclar libros distintos: ${me.book} y ${other.book}.`);
  const report: MergeReport = { taken: [], kept: [], decided: [], conflicts: [], newEntries: 0 };
  const decisions = [...me.journal, ...other.journal].filter((row) => row.kind === "decision");
  const pendingIds = new Set(me.pending.map((row) => row.id));
  let usfm = me.usfm;

  const take = (range: Place) => {
    usfm = putRangeAsIs(usfm, other.usfm, range);
    report.taken.push(range);
  };
  const conflict = (place: Place, kind: Conflict["kind"], mineText: string, mineKey: string, theirsText: string, theirsKey: string) => {
    const id = conflictId(place, mineKey, theirsKey);
    if (pendingIds.has(id)) return;
    pendingIds.add(id);
    report.conflicts.push({
      id,
      place,
      kind,
      mine: { text: mineText, key: mineKey, ...(producerOf(me, place, mineKey) ? { by: producerOf(me, place, mineKey)!.by } : {}) },
      theirs: { text: theirsText, key: theirsKey, ...(producerOf(other, place, theirsKey) ? { by: producerOf(other, place, theirsKey)!.by } : {}), usfm: usfmOfRange(other.usfm, place) },
      foundAt: at,
      foundBy: personKey(by),
    });
  };

  for (const group of groups(placesOf(me.usfm), placesOf(other.usfm))) {
    const [mine] = group.mine;
    const [theirs] = group.theirs;
    if (group.mine.length === 1 && group.theirs.length === 1 && mine!.from === theirs!.from && mine!.to === theirs!.to) {
      const place: Place = { chapter: mine!.chapter, from: mine!.from, to: mine!.to };
      const verdict = verdictFor({ place, mine: mine!, theirs: theirs!, me, other, decisions });
      if (verdict === "take") take(place);
      else if (verdict === "decided-take") {
        usfm = putRangeAsIs(usfm, other.usfm, place);
        report.decided.push(place);
      } else if (verdict === "decided-keep") report.decided.push(place);
      else if (verdict === "conflict") conflict(place, "texto", mine!.text, mine!.key, theirs!.text, theirs!.key);
      else if (mine!.key !== theirs!.key) report.kept.push(place);
      continue;
    }
    // Only one copy has these verses, or they are written with different ranges (a bridge against separate verses).
    const mineFilled = group.mine.some((place) => place.text);
    const theirsFilled = group.theirs.some((place) => place.text);
    if (!theirsFilled) continue;
    if (!mineFilled) {
      take(group.range);
      continue;
    }
    // The verses are divided differently, and both copies have text. If every verse of one side came from changes
    // the other copy had already taken in, the other side is the newer division; otherwise a person decides, even
    // when the words are the same: where a verse begins is part of the translation.
    const filled = (places: BookPlace[]) => places.filter((place) => place.text);
    const seenBy = (places: BookPlace[], from: BookState, by: BookState) =>
      filled(places).every((place) => {
        const made = producerOf(from, place, place.key);
        return Boolean(made) && seenUpTo(by, made!.by) >= made!.seq;
      });
    if (seenBy(group.theirs, other, me)) {
      report.kept.push(group.range);
      continue;
    }
    if (seenBy(group.mine, me, other)) {
      take(group.range);
      continue;
    }
    const join = (places: BookPlace[]) => places.map((place) => place.text).filter(Boolean).join(" ");
    conflict(group.range, "estructura", join(group.mine), group.mine.map((p) => p.key).join("+"), join(group.theirs), group.theirs.map((p) => p.key).join("+"));
  }

  // The other copy's choices still open: each comes where this copy says one of its two versions, set from this side
  // (what is here, against the other one). Where this copy says something else, it was already gone past here.
  const pairs = new Set([...me.pending, ...report.conflicts].map((c) => conflictId(c.place, c.mine.key, c.theirs.key)));
  const here = placesOf(usfm);
  let there: BookPlace[] | null = null;
  for (const open of other.pending) {
    const pair = conflictId(open.place, open.mine.key, open.theirs.key);
    if (pendingIds.has(open.id) || pairs.has(pair) || settledBy(decisions, open)) continue;
    const now = keyOver(here, open.place);
    let carried: Conflict | null = null;
    if (now === open.mine.key) carried = { ...open };
    else if (now === open.theirs.key) {
      there ??= placesOf(other.usfm);
      // Their side is what the other copy says there now: it must still say it.
      if (keyOver(there, open.place) === open.mine.key) {
        carried = {
          ...open,
          mine: { text: open.theirs.text, key: open.theirs.key, ...(open.theirs.by ? { by: open.theirs.by } : {}) },
          theirs: { ...open.mine, usfm: usfmOfRange(other.usfm, open.place) },
        };
      }
    }
    if (!carried) continue;
    pendingIds.add(open.id);
    pairs.add(pair);
    report.conflicts.push(carried);
  }

  const known = new Set(me.journal.map((row) => row.id));
  const incoming = other.journal.filter((row) => !known.has(row.id));
  report.newEntries = incoming.length;
  // A choice open here that somebody decided elsewhere is settled: the decision came with their diary (and its text,
  // through the verdicts above).
  const stillOpen = me.pending.filter((c) => !settledBy(decisions, c));
  const state: BookState = { ...me, usfm, journal: [...me.journal, ...incoming], pending: [...stillOpen, ...report.conflicts] };
  return { state, report };
}

/**
 * A person decides a pending conflict: keep this copy's version, take the other's, or write a new one (`usfm` of
 * the whole book after writing it). The decision goes into the diary with the keys of the two versions, so that
 * pair is not asked again anywhere the book travels.
 */
export function decide(state: BookState, conflictId: string, choice: { keep: "mine" | "theirs" } | { usfm: string }, by: Person, at: string): BookState {
  const conflict = state.pending.find((row) => row.id === conflictId);
  if (!conflict) throw new Error("Ese choque ya no está pendiente.");
  let usfm = state.usfm;
  if ("usfm" in choice) usfm = choice.usfm;
  else if (choice.keep === "theirs") usfm = putRangeAsIs(usfm, conflict.theirs.usfm, conflict.place);
  const now = placesOf(usfm).filter((place) => intersects(place, conflict.place));
  const text = now.map((place) => place.text).filter(Boolean).join(" ");
  const before = placesOf(state.usfm).filter((place) => intersects(place, conflict.place));
  const key = personKey(by);
  const decision = entry({
    by: key,
    seq: seenUpTo(state, key) + 1,
    place: now.length === 1 ? now[0]! : conflict.place,
    base: before.length === 1 ? before[0]!.key : conflict.mine.key,
    text,
    at,
    kind: "decision",
    over: [conflict.mine.key, conflict.theirs.key],
  });
  return { ...state, usfm, journal: [...state.journal, decision], pending: state.pending.filter((row) => row.id !== conflictId) };
}
