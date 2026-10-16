/**
 * Taller's tests of the verse merge (`scripts/verify-usfm-merge.mts` in github.com/idiomaspuentes/taller), run on the copy
 * Servos keeps of it (`src/usfm`): each case as Taller wrote it, under its name. Cases of what Servos does not have
 * (Taller's git transport, task branches, its drafts cache, the conflicts comment) are left out:
 * - git como transporte: mezcla de ramas con git
 * - Slice 1: three-way + portion scope + trunk retry: reintento-sha
 * - Slice 1: three-way + portion scope + trunk retry: reintento-agotado
 * - Slice 1: three-way + portion scope + trunk retry: error-no-sha-se-propaga
 * - Slice 1: three-way + portion scope + trunk retry: sin-cambios-no-escribe
 * - Slice 3: conflicts comment + beforeWrite: comentario-roundtrip / comentario-legible
 * - Slice 3: conflicts comment + beforeWrite: reintento-no-pierde-conflicto
 * - Slice 3: conflicts comment + beforeWrite: before-write-falla
 * - Slice 4: Unir / Separar (applyVerseEdits, draftSlots, cache): cache-claves-rango
 * - Slice 5: isomorphic-git is transport, not resolution (toda la sección)
 * - Cerrar hardening: strict range, lot titles, head re-read, summary: titulo-de-lote
 * - Cerrar hardening: strict range, lot titles, head re-read, summary: reintento-relee-rama
 * - Cerrar hardening: strict range, lot titles, head re-read, summary: resumen-conflictos
 * - Option A: Cerrar patches the trunk instead of rebuilding the book: parche-sin-cambios (its write to the server; its
 *   first check, the same text, is kept below)
 */
import { describe, it } from "vitest";
import { applyVerseEdits, buildBookUsfmSkeleton, draftSlots, listVerseSpans, parseRefRange, portionRange, skeletonUsfmFromSource } from "./usfmEdit";
import { mergeUsfmByVerse, verseSlotsOf } from "./usfmVerseMerge";
import { patchTrunkByVerse } from "./usfmTrunkPatch";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const ultNehemiah = `\\id NEH unfoldingWord Literal Text
\\usfm 3.0
\\ide UTF-8
\\h Nehemiah
\\c 1
\\p
\\v 1 The words of Nehemiah.
\\v 2 Hanani came with men from Judah.
\\v 3 They said to me.
\\c 2
\\p
\\v 1 In the month of Nisan.
\\v 2 The king said to me.
`;

const skeleton = skeletonUsfmFromSource("NEH", ultNehemiah);
assert(/\\id NEH/.test(skeleton) && /\\c 1/.test(skeleton) && /\\p/.test(skeleton), "id/c/p present");
assert(/\\usfm 3.0/.test(skeleton) && /\\ide UTF-8/.test(skeleton), "identification markers");
assert(listVerseSpans(skeleton).map((s) => `${s.chapter}:${s.verse}`).join(",") === "1:1,1:2,1:3,2:1,2:2", "all ULT verses slotted");
assert(!/The words of Nehemiah/.test(skeleton), "does not copy English text");

const branchA = applyVerseEdits(skeleton, 1, [
  { verse: 1, text: "Palabras de Nehemías." },
  { verse: 2, text: "Hanani vino de Judá." },
]);
const branchB = applyVerseEdits(skeleton, 1, [
  { verse: 3, text: "Me dijeron esto." },
]);
const branchBch2 = applyVerseEdits(branchB, 2, [
  { verse: 1, text: "En el mes de Nisán." },
]);

const merged = mergeUsfmByVerse(skeleton, [branchA, branchBch2]);
const verses = listVerseSpans(merged.usfm);
assert(verses.map((s) => `${s.chapter}:${s.verse}`).join(",") === "1:1,1:2,1:3,2:1,2:2", "merged keeps book order");
assert(verses.find((s) => s.chapter === 1 && s.verse === 1)?.text.includes("Nehemías"), "keeps A 1:1");
assert(verses.find((s) => s.chapter === 1 && s.verse === 2)?.text.includes("Hanani"), "keeps A 1:2");
assert(verses.find((s) => s.chapter === 1 && s.verse === 3)?.text.includes("dijeron"), "keeps B 1:3");
assert(verses.find((s) => s.chapter === 2 && s.verse === 1)?.text.includes("Nisán"), "keeps B 2:1");
assert(verses.find((s) => s.chapter === 2 && s.verse === 2)?.text === "", "empty 2:2 not dropped");

