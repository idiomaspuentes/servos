import { describe, expect, it } from "vitest";
import { placesOf } from "./book";
import { recordEdits, seenUpTo, startBook } from "./journal";
import { decide, decideAll, mergeInto } from "./merge";
import { personKey, type BookState, type Person } from "./types";

const ana: Person = { name: "Ana", device: "tel-ana" };
const beto: Person = { name: "Beto", device: "tel-beto" };
const carla: Person = { name: "Carla", device: "tel-carla" };
const dina: Person = { name: "Dina", device: "compu-reunion" };

/** A Titus with the verses given, one per line: `{1: {1: "texto"}}`. */
function tit(chapters: Record<number, Record<number, string>>): string {
  const out = ["\\id TIT", "\\h Tito"];
  for (const [c, verses] of Object.entries(chapters)) {
    out.push(`\\c ${c}`, "\\p");
    for (const [v, text] of Object.entries(verses)) out.push(`\\v ${v}${text ? ` ${text}` : ""}`);
  }
  return `${out.join("\n")}\n`;
}

const textOf = (state: BookState, verse: number, chapter = 1) => placesOf(state.usfm).find((p) => p.chapter === chapter && p.from === verse)?.text ?? "";
let clock = 0;
const at = () => new Date(Date.UTC(2026, 9, 14, 8, 0, clock++)).toISOString();

describe("choques falsos de git: no llegan a nadie", () => {
  it("dos versículos en la misma línea, uno escrito en cada copia, se juntan sin choque", () => {
    const a = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\p\n\\v 1 Pablo, siervo de Dios. \\v 2\n", person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\p\n\\v 1 \\v 2 en la esperanza de la vida eterna.\n", person: beto, at: at() });
    const { state, report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios.");
    expect(textOf(state, 2)).toBe("en la esperanza de la vida eterna.");
  });

  it("una copia solo tiene el versículo 1 y la otra solo el 2, los dos en la primera línea: queda el capítulo con los dos", () => {
    const a = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\v 1 Pablo, siervo de Dios.\n", person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\v 2 en la esperanza de la vida eterna.\n", person: beto, at: at() });
    const { state, report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect([textOf(state, 1), textOf(state, 2)]).toEqual(["Pablo, siervo de Dios.", "en la esperanza de la vida eterna."]);
  });

  it("el mismo texto en las dos copias no es un choque, aunque cambien los espacios", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo,  siervo de Dios." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: beto, at: at() });
    expect(mergeInto(a, b, ana, at()).report.conflicts).toEqual([]);
  });

  it("si solo cambia el formato o la alineación, no es un choque de traducción", () => {
    const plain = "\\id TIT\n\\c 1\n\\p\n\\v 1 Pablo, siervo de Dios.\n";
    const aligned = "\\id TIT\n\\c 1\n\\q1\n\\v 1 \\zaln-s |x-strong=\"G39720\"\\*\\w Pablo|x-occurrence=\"1\"\\w*\\zaln-e\\*, siervo de Dios.\n";
    const a = startBook({ book: "TIT", usfm: plain, person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: aligned, person: beto, at: at() });
    const { report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect(report.taken).toEqual([]);
  });

  it("vaciar un versículo en una copia no borra el que la otra tiene escrito", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "" } }), person: beto, at: at() });
    const { state, report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios.");
  });
});

describe("cambios que se conocen: entra el más nuevo sin preguntar", () => {
  it("si Beto cambió un versículo partiendo del texto de Ana, al traerlo entra el de Beto", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: ana, at: at() });
    let b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "" } }), person: beto, at: at() });
    b = mergeInto(b, a, beto, at()).state;
    b = recordEdits(b, beto, tit({ 1: { 1: "Pablo, siervo de Dios y apóstol." } }), at());
    const { state, report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios y apóstol.");
  });

  it("si Ana ya tenía el cambio de Beto y después lo mejoró, traer otra vez lo de Beto no lo deshace", () => {
    let a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "" } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: beto, at: at() });
    a = mergeInto(a, b, ana, at()).state;
    a = recordEdits(a, ana, tit({ 1: { 1: "Pablo, siervo de Dios y apóstol." } }), at());
    const { state, report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios y apóstol.");
  });
});

