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

describe("un choque de alineación sin decidir viaja", () => {
  it("llega a quien tiene una de las dos, desde su lado; decidido en otro aparato, deja de esperar", () => {
    const mine = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const theirs = recordAlignment(emptyAlignmentLayer(), beto, v1, texto, links("Dios"), at());
    const open = mergeAlignments(mine, theirs, now(texto), ana, at()).layer;
    expect(open.pending).toHaveLength(1);
    // Beto receives Ana's copy: the same choice, his own alignment as «mine».
    const atBeto = mergeAlignments(theirs, open, now(texto), beto, at()).layer;
    expect(atBeto.pending.map((c) => [c.mine.groups, c.theirs.groups])).toEqual([[links("Dios"), links("Pablo")]]);
    // Beto chooses Ana's; Ana receives his copy, and nothing waits any more.
    const decided = decideAlignment(atBeto, atBeto.pending[0]!.id, "theirs", beto, at());
    const back = mergeAlignments(open, decided, now(texto), ana, at()).layer;
    expect(back.pending).toEqual([]);
    expect(aligned(back)).toEqual(links("Pablo"));
  });
});

describe("dos elecciones de alineación tomadas por separado", () => {
  const carla: Person = { name: "Carla", device: "tel-carla" };
  const dani: Person = { name: "Dani", device: "tel-dani" };
  /** Ana and Beto aligned verse 1 apart; Ana's copy has the choice open, and both Carla and Dani take it home. */
  function openChoice() {
    const a = recordAlignment(emptyAlignmentLayer(), ana, v1, texto, links("Pablo"), at());
    const b = recordAlignment(emptyAlignmentLayer(), beto, v1, texto, links("Dios"), at());
    return mergeAlignments(a, b, now(texto), ana, at()).layer;
  }

  it("si eligen distinto, se vuelve a elegir en los dos; nadie se queda con la del otro en silencio", () => {
    const open = openChoice();
    const atCarla = decideAlignment(open, open.pending[0]!.id, "mine", carla, at());
    const atDani = decideAlignment(open, open.pending[0]!.id, "theirs", dani, at());
    const c = mergeAlignments(atCarla, atDani, now(texto), carla, at());
    const d = mergeAlignments(atDani, atCarla, now(texto), dani, at());
    expect([aligned(c.layer), c.report.conflicts.length]).toEqual([links("Pablo"), 1]);
    expect([aligned(d.layer), d.report.conflicts.length]).toEqual([links("Dios"), 1]);
    // Chosen again, knowing both choices: it stands everywhere, and nothing waits any more.
    const settled = decideAlignment(c.layer, c.layer.pending[0]!.id, "theirs", carla, at());
    const back = mergeAlignments(d.layer, settled, now(texto), dani, at());
    expect([aligned(back.layer), back.layer.pending, back.report.conflicts]).toEqual([links("Dios"), [], []]);
    const again = mergeAlignments(atCarla, settled, now(texto), carla, at());
    expect([aligned(again.layer), again.report.conflicts]).toEqual([links("Dios"), []]);
  });

  it("si eligen lo mismo por separado, no hay nada que volver a elegir", () => {
    const open = openChoice();
    const atCarla = decideAlignment(open, open.pending[0]!.id, "theirs", carla, at());
    const atDani = decideAlignment(open, open.pending[0]!.id, "theirs", dani, at());
    const { layer, report } = mergeAlignments(atCarla, atDani, now(texto), carla, at());
    expect([aligned(layer), report.conflicts]).toEqual([links("Dios"), []]);
  });
});
