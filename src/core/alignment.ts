/**
 * The alignment of a book, a layer apart from its text (design, 6.8): for each verse and each text it is aligned with
 * (the bridge text, the original), the links between their words, with the verse's text they were made on. Like the
 * text, it has a diary: every alignment a person makes of a verse is a line of it, with the alignment it replaced, so
 * that two copies brought together know which came after which.
 *
 * Bringing another copy's alignment in follows the text that stays:
 * - an alignment made on the verse's text as it is now wins over one made on another text;
 * - one this copy has already taken in, or that the other started from, gives way to the newer;
 * - a choice somebody already made between two alignments is applied again; two choices made apart that keep
 *   different alignments are asked again (one made knowing the other replaces it);
 * - two alignments of the same text made apart: the latest, if one person made both; a conflict for a person, if two
 *   people did (decided on 14 October 2026).
 * An alignment that comes in made on another text than the one that stays is kept and said to need review: the links
 * of the words that stayed still hold, and nothing is lost in silence.
 */
import { textKey } from "./textKey";
import { personKey, type Person, type PersonKey } from "./types";

/** Where an alignment is: a verse, and the text it is aligned with (`UGNT`, `TPL`…). */
export type AlignmentPlace = { chapter: number; verse: number; source: string };

export const alignmentPlaceId = (p: AlignmentPlace): string => `${p.chapter}:${p.verse}:${p.source}`;

/** One line of the alignment's diary: an alignment of a verse, or a choice between two. */
export type AlignmentEntry = {
  /** `by#seq`: the same alignment keeps its id on every device it reaches. */
  id: string;
  by: PersonKey;
  seq: number;
  place: AlignmentPlace;
  /** The verse's text it was made on. */
  on: string;
  /** The links, as the aligner keeps them; and their key. */
  groups: unknown;
  key: string;
  /** Key of the alignment this one replaced here, `""` when there was none. */
  base: string;
  at: string;
  kind: "edit" | "decision";
  /** For a decision: the keys of the two alignments chosen between. */
  over?: string[];
  /** For a decision: the decisions of that place it was made knowing (by id), which it replaces. */
  after?: string[];
};

/** Two alignments of the same verse's same text, made apart by two people: a person chooses. */
export type AlignmentConflict = {
  id: string;
  place: AlignmentPlace;
  mine: AlignmentEntry;
  theirs: AlignmentEntry;
  foundAt: string;
  foundBy: PersonKey;
};

export type AlignmentLayer = {
  /** The alignment that counts at each place, by `alignmentPlaceId`. */
  current: Record<string, AlignmentEntry>;
  journal: AlignmentEntry[];
  pending: AlignmentConflict[];
};

export const emptyAlignmentLayer = (): AlignmentLayer => ({ current: {}, journal: [], pending: [] });

/** The key of an alignment's links. */
export const alignmentKey = (groups: unknown): string => textKey(JSON.stringify(groups ?? []));

const nameOf = (key: PersonKey) => key.slice(0, key.lastIndexOf("@"));

function seenUpTo(layer: AlignmentLayer, by: PersonKey): number {
  let max = 0;
  for (const e of layer.journal) if (e.by === by && e.seq > max) max = e.seq;
  return max;
}

/** `person` aligned a verse: it becomes the alignment that counts there, and a line of the diary. */
export function recordAlignment(layer: AlignmentLayer, person: Person, place: AlignmentPlace, on: string, groups: unknown, at: string): AlignmentLayer {
  const id = alignmentPlaceId(place);
  const key = alignmentKey(groups);
  const now = layer.current[id];
  if (now && now.key === key && now.on === on) return layer;
  const by = personKey(person);
  const seq = seenUpTo(layer, by) + 1;
  const entry: AlignmentEntry = { id: `${by}#${seq}`, by, seq, place: { ...place }, on, groups, key, base: now?.key ?? "", at, kind: "edit" };
  return { ...layer, current: { ...layer.current, [id]: entry }, journal: [...layer.journal, entry] };
}

/** What bringing another copy's alignment in did. */
export type AlignmentReport = {
  /** Places that now have the other copy's alignment. */
  taken: AlignmentPlace[];
  /** Of those, the ones made on another text than the verse has now: their links are to be reviewed. */
  review: AlignmentPlace[];
  /** Places settled by a choice somebody had already made. */
  decided: AlignmentPlace[];
  conflicts: AlignmentConflict[];
};

/**
 * Brings `other`'s alignment into `me`. `textNow` is the verse's text in this copy now (after its text was brought
 * in): what an alignment was made on is weighed against it. `by` is who brings it in; `at`, when.
 */