describe("dos proyectos que empezaron por separado", () => {
  it("lo distinto se pregunta una vez; decidido, no se vuelve a preguntar al traer otra vez la misma copia", () => {
    let a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios.", 2: "en la esperanza." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, esclavo de Dios.", 2: "en la esperanza." } }), person: beto, at: at() });
    const first = mergeInto(a, b, ana, at());
    expect(first.report.conflicts.map((c) => c.place)).toEqual([{ chapter: 1, from: 1, to: 1 }]);
    a = decide(first.state, first.report.conflicts[0]!.id, { keep: "theirs" }, ana, at());
    expect(textOf(a, 1)).toBe("Pablo, esclavo de Dios.");
    expect(a.pending).toEqual([]);
    const again = mergeInto(a, b, ana, at());
    expect(again.report.conflicts).toEqual([]);
    expect(textOf(again.state, 1)).toBe("Pablo, esclavo de Dios.");
  });

  it("la decisión viaja con el libro: en otro aparato, el mismo par de versiones ya está decidido", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, esclavo de Dios." } }), person: beto, at: at() });
    const met = mergeInto(a, b, dina, at());
    const decided = decide(met.state, met.report.conflicts[0]!.id, { keep: "mine" }, dina, at());
    // Beto takes the meeting's copy home: the pair Dina decided is settled there too.
    const { state, report } = mergeInto(b, decided, beto, at());
    expect(report.conflicts).toEqual([]);
    expect(report.decided).toEqual([{ chapter: 1, from: 1, to: 1 }]);
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios.");
  });

  it("un choque que ya está pendiente no se agrega dos veces", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, esclavo de Dios." } }), person: beto, at: at() });
    const once = mergeInto(a, b, ana, at()).state;
    const twice = mergeInto(once, b, ana, at());
    expect(twice.report.conflicts).toEqual([]);
    expect(twice.state.pending).toHaveLength(1);
  });

  it("un puente contra versículos sueltos, los dos con texto, es un choque de estructura", () => {
    const a = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\v 1-2 Pablo, siervo de Dios, en la esperanza.\n", person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios,", 2: "en la esperanza." } }), person: beto, at: at() });
    const { report } = mergeInto(a, b, ana, at());
    expect(report.conflicts.map((c) => [c.kind, c.place])).toEqual([["estructura", { chapter: 1, from: 1, to: 2 }]]);
  });

  it("si Beto partió el puente después de traer el de Ana, al juntarlos entra la división de Beto sin preguntar", () => {
    const a = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\v 1-2 Pablo, siervo de Dios, en la esperanza.\n", person: ana, at: at() });
    let b = startBook({ book: "TIT", usfm: "\\id TIT\n\\c 1\n\\v 1-2\n", person: beto, at: at() });
    b = mergeInto(b, a, beto, at()).state;
    b = recordEdits(b, beto, tit({ 1: { 1: "Pablo, siervo de Dios,", 2: "en la esperanza." } }), at());
    const { state, report } = mergeInto(a, b, ana, at());
    expect(report.conflicts).toEqual([]);
    expect([textOf(state, 1), textOf(state, 2)]).toEqual(["Pablo, siervo de Dios,", "en la esperanza."]);
  });
});