const fallback = buildBookUsfmSkeleton({
  book: "NEH",
  fallbackRange: { chapter: 1, from: 10, to: 11 },
});
assert(/\\v 10/.test(fallback) && /\\v 11/.test(fallback) && /\\p/.test(fallback), "portion fallback skeleton");

const outputs: string[] = [merged.usfm];

function book1(verses: Record<number, string>): string {
  const lines = ["\\id NEH", "\\usfm 3.0", "\\c 1", "\\p"];
  for (const [v, text] of Object.entries(verses)) {
    lines.push(text ? `\\v ${v} ${text}` : `\\v ${v}`);
  }
  return `${lines.join("\n")}\n`;
}

function textAt(usfm: string, chapter: number, verse: number): string | undefined {
  return listVerseSpans(usfm).find((s) => s.chapter === chapter && s.verse === verse)?.text;
}

function track<T extends { usfm: string }>(result: T): T {
  outputs.push(result.usfm);
  return result;
}

function ch1(lines: string[]): string {
  return `${["\\id NEH", "\\usfm 3.0", "\\c 1", "\\p", ...lines].join("\n")}\n`;
}

function verseLines(usfm: string): string[] {
  return usfm.split("\n").filter((l) => l.startsWith("\\v "));
}

const poetryTrunk = [
  "\\id NEH unfoldingWord Literal Text",
  "\\usfm 3.0",
  "\\h Nehemías",
  "\\c 1",
  "\\p",
  "\\v 1 Palabras de Nehemías.",
  ...Array.from({ length: 8 }, (_, i) => `\\v ${i + 2} Verso ${i + 2}.`),
  "\\q1",
  "\\v 10 Viejo diez.",
  "\\q2 Sigue el diez.",
  "\\q1",
  "\\v 11 Once poético,",
  "\\q2 segunda línea del once.",
  "\\s1 Oración",
  "\\p",
  "\\v 12 Doce.",
  "",
].join("\n");
const oldTen = "\\v 10 Viejo diez.\n\\q2 Sigue el diez.\n";

for (const usfm of outputs) {
  assert(!/<<<<<<<|=======|>>>>>>>/.test(usfm), "sin-marcadores: ninguna salida tiene marcadores Git");
  const seen = new Set<string>();
  for (const span of listVerseSpans(usfm)) {
    for (let v = span.verse; v <= span.verseTo; v++) {
      const key = `${span.chapter}:${v}`;
      assert(!seen.has(key), `número repetido ${key} en una salida`);
      seen.add(key);
    }
  }
}

console.log("verify-usfm-merge: ok");