export function mergeAlignments(
  me: AlignmentLayer,
  other: AlignmentLayer,
  textNow: (place: AlignmentPlace) => string,
  by: Person,
  at: string,
): { layer: AlignmentLayer; report: AlignmentReport } {
  const report: AlignmentReport = { taken: [], review: [], decided: [], conflicts: [] };
  const current = { ...me.current };
  const decisions = [...me.journal, ...other.journal].filter((e) => e.kind === "decision");
  const pendingIds = new Set(me.pending.map((c) => c.id));
  const take = (id: string, theirs: AlignmentEntry, list: AlignmentPlace[] = report.taken) => {
    current[id] = theirs;
    list.push(theirs.place);
    if (theirs.on.trim() !== textNow(theirs.place).trim()) report.review.push(theirs.place);
  };

  for (const [id, theirs] of Object.entries(other.current)) {
    const mine = me.current[id];
    if (!mine) {
      take(id, theirs);
      continue;
    }
    if (mine.key === theirs.key && mine.on === theirs.on) continue;
    const now = textNow(theirs.place).trim();
    const mineOn = mine.on.trim() === now;
    const theirsOn = theirs.on.trim() === now;
    // The one made on the text that stays wins over one made on another.
    if (mineOn && !theirsOn) continue;
    if (theirsOn && !mineOn) {
      take(id, theirs);
      continue;
    }
    if (!mineOn && !theirsOn) {
      // Neither on the text that stays: the newer is kept, to be reviewed.
      if (theirs.at > mine.at) take(id, theirs);
      continue;
    }
    // Both on the text that stays. A choice already made between these two is applied; one made knowing an earlier one
    // replaces it; two made apart that keep different alignments are not settled: a person chooses again.
    const over = decisions.filter((d) => alignmentPlaceId(d.place) === id && d.over?.includes(mine.key) && d.over.includes(theirs.key));
    const kept = new Set(over.filter((d) => !over.some((o) => o.after?.includes(d.id))).map((d) => d.key));
    if (kept.size === 1 && kept.has(mine.key)) {
      report.decided.push(mine.place);
      continue;
    }
    if (kept.size === 1 && kept.has(theirs.key)) {
      take(id, theirs, report.decided);
      continue;
    }
    const apart = kept.size > 1;
    // Either copy still waits for a person to choose between these two: having them in its diary is not choosing.
    const open = [...me.pending, ...other.pending].some(
      (c) => alignmentPlaceId(c.place) === id && [c.mine.key, c.theirs.key].sort().join("|") === [mine.key, theirs.key].sort().join("|"),
    );
    if (!open && !apart) {
      if (seenUpTo(me, theirs.by) >= theirs.seq) continue;
      if (seenUpTo(other, mine.by) >= mine.seq) {
        take(id, theirs);
        continue;
      }
      if (theirs.base === mine.key) {
        take(id, theirs);
        continue;
      }
      if (mine.base === theirs.key) continue;
      // Made apart: the latest, if one person made both; else a person chooses.
      if (nameOf(mine.by) === nameOf(theirs.by)) {
        if (theirs.at > mine.at) take(id, theirs);
        continue;
      }
    }
    const conflictId = `${id}:${[mine.key, theirs.key].sort().join("|")}`;
    if (pendingIds.has(conflictId)) continue;
    pendingIds.add(conflictId);
    report.conflicts.push({ id: conflictId, place: { ...mine.place }, mine, theirs, foundAt: at, foundBy: personKey(by) });
  }

  // The other copy's choices still open come where this copy has one of their two alignments; one decided anywhere
  // is settled here too.
  const settled = (c: AlignmentConflict) =>
    decisions.some((d) => alignmentPlaceId(d.place) === alignmentPlaceId(c.place) && d.over?.includes(c.mine.key) && d.over.includes(c.theirs.key));
  const same = (a: AlignmentEntry | undefined, b: AlignmentEntry) => Boolean(a) && a!.key === b.key && a!.on === b.on;
  for (const open of other.pending) {
    if (pendingIds.has(open.id) || settled(open)) continue;
    const now = current[alignmentPlaceId(open.place)];
    if (same(now, open.mine)) report.conflicts.push({ ...open });
    else if (same(now, open.theirs) && same(other.current[alignmentPlaceId(open.place)], open.mine)) report.conflicts.push({ ...open, mine: open.theirs, theirs: open.mine });
    else continue;
    pendingIds.add(open.id);
  }

  const known = new Set(me.journal.map((e) => e.id));
  const journal = [...me.journal, ...other.journal.filter((e) => !known.has(e.id))];
  return { layer: { current, journal, pending: [...me.pending.filter((c) => !settled(c)), ...report.conflicts] }, report };
}

/** A person chooses between two alignments of a verse: the choice is a line of the diary, not asked again anywhere. */
export function decideAlignment(layer: AlignmentLayer, conflictId: string, keep: "mine" | "theirs", by: Person, at: string): AlignmentLayer {
  const conflict = layer.pending.find((c) => c.id === conflictId);
  if (!conflict) throw new Error("Ese choque de alineación ya no está pendiente.");
  const chosen = keep === "mine" ? conflict.mine : conflict.theirs;
  const who = personKey(by);
  const seq = seenUpTo(layer, who) + 1;
  const decision: AlignmentEntry = {
    ...chosen,
    id: `${who}#${seq}`,
    by: who,
    seq,
    base: conflict.mine.key,
    at,
    kind: "decision",
    over: [conflict.mine.key, conflict.theirs.key],
    after: layer.journal.filter((e) => e.kind === "decision" && alignmentPlaceId(e.place) === alignmentPlaceId(conflict.place)).map((e) => e.id),
  };
  // What counts is the alignment chosen, as its maker made it; the decision says it was chosen.
  return {
    current: { ...layer.current, [alignmentPlaceId(conflict.place)]: chosen },
    journal: [...layer.journal, decision],
    pending: layer.pending.filter((c) => c.id !== conflictId),
  };
}
