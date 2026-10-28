# En toda la Biblia (paquetes enlazados, etapa 1, parte de Servos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The word card shows «En toda la Biblia»: every book and verse where the touched word's Strong's number
occurs, which of those books are on this device, and which are not. The data is bt-synergy's word index: the words
of each original book numbered within the book, and per book the list of words of each Strong code
(`PAQUETES_ENLAZADOS.md`, section 4).

**Architecture:** `src/resources/occurrences.ts` wraps bt-synergy's `findOccurrences` with what the device has.
`src/app/frame/enTodaLaBiblia.ts` turns the result into what the card shows (pure, tested);
`src/app/frame/EnTodaLaBiblia.tsx` draws it inside the card's «Más sobre…» part. Opening a pack skips the `index`
layer of another version instead of refusing the pack.

**Tech Stack:** TypeScript, React, Vite 7, Vitest (node env, fake-indexeddb), bt-synergy `language-pack` from source.

**Spec:** `docs/PAQUETES_ENLAZADOS.md` (sections 4, 5, 6, 7 and 9). The bt-synergy part is
`bt-synergy/docs/superpowers/plans/2026-10-28-language-packs-index-stage1.md` (branch `docs/packs-index-stage1`).

## Global Constraints

- Before any code: Abel says, per task, whether Claude or Cursor writes it.
- **Starts only when** (a) Servos PR #10 is merged, and (b) bt-synergy Tasks 1–7 are merged into `master` with
  Abel's yes. Task 1 moves `bt-synergy.ref` to that merge commit; every test run before that uses
  `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/tcs-packs-index-impl`.
- Read `docs/DISENO.md` and `docs/FILOSOFIA_DE_DISENO.md` first (`CLAUDE.md`). Interface and product docs in Spanish;
  code comments and commits in English, short title and a body that says why; commits end with the
  `Co-Authored-By` trailer. Nothing pushed or published without Abel's yes.
- UI texts only in `src/app/i18n/{es,pt,en}.json`, group `ayudas.*`; phrases that say «teléfono» get a `.computadora`
  twin; `wording.test.ts` must pass. Mobile first: check at 375 px.
- Texts (es): `ayudas.enTodaLaBiblia` «En toda la Biblia»; `ayudas.enTodaLaBibliaCuenta` «{{n}} veces en {{libros}}
  libros»; `ayudas.noEstanEnAparato` «No están en este aparato»; `ayudas.verLugares` «Ver los {{n}} lugares».
- Many places: when `n > 300`, a book shows only its count until its row is opened.
- The section is hidden when there is no index row (an old pack); it never says «0 veces».
- `index` never enters the check that refuses a whole pack (`madeForOtherVersion`).

## Review Focus

1. A pack whose `index` version differs from Servos's: it opens, without the index (Task 2).
2. A device with only the original of Titus (parts) asking for χάρις: the 22 other books are listed as not on this
   device, not left out (Task 3).
3. ὁ (G3588, 19 808 places): the card opens fast and shows counts per book, not every verse (Task 4).
4. A word aligned to several original words (a multi-word card): one section per lexicon word, as the card already
   does (Task 5).
5. The touched verse: it is marked in its book's list, so the person sees where they are (Task 4).

---

### Task 1: Move to the bt-synergy that has the index

**Files:**
- Modify: `bt-synergy.ref`

- [ ] **Step 1:** Set `bt-synergy.ref` to the bt-synergy merge commit of the index work (full sha); `npm install` if
  the lockfile asks.
- [ ] **Step 2:** `npm test` and `npm run typecheck` → PASS (the version check of `bt-synergy.ref` too).
- [ ] **Step 3: Commit** `Use the bt-synergy that carries the Strong index`.

### Task 2: Opening a pack skips an index of another version

**Files:**
- Modify: `src/resources/store.ts` (`RESOURCE_VERSIONS.index = { helpsIndex: HELPS_INDEX_VERSION }`, imported from
  bt-synergy)