describe('Slice 1: three-way + portion scope + trunk retry', () => {
  it('libro-lleno-no-sobrescribe', () => {
    // libro-lleno-no-sobrescribe
    const ancestor = book1({ 10: "O10", 11: "O11", 12: "O12", 13: "O13" });
    const trunk = book1({ 10: "A10", 11: "A11", 12: "O12", 13: "O13" });
    const bob = book1({ 10: "O10", 11: "O11", 12: "B12", 13: "B13" });
    const scope = { chapter: 1, from: 12, to: 13 };
    for (const [label, opts] of [
      ["ancestro", { ancestor }],
      ["alcance", { scope }],
      ["ambos", { ancestor, scope }],
    ] as const) {
      const r = track(mergeUsfmByVerse(trunk, [bob], opts));
      assert(textAt(r.usfm, 1, 10) === "A10", `libro-lleno-no-sobrescribe (${label}): 1:10 = A10`);
      assert(textAt(r.usfm, 1, 12) === "B12", `libro-lleno-no-sobrescribe (${label}): 1:12 = B12`);
      if ("ancestor" in opts) {
        assert(r.conflicts.length === 0, `libro-lleno-no-sobrescribe (${label}): sin conflictos`);
      } else {
        // Without an ancestor every filled text competes: O12/O13 vs B12/B13
        // are two-way conflicts inside the portion, never on 1:10–11.
        assert(
          r.conflicts.every((c) => c.chapter === 1 && c.from >= 12 && c.to <= 13),
          `libro-lleno-no-sobrescribe (${label}): conflictos solo en la porción`,
        );
      }
    }
    // Documents the two-way bug: without options, Bob's stale 1:10 wins.
    const bug = track(mergeUsfmByVerse(trunk, [bob]));
    assert(textAt(bug.usfm, 1, 10) === "O10", "libro-lleno-no-sobrescribe: sin opciones gana el texto viejo");
  });
  it('solape-sin-tocar / solape-con-cambio', () => {
    // solape-sin-tocar / solape-con-cambio
    const ancestor = book1({ 11: "O11" });
    const trunk = book1({ 11: "A11" });
    const untouched = track(mergeUsfmByVerse(trunk, [book1({ 11: "O11" })], { ancestor }));
    assert(textAt(untouched.usfm, 1, 11) === "A11", "solape-sin-tocar: queda A11");
    assert(untouched.conflicts.length === 0, "solape-sin-tocar: sin conflicto");
    const changed = track(mergeUsfmByVerse(trunk, [book1({ 11: "B11" })], { ancestor }));
    assert(textAt(changed.usfm, 1, 11) === "B11", "solape-con-cambio: gana B11");
    assert(changed.conflicts.length === 1, "solape-con-cambio: un conflicto");
  });
  it('vaciar-no-propaga', () => {
    // vaciar-no-propaga
    const ancestor = book1({ 12: "X" });
    const r = track(mergeUsfmByVerse(ancestor, [book1({ 12: "" })], { ancestor }));
    assert(textAt(r.usfm, 1, 12) === "X", "vaciar-no-propaga: queda X");
  });
  it('identico-trim-nfc', () => {
    // identico-trim-nfc
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    const r = track(mergeUsfmByVerse(book1({ 1: composed }), [book1({ 1: `${decomposed}   ` })]));
    assert(r.conflicts.length === 0, "identico-trim-nfc: sin conflicto");
    assert(r.usfm === r.usfm.normalize("NFC"), "identico-trim-nfc: salida NFC");
    assert(textAt(r.usfm, 1, 1) === composed, "identico-trim-nfc: texto NFC");
  });
});