describe("la reunión: Ana, Beto y Carla juntan su trabajo; Carla manda su tarjeta y se lleva la mezcla", () => {
  it("solo choca lo que Carla cambió después en un versículo que la reunión resolvió de otra forma", () => {
    // Each one translated on their own phone, without a shared start.
    const anaBook = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios.", 2: "", 3: "", 4: "" } }), person: ana, at: at() });
    const betoBook = startBook({ book: "TIT", usfm: tit({ 1: { 1: "", 2: "en la esperanza de la vida eterna.", 3: "", 4: "" } }), person: beto, at: at() });
    let carlaBook = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, esclavo de Dios.", 2: "", 3: "y a su debido tiempo.", 4: "" } }), person: carla, at: at() });
    const carlaCard = carlaBook; // what she sent on the SD card

    // At the meeting Dina merges the three copies.
    let meeting = startBook({ book: "TIT", usfm: tit({ 1: { 1: "", 2: "", 3: "", 4: "" } }), person: dina, at: at() });
    meeting = mergeInto(meeting, anaBook, dina, at()).state;
    meeting = mergeInto(meeting, betoBook, dina, at()).state;
    const withCarla = mergeInto(meeting, carlaCard, dina, at());
    expect(withCarla.report.conflicts.map((c) => c.place.from)).toEqual([1]);
    meeting = decide(withCarla.state, withCarla.report.conflicts[0]!.id, { keep: "mine" }, dina, at());
    expect([1, 2, 3].map((v) => textOf(meeting, v))).toEqual(["Pablo, siervo de Dios.", "en la esperanza de la vida eterna.", "y a su debido tiempo."]);

    // Meanwhile Carla went on working: verse 1 (the meeting chose Ana's), verse 3 (the meeting kept hers) and verse 4 (new).
    carlaBook = recordEdits(carlaBook, carla, tit({ 1: { 1: "Pablo, esclavo de Dios y apóstol.", 2: "", 3: "y a su debido tiempo manifestó.", 4: "su palabra." } }), at());

    const home = mergeInto(carlaBook, meeting, carla, at());
    expect(home.report.conflicts.map((c) => c.place.from)).toEqual([1]);
    expect(textOf(home.state, 2)).toBe("en la esperanza de la vida eterna.");
    expect(textOf(home.state, 3)).toBe("y a su debido tiempo manifestó.");
    expect(textOf(home.state, 4)).toBe("su palabra.");

    // The next meeting brings her old card again: nothing already decided is asked again.
    const oldCardAgain = mergeInto(meeting, carlaCard, dina, at());
    expect(oldCardAgain.report.conflicts).toEqual([]);
    expect(textOf(oldCardAgain.state, 1)).toBe("Pablo, siervo de Dios.");
  });

  it("cada copia sabe hasta dónde incorporó a cada persona", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "uno", 2: "dos" } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "", 2: "", 3: "tres" } }), person: beto, at: at() });
    const merged = mergeInto(a, b, ana, at()).state;
    expect(seenUpTo(merged, personKey(ana))).toBe(2);
    expect(seenUpTo(merged, personKey(beto))).toBe(1);
  });

  it("no se mezclan libros distintos", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "uno" } }), person: ana, at: at() });
    const b = { ...startBook({ book: "TIT", usfm: tit({ 1: { 1: "uno" } }), person: beto, at: at() }), book: "JUD" };
    expect(() => mergeInto(a, b, ana, at())).toThrow(/libros distintos/);
  });
});

describe("borrar un versículo a propósito también viaja", () => {
  /** Ana's Titus 1:1, and a copy of it that Beto took in. */
  function both() {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios.", 2: "En la esperanza." } }), person: ana, at: at() });
    let b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "", 2: "" } }), person: beto, at: at() });
    b = mergeInto(b, a, beto, at()).state;
    return { a, b };
  }

  it("si Beto borró el versículo que Ana tiene, al traerlo queda borrado", () => {
    const { a, b } = both();
    const borrado = recordEdits(b, beto, tit({ 1: { 1: "", 2: "En la esperanza." } }), at());
    const { state, report } = mergeInto(a, borrado, ana, at());
    expect([textOf(state, 1), textOf(state, 2), report.conflicts.length]).toEqual(["", "En la esperanza.", 0]);
  });

  it("si Ana ya tenía el borrado, una copia vieja no lo devuelve", () => {
    const { a, b } = both();
    const sinEl = recordEdits(a, ana, tit({ 1: { 1: "", 2: "En la esperanza." } }), at());
    const { state, report } = mergeInto(sinEl, b, ana, at());
    expect([textOf(state, 1), report.conflicts.length]).toEqual(["", 0]);
  });

  it("si uno lo borró y el otro lo cambió por separado, se pregunta", () => {
    const { a, b } = both();
    const borrado = recordEdits(b, beto, tit({ 1: { 1: "", 2: "En la esperanza." } }), at());
    const cambiado = recordEdits(a, ana, tit({ 1: { 1: "Pablo, siervo de Dios y apóstol.", 2: "En la esperanza." } }), at());
    const { state, report } = mergeInto(cambiado, borrado, ana, at());
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios y apóstol.");
    expect(report.conflicts.map((c) => [c.kind, c.mine.text, c.theirs.text])).toEqual([["texto", "Pablo, siervo de Dios y apóstol.", ""]]);
  });

  it("si después de borrarlo alguien lo volvió a escribir, entra lo nuevo", () => {
    const { a, b } = both();
    const borrado = recordEdits(b, beto, tit({ 1: { 1: "", 2: "En la esperanza." } }), at());
    const otraVez = recordEdits(mergeInto(a, borrado, ana, at()).state, ana, tit({ 1: { 1: "Pablo, esclavo de Dios.", 2: "En la esperanza." } }), at());
    const { state, report } = mergeInto(borrado, otraVez, beto, at());
    expect([textOf(state, 1), report.conflicts.length]).toEqual(["Pablo, esclavo de Dios.", 0]);
  });
});