- Modify: `src/resources/packs.ts` (`madeForOtherVersion` leaves out bt-synergy's `OPTIONAL_LAYERS`)
- Test: `src/resources/packs.test.ts`

**Interfaces:**
- Consumes: `HELPS_INDEX_VERSION`, `OPTIONAL_LAYERS` (bt-synergy Tasks 1 and 4).

- [ ] **Step 1: Write the failing tests.** `opens a pack whose index is of another version`: a pack manifest with
  `versions.index.helpsIndex = 99` and the other layers equal to Servos's → `madeForOtherVersion` is false; `openPack`
  imports its `sot` rows and no `index:` row. `still refuses a pack of another prepared version` (unchanged rule).
- [ ] **Step 2: Run** `npx vitest run src/resources/packs.test.ts` → the first FAILS.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `Open a pack whose index is of another version, without the index`.

### Task 3: Read the occurrences with what the device has

**Files:**
- Create: `src/resources/occurrences.ts`, test `src/resources/occurrences.test.ts`

**Interfaces:**
- Consumes: `findOccurrences`, `Occurrences` (bt-synergy Task 6); `keysUnder` (`src/resources/store.ts`).
- Produces: `occurrencesOf(stores: ResourceStores, strong: string): Promise<Occurrences | null>`.

- [ ] **Step 1: Write the failing tests** (fake-indexeddb, rows written as a pack would, with bt-synergy's
  `encodeWords`):
  - `marks the books of the original this device has`: rows `index:strong:unfoldingWord/el-x-koine/ugnt:G5485:tit`
    and `…:G5485:rom` with their `index:verses:…` rows, and the book row
    `scripture-usj:unfoldingWord/el-x-koine/ugnt:tit` → `tit` on the device, `rom` not.
  - `is null without an index`.
  - `takes the text's spelling`: `'G54850'` finds the `G5485` row.
- [ ] **Step 2: Run** `npx vitest run src/resources/occurrences.test.ts` → FAIL.
- [ ] **Step 3: Implement.** The books on the device are the book rows of the original: `keysUnder(stores,
  'scripture-usj:{original}:')`, keeping keys with exactly one segment after the prefix (keys only; never read the
  prepared rows, 47 MB for the Hebrew). The device stamps come from the same book rows only if bt-synergy exposes
  them cheaply; otherwise `sameEdition` is left true and the design's rule for it waits for stage 2.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `Read where a Strong's number occurs, with the books this device has`.

### Task 4: What the card shows

**Files:**
- Create: `src/app/frame/enTodaLaBiblia.ts`, test `src/app/frame/enTodaLaBiblia.test.ts`

**Interfaces:**
- Consumes: `Occurrences`.
- Produces:
  `type BibleWide = { n: number; books: number; here: BookLine[]; elsewhere: BookLine[] }`,
  `type BookLine = { book: string; count: number; refs: string[]; current?: string; folded: boolean }`;
  `bibleWide(o: Occurrences, at: { book: string; ref: string }): BibleWide`.

- [ ] **Step 1: Write the failing tests.**
  - `splits books on the device from the rest`: χάρις with `tit` on the device → `here` = Titus, `elsewhere` = the other
    books in Bible order; `books` 23 when the row names 23.
  - `marks the touched verse`: at `tit 2:11` → Titus `current === '2:11'`.
  - `folds books when there are many places`: `n === 19808` → every line `folded: true`; `n === 156` → `false`.
  - `keeps verses and occurrences apart`: a book's `count` is its number of verses (Ruth 1:21 with יהוה twice counts
    once), while `BibleWide.n` is the row's `n`, every occurrence.
- [ ] **Step 2: Run** `npx vitest run src/app/frame/enTodaLaBiblia.test.ts` → FAIL.
- [ ] **Step 3: Implement** `bibleWide`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `What «En toda la Biblia» shows`.

### Task 5: «En toda la Biblia» on the word card

**Files:**
- Create: `src/app/frame/EnTodaLaBiblia.tsx`
- Modify: `src/app/frame/TouchWords.tsx` (`lexiconBody`: after the «otros sentidos» `<details>`, before the
  sentence-diagram `RowButton`)
- Modify: `src/app/i18n/es.json`, `pt.json`, `en.json` (the four texts of the Global Constraints)
- Test: `src/app/i18n/wording.test.ts` (existing), `src/app/frame/wordCard.test.ts` if the card's layout logic changes

**Interfaces:**
- Consumes: `occurrencesOf` (Task 3), `bibleWide` (Task 4); the lexicon help's `code`, `verse`, `place` already passed
  to `lexiconBody`.

- [ ] **Step 1:** Add the texts in the three languages; run `npx vitest run src/app/i18n` → PASS.
- [ ] **Step 2:** Write the component: it loads only when «Más sobre…» is opened; heading, the count line, the books
  on the device with their verses (the touched one marked), then «No están en este aparato» with the rest; folded
  books open on tap. Book names from the helper the book list already uses (no new table). Nothing when
  `occurrencesOf` is null.
- [ ] **Step 3:** `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 4:** Check by eye at 375 px with the packs of bt-synergy Task 7 (`SERVOS_PAQUETES_DENTRO` or «Recibir
  textos y ayudas»): «gracia» in Tito 2:11 shows 156 times in 23 books, Titus on the device; ὁ shows folded books.
  Screenshot for Abel.
- [ ] **Step 5: Commit** `The word card shows where the word is in the whole Bible`.

### Task 6: With real packs

**Files:**
- Modify: `src/resources/realPacks.test.ts`
- Modify: `docs/DISENO.md` (section 7: the index layer, one paragraph pointing to `PAQUETES_ENLAZADOS.md`)

- [ ] **Step 1: Write the test** (skipped without `SERVOS_PAQUETES`): with `SERVOS_PAQUETES=C:/Users/LENOVO/Git/Github/wt/paquetes-index`
  (bt-synergy Task 7), after opening `originals`, `es-419-base` and `es-419-tit`: `occurrencesOf(stores, 'G54850')` →
  `n` 156, 23 books, `tit` on the device with `'1:4 2:11 3:7 3:15'`.
- [ ] **Step 2: Run** it → PASS.
- [ ] **Step 3:** Update `DISENO.md`; **commit** `Real packs: the Strong index`. Before proposing the PR: an
  independent subagent review at high effort, each finding checked. Changing the packs inside the installers waits
  for Abel's yes.