describe('Slice 2: range slots (P1–P9)', () => {
  it('span-parse', () => {
    // span-parse
    const spans = listVerseSpans(ch1(["\\v 10-11 X", "\\v 12 Y"]));
    assert(
      spans.map((s) => `${s.verse}-${s.verseTo}`).join(",") === "10-11,12-12",
      "span-parse: (10,11) y (12,12)",
    );
    const dash = listVerseSpans(ch1(["\\v 10–11 X"]));
    assert(dash[0]?.verseTo === 11, "span-parse: tolera guion largo");
    const bad = listVerseSpans(ch1(["\\v 11-10 X"]));
    assert(bad[0]?.verse === 11 && bad[0].verseTo === 11 && bad[0].rangeInvalid, "span-parse: rango inválido");
  });
  it('span-vs-esqueleto (P2)', () => {
    // span-vs-esqueleto (P2)
    const r = track(mergeUsfmByVerse(ch1(["\\v 10", "\\v 11"]), [ch1(["\\v 10-11 X"])]));
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 X", "span-vs-esqueleto: una línea \\v 10-11 X");
    assert(r.conflicts.length === 0, "span-vs-esqueleto: sin conflicto");
  });
  it('span-lleno-vs-sueltos-vacios (P3)', () => {
    // span-lleno-vs-sueltos-vacios (P3)
    const r = track(mergeUsfmByVerse(ch1(["\\v 10-11 X"]), [ch1(["\\v 10", "\\v 11"])]));
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 X", "span-lleno-vs-sueltos-vacios: queda el puente");
    assert(r.conflicts.length === 0, "span-lleno-vs-sueltos-vacios: sin conflicto");
  });
  it('span-disjunto (P1)', () => {
    // span-disjunto (P1)
    const base = ch1(["\\v 10", "\\v 11", "\\v 12"]);
    const r = track(mergeUsfmByVerse(base, [ch1(["\\v 10-11 X", "\\v 12"]), ch1(["\\v 10", "\\v 11", "\\v 12 Y"])]));
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 X|\\v 12 Y", "span-disjunto: ambos en orden");
    assert(r.conflicts.length === 0, "span-disjunto: sin conflicto");
  });
  it('span-igual (P4) / span-mismo-rango-distinto-texto (P5)', () => {
    // span-igual (P4) / span-mismo-rango-distinto-texto (P5)
    const same = track(mergeUsfmByVerse(ch1(["\\v 10-11 X"]), [ch1(["\\v 10-11 X"])]));
    assert(verseLines(same.usfm).join("|") === "\\v 10-11 X" && !same.conflicts.length, "span-igual");
    const diff = track(mergeUsfmByVerse(ch1(["\\v 10-11 X"]), [ch1(["\\v 10-11 Z"])]));
    assert(verseLines(diff.usfm).join("|") === "\\v 10-11 Z", "span-mismo-rango-distinto-texto: último lado");
    assert(
      diff.conflicts.length === 1 && diff.conflicts[0]!.kind === "texto" && diff.conflicts[0]!.kept === "ultimo",
      "span-mismo-rango-distinto-texto: kind texto",
    );
  });
  it('span-vs-dos-llenos (P8)', () => {
    // span-vs-dos-llenos (P8)
    const r = track(mergeUsfmByVerse(ch1(["\\v 10-11 X"]), [ch1(["\\v 10 a", "\\v 11 b"])]));
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 X", "span-vs-dos-llenos: el tronco sigue igual");
    assert(r.conflicts.length === 1 && r.conflicts[0]!.kind === "estructura", "span-vs-dos-llenos: estructura");
    assert(r.conflicts[0]!.kept === "tronco", "span-vs-dos-llenos: kept tronco");
    assert(!/\\v 1[01] [ab]\b/.test(r.usfm) && !/X a|a b/.test(r.usfm), "span-vs-dos-llenos: ni a ni b");
  });
  it('span-vs-uno-lleno', () => {
    // span-vs-uno-lleno
    const r = track(mergeUsfmByVerse(ch1(["\\v 10-11 X"]), [ch1(["\\v 10", "\\v 11 b"])]));
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 X", "span-vs-uno-lleno: el tronco sigue igual");
    assert(r.conflicts.length === 1 && r.conflicts[0]!.kind === "estructura", "span-vs-uno-lleno: estructura");
  });
  it('spans-solapados (P9)', () => {
    // spans-solapados (P9)
    const r = track(mergeUsfmByVerse(ch1(["\\v 10-11 X", "\\v 12"]), [ch1(["\\v 10", "\\v 11-12 Y"])]));
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 X|\\v 12", "spans-solapados: el tronco sigue igual");
    const c = r.conflicts[0];
    assert(r.conflicts.length === 1 && c?.kind === "estructura" && c.from === 10 && c.to === 12, "spans-solapados: estructura 10–12");
  });
  it('span-vacio-pierde (P7)', () => {
    // span-vacio-pierde (P7)
    const r = track(
      mergeUsfmByVerse(ch1(["\\v 10-11"]), [ch1(["\\v 10 a", "\\v 11"]), ch1(["\\v 10", "\\v 11 b"])]),
    );
    assert(verseLines(r.usfm).join("|") === "\\v 10 a|\\v 11 b", "span-vacio-pierde: 10 a, 11 b");
    assert(r.conflicts.length === 0, "span-vacio-pierde: sin conflicto");
  });
  it('separar-con-ancestro', () => {
    // separar-con-ancestro
    const ancestor = ch1(["\\v 10-11 X"]);
    const r = track(mergeUsfmByVerse(ancestor, [ch1(["\\v 10 a", "\\v 11 b"])], { ancestor }));
    assert(verseLines(r.usfm).join("|") === "\\v 10 a|\\v 11 b", "separar-con-ancestro: gana la separación");
    assert(r.conflicts.length === 0, "separar-con-ancestro: sin conflicto");
  });
  it('span-fuera-de-porcion', () => {
    // span-fuera-de-porcion
    const r = track(
      mergeUsfmByVerse(ch1(["\\v 10", "\\v 11", "\\v 12", "\\v 13"]), [ch1(["\\v 10-11 Z", "\\v 12", "\\v 13"])], {
        scope: { chapter: 1, from: 11, to: 13 },
      }),
    );
    assert(verseLines(r.usfm).join("|") === "\\v 10-11 Z|\\v 12|\\v 13", "span-fuera-de-porcion: entra por intersección");
  });
  it('segmentos-10a-10b', () => {
    // segmentos-10a-10b
    const r = track(mergeUsfmByVerse(ch1(["\\v 10a a1", "\\v 10b a2", "\\v 11"]), []));
    assert(verseLines(r.usfm).join("|") === "\\v 10 a1 a2|\\v 11", "segmentos-10a-10b: un solo \\v 10");
    assert(r.warnings.some((w) => w.kind === "segmento" && w.verse === 10), "segmentos-10a-10b: aviso segmento");
    const dup = track(mergeUsfmByVerse(ch1(["\\v 3 uno", "\\v 3 dos"]), []));
    assert(verseLines(dup.usfm).join("|") === "\\v 3 dos", "verso-duplicado: gana el último");
    assert(dup.warnings.some((w) => w.kind === "duplicado" && w.verse === 3), "verso-duplicado: aviso");
  });
  it('nota-y-titulo-no-entran', () => {
    // nota-y-titulo-no-entran
    const marked = ch1(["\\v 1 Texto base \\f + \\ft nota\\f* sigue.", "\\s1 Título", "\\v 2 Dos"]);
    const plain = ch1(["\\v 1 Texto base sigue.", "\\v 2 Dos"]);
    const r = track(mergeUsfmByVerse(marked, [plain]));
    assert(!/nota|Título/.test(r.usfm), "nota-y-titulo-no-entran: sin nota ni título");
    assert(r.conflicts.length === 0, "nota-y-titulo-no-entran: sin conflicto");
  });
});