describe("un choque sin decidir viaja con el libro", () => {
  /** Ana and Beto each wrote verse 1 apart; Ana's copy found it and has not chosen. */
  function anaWithOpenChoice() {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, esclavo de Dios." } }), person: beto, at: at() });
    return { a: mergeInto(a, b, ana, at()).state, b };
  }

  it("quien recibe el libro ve las dos versiones para elegir, aunque no tuviera ninguna", () => {
    const { a } = anaWithOpenChoice();
    const c = startBook({ book: "TIT", usfm: tit({ 1: { 1: "" } }), person: carla, at: at() });
    const { state, report } = mergeInto(c, a, carla, at());
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios.");
    expect(report.conflicts.map((x) => [x.mine.text, x.theirs.text])).toEqual([["Pablo, siervo de Dios.", "Pablo, esclavo de Dios."]]);
    // Chosen there, the other version goes in as it was written.
    const chosen = decide(state, state.pending[0]!.id, { keep: "theirs" }, carla, at());
    expect(textOf(chosen, 1)).toBe("Pablo, esclavo de Dios.");
  });

  it("si quien lo recibe tiene la otra versión, se le muestra desde su lado", () => {
    const { a, b } = anaWithOpenChoice();
    const { state } = mergeInto(b, a, beto, at());
    expect(state.pending).toHaveLength(1);
    expect([state.pending[0]!.mine.text, state.pending[0]!.theirs.text]).toEqual(["Pablo, esclavo de Dios.", "Pablo, siervo de Dios."]);
    expect(textOf(decide(state, state.pending[0]!.id, { keep: "theirs" }, beto, at()), 1)).toBe("Pablo, siervo de Dios.");
  });

  it("decidido en un aparato, deja de esperar en el otro al traer su libro", () => {
    const { a } = anaWithOpenChoice();
    const c = mergeInto(startBook({ book: "TIT", usfm: tit({ 1: { 1: "" } }), person: carla, at: at() }), a, carla, at()).state;
    const decided = decide(c, c.pending[0]!.id, { keep: "theirs" }, carla, at());
    const { state, report } = mergeInto(a, decided, ana, at());
    expect(state.pending).toEqual([]);
    expect(report.conflicts).toEqual([]);
    expect(textOf(state, 1)).toBe("Pablo, esclavo de Dios.");
  });

  it("decidido escribiendo otra versión, esa entra en el otro aparato sin preguntar", () => {
    const { a, b } = anaWithOpenChoice();
    const written = tit({ 1: { 1: "Pablo, servidor de Dios." } });
    const decided = decide(a, a.pending[0]!.id, { usfm: written }, ana, at());
    const { state, report } = mergeInto(b, decided, beto, at());
    expect([report.conflicts, state.pending]).toEqual([[], []]);
    expect(textOf(state, 1)).toBe("Pablo, servidor de Dios.");
  });

  it("donde quien lo recibe ya escribió otra cosa, no se le pregunta por dos versiones que ya dejó atrás", () => {
    const { a } = anaWithOpenChoice();
    let c = mergeInto(startBook({ book: "TIT", usfm: tit({ 1: { 1: "" } }), person: carla, at: at() }), a, carla, at()).state;
    c = decide(c, c.pending[0]!.id, { keep: "mine" }, carla, at());
    c = recordEdits(c, carla, tit({ 1: { 1: "Pablo, siervo de Dios y apóstol." } }), at());
    const { state } = mergeInto(c, a, carla, at());
    expect(state.pending).toEqual([]);
    expect(textOf(state, 1)).toBe("Pablo, siervo de Dios y apóstol.");
  });
});

