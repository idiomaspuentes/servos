import { describe, expect, it } from "vitest";
import { alignmentPlaceId, decideAlignment, emptyAlignmentLayer, mergeAlignments, recordAlignment, type AlignmentLayer, type AlignmentPlace } from "./alignment";
import type { Person } from "./types";

const ana: Person = { name: "Ana", device: "tel-ana" };
const anaOtra: Person = { name: "Ana", device: "compu-ana" };
const beto: Person = { name: "Beto", device: "tel-beto" };

const v1: AlignmentPlace = { chapter: 1, verse: 1, source: "UGNT" };
const texto = "Pablo, siervo de Dios";
let clock = 0;
const at = () => new Date(Date.UTC(2026, 9, 16, 8, 0, clock++)).toISOString();

/** An alignment made of a verse: its links, as the aligner keeps them (here, a few words linked). */
const links = (...words: string[]) => words.map((w) => ({ sources: [w], targets: [w] }));
const now = (text: string) => () => text;
const aligned = (layer: AlignmentLayer) => layer.current[alignmentPlaceId(v1)]?.groups;

describe("la alineación sigue a su texto", () => {
  it("entra la que solo tiene la otra copia", () => {
    const theirs = recordAlignment(emptyAlignmentLayer(), beto, v1, texto, links("Pablo"), at());
    const { layer, report } = mergeAlignments(emptyAlignmentLayer(), theirs, now(texto), ana, at());
    expect(aligned(layer)).toEqual(links("Pablo"));
    expect([report.taken.length, report.review.length]).toEqual([1, 0]);
  });

  it("gana la que se hizo sobre el texto que queda, aunque sea más vieja", () => {
    const mine = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const theirs = recordAlignment(emptyAlignmentLayer(), beto, v1, "Pablo, esclavo de Dios", links("esclavo"), at());
    expect(aligned(mergeAlignments(mine, theirs, now(texto), ana, at()).layer)).toEqual(links("Pablo"));
    expect(aligned(mergeAlignments(theirs, mine, now(texto), ana, at()).layer)).toEqual(links("Pablo"));
  });

  it("una que entra hecha sobre otro texto queda, para revisar: nada se pierde en silencio", () => {
    const theirs = recordAlignment(emptyAlignmentLayer(), beto, v1, "Pablo, esclavo de Dios", links("Pablo"), at());
    const { layer, report } = mergeAlignments(emptyAlignmentLayer(), theirs, now(texto), ana, at());
    expect(aligned(layer)).toEqual(links("Pablo"));
    expect(report.review).toEqual([v1]);
  });
});

describe("dos alineaciones del mismo texto", () => {
  it("si una salió de la otra, queda la que vino después", () => {
    const first = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const then = recordAlignment(first, beto, v1, texto, links("Pablo", "Dios"), at());
    expect(aligned(mergeAlignments(first, then, now(texto), ana, at()).layer)).toEqual(links("Pablo", "Dios"));
    // And the newer copy does not go back when the older comes again.
    const back = mergeAlignments(then, first, now(texto), beto, at());
    expect([aligned(back.layer), back.report.conflicts.length]).toEqual([links("Pablo", "Dios"), 0]);
  });

  it("si las hizo la misma persona por separado (en dos aparatos), queda la más reciente", () => {
    const tel = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const compu = recordAlignment(emptyAlignmentLayer(), anaOtra, v1, texto, links("Dios"), at());
    const { layer, report } = mergeAlignments(tel, compu, now(texto), ana, at());
    expect([aligned(layer), report.conflicts.length]).toEqual([links("Dios"), 0]);
  });

  it("si las hicieron dos personas por separado, es un choque; lo elegido no se vuelve a preguntar", () => {
    const mine = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const theirs = recordAlignment(emptyAlignmentLayer(), beto, v1, texto, links("Dios"), at());
    const first = mergeAlignments(mine, theirs, now(texto), ana, at());
    expect([aligned(first.layer), first.report.conflicts.length]).toEqual([links("Pablo"), 1]);
    // Bringing it again before choosing does not ask twice.
    expect(mergeAlignments(first.layer, theirs, now(texto), ana, at()).layer.pending).toHaveLength(1);
    const chosen = decideAlignment(first.layer, first.layer.pending[0].id, "theirs", ana, at());
    expect([aligned(chosen), chosen.pending.length]).toEqual([links("Dios"), 0]);
    // The choice travels: Ana's copy, brought to someone who still has Ana's first alignment, is not asked again.
    const again = mergeAlignments(mine, chosen, now(texto), beto, at());
    expect([aligned(again.layer), again.report.conflicts.length]).toEqual([links("Dios"), 0]);
    // And Beto's copy coming again to Ana's settles by the choice.
    const later = mergeAlignments(chosen, theirs, now(texto), ana, at());
    expect([aligned(later.layer), later.report.conflicts.length]).toEqual([links("Dios"), 0]);
  });

  it("guarda en el diario cada alineación, con la que reemplazó", () => {
    const one = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const two = recordAlignment(one, ana, v1, texto, links("Pablo", "Dios"), at());
    expect(two.journal.map((e) => [e.by, e.seq, e.base === "" ? "nada" : e.base === one.journal[0].key ? "la primera" : "?"])).toEqual([
      ["Ana@tel-ana", 1, "nada"],
      ["Ana@tel-ana", 2, "la primera"],
    ]);
    // The same alignment again is not a new line.
    expect(recordAlignment(two, ana, v1, texto, links("Pablo", "Dios"), at())).toBe(two);
  });
});