describe('Slice 4: Unir / Separar (applyVerseEdits, draftSlots, cache)', () => {
  it('unir-separar-roundtrip', () => {
    // unir-separar-roundtrip
    const skel = ch1(["\\v 9", "\\v 10", "\\v 11", "\\v 12"]);
    const joined = applyVerseEdits(skel, 1, [{ from: 10, to: 11, text: "X" }]);
    assert(verseLines(joined).join("|") === "\\v 9|\\v 10-11 X|\\v 12", "unir-separar-roundtrip: un \\v 10-11 X entre 9 y 12");
    const split = applyVerseEdits(joined, 1, [
      { from: 10, to: 10, text: "X" },
      { from: 11, to: 11, text: "" },
    ]);
    assert(verseLines(split).join("|") === "\\v 9|\\v 10 X|\\v 11|\\v 12", "unir-separar-roundtrip: separa en su sitio");
  });
  it('unir-puente-existente', () => {
    // unir-puente-existente
    const out = applyVerseEdits(ch1(["\\v 10-11 X", "\\v 12 Y"]), 1, [{ from: 10, to: 12, text: "X Y" }]);
    assert(verseLines(out).join("|") === "\\v 10-12 X Y", "unir-puente-existente: \\v 10-12 X Y");
  });
  it('insertar-en-orden', () => {
    // insertar-en-orden
    const out = applyVerseEdits(ch1(["\\v 9 a", "\\v 11 c", "\\v 12 d"]), 1, [{ verse: 10, text: "b" }]);
    assert(verseLines(out).join("|") === "\\v 9 a|\\v 10 b|\\v 11 c|\\v 12 d", "insertar-en-orden: 10 entre 9 y 11");
    const first = applyVerseEdits(ch1(["\\v 11 c"]), 1, [{ verse: 10, text: "b" }]);
    assert(verseLines(first).join("|") === "\\v 10 b|\\v 11 c", "insertar-en-orden: antes del primer mayor");
  });
  it('esqueleto-con-puente-fuente', () => {
    // esqueleto-con-puente-fuente
    const source = `\\id NEH\n\\c 1\n\\p\n\\v 9 Nine.\n\\v 10-11 Ten and eleven.\n\\v 12 Twelve.\n`;
    const skel = skeletonUsfmFromSource("NEH", source);
    assert(verseLines(skel).join("|") === "\\v 9|\\v 10-11|\\v 12", "esqueleto-con-puente-fuente: conserva \\v 10-11 vacío");
  });
  it('draft-slots-fuera-de-porcion', () => {
    // draft-slots-fuera-de-porcion
    const rows = draftSlots(ch1(["\\v 10-11 X", "\\v 12", "\\v 13"]), { chapter: 1, from: 11, to: 13 });
    assert(
      rows.map((r) => `${r.from}-${r.to}`).join(",") === "10-11,12-12,13-13",
      "draft-slots-fuera-de-porcion: fila (10,11)",
    );
    const seg = draftSlots(ch1(["\\v 10a uno", "\\v 10b dos"]), { chapter: 1, from: 10, to: 10 });
    assert(seg.length === 1 && seg[0]!.text === "uno dos", "draft-slots: une segmentos 10a/10b");
  });
  it('Encadenado con el slice 2: rama con puente guardado sobre el esqueleto (P2)', () => {
    // Encadenado con el slice 2: rama con puente guardado sobre el esqueleto (P2)
    const skel = ch1(["\\v 9", "\\v 10", "\\v 11", "\\v 12"]);
    const branch = applyVerseEdits(skel, 1, [{ from: 10, to: 11, text: "Puente" }]);
    const r = track(mergeUsfmByVerse(skel, [branch], { ancestor: skel, scope: { chapter: 1, from: 10, to: 11 } }));
    assert(verseLines(r.usfm).join("|") === "\\v 9|\\v 10-11 Puente|\\v 12", "encadenado: el puente llega al tronco");
    assert(r.conflicts.length === 0, "encadenado: sin conflicto");
  });
});