describe("varias personas tradujeron lo mismo: se junta una vez", () => {
  const dani: Person = { name: "Dani", device: "tel-dani" };
  /** Four wrote verse 1 apart; Ana's copy gathers the other three. */
  function fourOnOneVerse() {
    const mk = (person: Person, text: string) => startBook({ book: "TIT", usfm: tit({ 1: { 1: text } }), person, at: at() });
    const others = [mk(beto, "Pablo, esclavo de Dios."), mk(carla, "Pablo, servidor de Dios."), mk(dani, "Pablo, el siervo de Dios.")];
    let a = mk(ana, "Pablo, siervo de Dios.");
    for (const o of others) a = mergeInto(a, o, ana, at()).state;
    return { a, others };
  }

  it("una sola decisión cierra todas las versiones del versículo, y viaja: a nadie se le vuelve a preguntar", () => {
    const { a, others } = fourOnOneVerse();
    expect(a.pending).toHaveLength(3);
    const carlas = a.pending.find((c) => c.theirs.text === "Pablo, servidor de Dios.")!;
    const gathered = decideAll(a, a.pending.map((c) => c.id), { key: carlas.theirs.key }, ana, at());
    expect([textOf(gathered, 1), gathered.pending]).toEqual(["Pablo, servidor de Dios.", []]);
    for (const o of others) {
      const { state, report } = mergeInto(o, gathered, beto, at());
      expect([textOf(state, 1), report.conflicts.length]).toEqual(["Pablo, servidor de Dios.", 0]);
    }
  });

  it("una mezcla escrita a partir de todas entra igual en cada copia", () => {
    const { a, others } = fourOnOneVerse();
    const blend = tit({ 1: { 1: "Pablo, el servidor de Dios." } });
    const gathered = decideAll(a, a.pending.map((c) => c.id), { usfm: blend }, ana, at());
    for (const o of others) expect(textOf(mergeInto(o, gathered, beto, at()).state, 1)).toBe("Pablo, el servidor de Dios.");
  });

  it("dos personas que juntan por separado y dejan textos distintos: se vuelve a elegir, no gana una en silencio", () => {
    const { a } = fourOnOneVerse();
    // Beto and Carla each took Ana's gathered copy home before anyone chose, and each chose apart.
    const atBeto = decideAll(a, a.pending.map((c) => c.id), { usfm: tit({ 1: { 1: "Pablo, el servidor de Dios." } }) }, beto, at());
    const atCarla = decideAll(a, a.pending.map((c) => c.id), { key: a.pending[0]!.theirs.key }, carla, at());
    const toBeto = mergeInto(atBeto, atCarla, beto, at());
    const toCarla = mergeInto(atCarla, atBeto, carla, at());
    expect(toBeto.report.conflicts.map((c) => [c.mine.text, c.theirs.text])).toEqual([["Pablo, el servidor de Dios.", "Pablo, esclavo de Dios."]]);
    expect(toCarla.report.conflicts.map((c) => [c.mine.text, c.theirs.text])).toEqual([["Pablo, esclavo de Dios.", "Pablo, el servidor de Dios."]]);
    // Chosen again on one side, with both choices known: it stands everywhere.
    const settled = decide(toBeto.state, toBeto.state.pending[0]!.id, { keep: "theirs" }, beto, at());
    const { state, report } = mergeInto(toCarla.state, settled, carla, at());
    expect([textOf(state, 1), state.pending, report.conflicts]).toEqual(["Pablo, esclavo de Dios.", [], []]);
  });

  it("dos que eligen por separado la misma versión no tienen nada que volver a elegir", () => {
    const { a } = fourOnOneVerse();
    const key = a.pending[1]!.theirs.key;
    const atBeto = decideAll(a, a.pending.map((c) => c.id), { key }, beto, at());
    const atCarla = decideAll(a, a.pending.map((c) => c.id), { key }, carla, at());
    expect(mergeInto(atBeto, atCarla, beto, at()).report.conflicts).toEqual([]);
  });

  it("dos que eligen versiones distintas del mismo par, por separado, tampoco se pisan: se vuelve a elegir", () => {
    const a = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, siervo de Dios." } }), person: ana, at: at() });
    const b = startBook({ book: "TIT", usfm: tit({ 1: { 1: "Pablo, esclavo de Dios." } }), person: beto, at: at() });
    const met = mergeInto(a, b, ana, at()).state;
    const keptMine = decide(met, met.pending[0]!.id, { keep: "mine" }, carla, at());
    const keptTheirs = decide(met, met.pending[0]!.id, { keep: "theirs" }, dani, at());
    const one = mergeInto(keptMine, keptTheirs, carla, at());
    const other = mergeInto(keptTheirs, keptMine, dani, at());
    expect([textOf(one.state, 1), one.report.conflicts.length]).toEqual(["Pablo, siervo de Dios.", 1]);
    expect([textOf(other.state, 1), other.report.conflicts.length]).toEqual(["Pablo, esclavo de Dios.", 1]);
  });
});