describe('Cerrar hardening: strict range, lot titles, head re-read, summary', () => {
  it('rango-estricto', () => {
    // rango-estricto
    const eq = (r: unknown, s: string) => JSON.stringify(r) === s;
    assert(eq(parseRefRange("1:10–11"), '{"chapter":1,"from":10,"to":11}'), "rango: 1:10–11");
    assert(eq(parseRefRange("NEH 13:30 · TPL"), '{"chapter":13,"from":30,"to":30}'), "rango: 13:30");
    assert(parseRefRange("NEH") === null && parseRefRange("") === null, "rango: sin c:v es null");
    assert(eq(parseRefRange("1:1–8–9–12"), '{"chapter":1,"from":1,"to":12}'), "rango: lote viejo encadenado");
    assert(parseRefRange("1:9–11–1–4") === null, "rango: cadena que retrocede es null");
    assert(parseRefRange("1:9–11–2:1–4") === null, "rango: dos capítulos es null");
    assert(eq(portionRange("1:9–11–2:1–4", 1), '{"chapter":1,"from":9,"to":11}'), "editor: muestra el primer tramo");
    assert(eq(portionRange("NEH", 3), '{"chapter":3,"from":1,"to":1}'), "editor: 3:1 solo para mostrar");
  });
});

describe('Option A: Cerrar patches the trunk instead of rebuilding the book', () => {
  it('parche-1-10: only 1:10 changes; 1:1, poetry and headings stay byte-identical', () => {
    // parche-1-10: only 1:10 changes; 1:1, poetry and headings stay byte-identical
    const sideLine = "\\v 10 Nuevo \\w diez|x-strong=\"H1\"\\w* aquí.";
    const side = poetryTrunk.replace(oldTen, `${sideLine}\n`);
    const r = track(patchTrunkByVerse(poetryTrunk, [side], {
      ancestor: poetryTrunk,
      scope: { chapter: 1, from: 10, to: 10 },
    }));
    const expected = poetryTrunk.replace(oldTen, `${sideLine}\n`);
    assert(r.usfm === expected, "parche-1-10: solo cambia la línea del 1:10");
    assert(r.usfm.startsWith("\\id NEH unfoldingWord Literal Text\n\\usfm 3.0\n\\h Nehemías\n"), "parche-1-10: cabecera intacta");
    assert(r.usfm.includes("\\v 1 Palabras de Nehemías.\n"), "parche-1-10: 1:1 intacto");
    assert(r.usfm.includes("\\v 11 Once poético,\n\\q2 segunda línea del once.\n\\s1 Oración\n\\p\n"), "parche-1-10: poesía fuera de la porción intacta");
    assert(r.usfm.includes(`${sideLine}\n`), "parche-1-10: la línea ganadora es idéntica a la del lado");
    assert(r.patched.length === 1 && r.patched[0]!.from === 10 && r.patched[0]!.to === 10, "parche-1-10: un grupo parcheado");
  });
  it('parche-fuera-de-porcion-ignorado: a side edit outside the scope never lands', () => {
    // parche-fuera-de-porcion-ignorado: a side edit outside the scope never lands
    const side = poetryTrunk
      .replace(oldTen, "\\v 10 Nuevo diez.\n")
      .replace("\\v 1 Palabras de Nehemías.", "\\v 1 Otro uno.");
    const r = track(patchTrunkByVerse(poetryTrunk, [side], {
      ancestor: poetryTrunk,
      scope: { chapter: 1, from: 10, to: 10 },
    }));
    assert(r.usfm.includes("\\v 1 Palabras de Nehemías.\n") && !r.usfm.includes("Otro uno"), "parche-fuera-de-porcion: 1:1 sigue igual");
  });
  it('parche-crlf: CRLF trunk stays CRLF, synthesized lines too', () => {
    // parche-crlf: CRLF trunk stays CRLF, synthesized lines too
    const crlf = poetryTrunk.replace(/\n/g, "\r\n");
    const side = poetryTrunk.replace(oldTen, "\\v 10 Nuevo diez.\n");
    const r = track(patchTrunkByVerse(crlf, [side], {
      ancestor: crlf,
      scope: { chapter: 1, from: 10, to: 10 },
    }));
    assert(!/(^|[^\r])\n/.test(r.usfm), "parche-crlf: ningún LF suelto");
    assert(r.usfm === crlf.replace(oldTen.replace(/\n/g, "\r\n"), "\\v 10 Nuevo diez.\r\n"), "parche-crlf: solo cambia el 1:10");
  });
  it("parche-trunk-ajeno: someone else's 1:12 on the trunk survives", () => {
    // parche-trunk-ajeno: someone else's 1:12 on the trunk survives
    const ancestor = poetryTrunk;
    const trunk = poetryTrunk.replace("\\v 12 Doce.", "\\v 12 Doce de otro.");
    const side = poetryTrunk.replace(oldTen, "\\v 10 Nuevo diez.\n");
    const r = track(patchTrunkByVerse(trunk, [side], { ancestor, scope: { chapter: 1, from: 10, to: 10 } }));
    assert(r.usfm === trunk.replace(oldTen, "\\v 10 Nuevo diez.\n"), "parche-trunk-ajeno: conserva 1:12 del tronco");
  });
  it('parche-estructura: bridge vs split with text on both sides keeps trunk bytes', () => {
    // parche-estructura: bridge vs split with text on both sides keeps trunk bytes
    const trunk = ch1(["\\v 9 Nueve.", "\\v 10-11 Puente del tronco.", "\\v 12 Doce."]);
    const side = ch1(["\\v 9 Nueve.", "\\v 10 a", "\\v 11 b", "\\v 12 Doce."]);
    const r = track(patchTrunkByVerse(trunk, [side], { scope: { chapter: 1, from: 10, to: 11 } }));
    assert(r.usfm === trunk, "parche-estructura: el tronco queda byte a byte");
    assert(r.conflicts.length === 1 && r.conflicts[0]!.kind === "estructura", "parche-estructura: conflicto de estructura");
  });
  it('parche-sintetiza: new verse and new span are written as single lines, in order', () => {
    // parche-sintetiza: new verse and new span are written as single lines, in order
    const trunk = ch1(["\\v 9 Nueve.", "\\v 12 Doce."]);
    const side = ch1(["\\v 9 Nueve.", "\\v 10-11   Puente   nuevo.", "\\v 12 Doce."]);
    const r = track(patchTrunkByVerse(trunk, [side], { ancestor: trunk, scope: { chapter: 1, from: 10, to: 11 } }));
    assert(verseLines(r.usfm).join("|") === "\\v 9 Nueve.|\\v 10-11   Puente   nuevo.|\\v 12 Doce.", "parche-sintetiza: puente nuevo en su sitio");
    const split = track(patchTrunkByVerse(
      ch1(["\\v 9 Nueve.", "\\v 10-11 X", "\\v 12 Doce."]),
      [ch1(["\\v 9 Nueve.", "\\v 10 a", "\\v 11 b", "\\v 12 Doce."])],
      { ancestor: ch1(["\\v 9 Nueve.", "\\v 10-11 X", "\\v 12 Doce."]), scope: { chapter: 1, from: 10, to: 11 } },
    ));
    assert(verseLines(split.usfm).join("|") === "\\v 9 Nueve.|\\v 10 a|\\v 11 b|\\v 12 Doce.", "parche-sintetiza: separar puente");
    const empty = track(patchTrunkByVerse("\\id NEH\n\\c 1\n\\p\n", [ch1(["\\v 3 Tres."])], { scope: { chapter: 1, from: 3, to: 3 } }));
    assert(empty.usfm === "\\id NEH\n\\c 1\n\\p\n\\v 3 Tres.\n", `parche-sintetiza: capítulo sin versos (${JSON.stringify(empty.usfm)})`);
    const noChapter = track(patchTrunkByVerse("\\id NEH\n\\c 1\n\\p\n\\v 1 Uno.\n", [
      "\\id NEH\n\\c 2\n\\p\n\\v 1 Dos uno.\n",
    ], { scope: { chapter: 2, from: 1, to: 1 } }));
    assert(noChapter.usfm === "\\id NEH\n\\c 1\n\\p\n\\v 1 Uno.\n\\c 2\n\\p\n\\v 1 Dos uno.\n", "parche-sintetiza: capítulo nuevo al final");
  });
  it('parche-igual-al-merge: patched slots equal the full verse merge', () => {
    // parche-igual-al-merge: patched slots equal the full verse merge
    const trunk = ch1(["\\v 1 T1", "\\v 2 T2", "\\v 3", "\\v 4 T4"]);
    const ancestor = ch1(["\\v 1 T1", "\\v 2 O2", "\\v 3", "\\v 4 T4"]);
    const side = ch1(["\\v 1 T1", "\\v 2 B2", "\\v 3 B3", "\\v 4 T4"]);
    const opts = { ancestor, scope: { chapter: 1, from: 2, to: 3 } };
    const p = track(patchTrunkByVerse(trunk, [side], opts));
    const m = mergeUsfmByVerse(trunk, [side], opts);
    assert(JSON.stringify(verseSlotsOf(p.usfm)) === JSON.stringify(verseSlotsOf(m.usfm)), "parche-igual-al-merge: mismos versículos");
    assert(p.conflicts.length === m.conflicts.length, "parche-igual-al-merge: mismos conflictos");
  });
  it('parche-sin-marcadores: conflicting texts never produce Git markers', () => {
    // parche-sin-marcadores: conflicting texts never produce Git markers
    const trunk = poetryTrunk.replace(oldTen, "\\v 10 Del tronco.\n");
    const side = poetryTrunk.replace(oldTen, "\\v 10 Del lado.\n");
    const r = track(patchTrunkByVerse(trunk, [side], { ancestor: poetryTrunk, scope: { chapter: 1, from: 10, to: 10 } }));
    assert(!/<<<<<<<|=======|>>>>>>>/.test(r.usfm), "parche-sin-marcadores: sin marcadores Git");
    assert(r.usfm.includes("\\v 10 Del lado.\n") && r.conflicts.length === 1, "parche-sin-marcadores: gana el lado, conflicto anotado");
  });
});

describe("Option A: Cerrar patches the trunk instead of rebuilding the book (lo que aplica a Servos)", () => {
  it("parche-sin-cambios: mismo texto", () => {
    const r = track(patchTrunkByVerse(poetryTrunk, [poetryTrunk], { ancestor: poetryTrunk, scope: { chapter: 1, from: 10, to: 11 } }));
    assert(r.usfm === poetryTrunk && r.patched.length === 0, "parche-sin-cambios: mismo texto");
  });
});
