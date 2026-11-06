# Servos on language packs format 3 (C3, without the assistant) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servos installs, updates and reads language packs format 3 through `@bt-synergy/language-pack-client`:
from the packs Worker (staging in test builds), from today's `.langpack.zip` (SD or file picker) and from transfer
files (`.tcpack`); it shows the cross-book lookups and full-text search, and a test build for Android and Windows
proves it on Abel's 2 GB phone.

**Architecture:** Servos keeps today's format 2.0 path whole and adds a format 3 path beside it, chosen by the packs
server: staging means format 3, production means today's path (production answers `v3-off`). The format 3 path has
one client (`src/resources/v3/client.ts`: IndexedDB store, staging `httpSource`, the staging key) and one seam on the
read side: `library.ts` `loadBook` asks `readBookV3` for the same `PrototypeData` chapters it builds today from the
rows, so no screen changes to read a book. A book the format 3 store does not have is still read from the rows, so a
device that switches loses nothing. Two small fixes go into bt-synergy first (old packs build no books; installs
fetch one segment at a time).

**Tech Stack:** TypeScript, React 18, Vite, Vitest (node, fake-indexeddb), Capacitor 8 (Android), Tauri 2
(Windows), bt-synergy `language-pack-client` and `language-pack-v3` from source.

**Spec:** the Claude doc «tc-language-packs: contrapropuesta para la próxima versión mayor»
(https://claude.ai/artifact/5Vw6P8Bm3bo51VkTRwsuPA), tab Consumidores, row C3 and «La transición sin red»;
bt-synergy `packages/language-pack-client/README.md`, `packages/language-pack-v3/spec/serving.md`,
`docs/superpowers/plans/2026-11-03-language-pack-client-c1.md`. The assistant (C2) is out of scope (Abel, 6 Nov).

## What was checked before planning (6 Nov)

- Servos uses bt-synergy from source through Vite aliases (`vite.config.ts`, `scripts/btSynergy.ts`), pinned by
  `bt-synergy.ref` (`329d459`). Its 714 tests pass against bt-synergy `2bb01a6c` (the C1 merge) with no change.
- Staging serves es-419 and common at revision 2, signed by key `78d2e6299a2de4d0`. es-419 has 6 books (3jn, est,
  jon, neh, rut, tit), 7 article groups, 16 lexicon units, a map and 16 optional aligned units; common has 66 `orig`,
  `xmap`, `xtopics`. English has all 66 books (Psalms: 1.1 MB, plus `orig:psa`).
- `install('es-419', { books: ['tit'] })` from staging on Abel's desktop: 2.26 MB in **153 requests, one after
  another, 48 s**. On a phone this is the first thing a person waits for. → Task A2.
- `importOldPack` of today's real packs (`servos-paquetes/2026-10-29-prepare-language-329d459`) **builds no book**:
  the originals pack's manifest lists no `books` for UGNT and UHB, so `zipSource` says they carry none and every book
  is "left out (the pack waits for them)". Only articles, lexicons and the map arrive. → Task A1.
- Queries on Titus from staging answer as the README says: `passage`, `renderings({ strong: 'G5485' })` (6
  renderings), `books({ article })` (Rut: 7, not installed, 53 KB), `search('gracia')`.

## Global Constraints

- Who: this is **shared** work. Part A is in bt-synergy (a uW repo); under Abel's format 3 exception (memory
  `langpacks-v3-claude-writes-all`) Claude writes it, Claude subagents review it, Codex reviews A2 if it has tokens.
  Part B is Servos (Idiomas Puentes): Claude writes, tests and reviews it. Cursor is not used.
- Part B starts on bt-synergy `2bb01a6c`; Tasks B2 and B5 need A1, and B4 needs A2. Until Part A is merged, Servos
  runs with `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/servos-c3-bts` on Part A's branch; `bt-synergy.ref`
  moves to the merge commit only after Abel merges it. Push, PRs, merges and releases only with Abel's yes.
- Production is never touched: no request to production's `/v3/`, no change to the Workers. Production builds keep
  today's behaviour byte for byte where format 2.0 is concerned.
- Format choice: `packsFormat(): 2 | 3` is 3 exactly when the packs server is `staging` (`packsServer.ts`). Nothing
  else switches it.
- Trusted keys: the `.pub` files of bt-synergy `packages/language-pack-v3/keys/`, read at build time; never a key in
  Servos's repo, never a key from the network. `trust` always has `trustedKeys` (an empty map would still demand
  signatures).
- Store: `indexedDbStore({ name: 'servos-paquetes-v3' })`. The format 2.0 databases (`servos-recursos`,
  `servos-catalogo`, `servos-partes`, `servos-enlinea`) are never deleted or written by the format 3 path.
- UI texts only in `src/app/i18n/{es,pt,en}.json`, new group `paquetes3.*` (and `ayudas.*` for the lookups); a phrase
  that says «teléfono» gets its `.computadora` twin; `wording.test.ts` passes. Every touched screen passes the 375 px
  checklist of `docs/FILOSOFIA_DE_DISENO.md`. What is not on the device is said as «no está en este aparato», never
  as zero; a source with no coverage says «sin notas en este libro».
- Code comments and commits in English, short title, a body that says why, `Co-Authored-By` trailer.
- `npm test` and `npm run typecheck` green at every commit; test output of long runs goes to a file.

## Review Focus

1. **A device that already has today's packs switches to staging.** Every book it could read stays readable (rows
   fallback) and nothing is deleted; once the same book is installed in format 3, that one is read.
   → B3 test `keeps reading rows until format 3 has the book`.
2. **An install cut halfway** (network drop, app closed, 429). What was complete is active, the rest waits, and the
   next install finishes without fetching again what is stored. → A2 test `stops on E_NETWORK and keeps complete
   units`, B4 test `a second download fetches only what is missing`.
3. **A catalog whose signature fails, or a transfer file whose catalog is local.** Nothing is installed, and the person
   reads one sentence that says the file or the server could not be trusted. → B4 and B5 tests on `E_SIGNATURE`.
4. **An old pack that cannot become books here**: no originals on this device (web app), or a published catalog of
   the language already installed (`skipped`). The person is told which and what to do; no silent success.
   → B5 tests `no originals` and `skipped`.
5. **The store is full** (`E_STORE`) during an install or an import. Nothing half-active, the message says space.
   → B4 and B5 tests with a store whose `put` throws.

---

## Part A — bt-synergy (shared; branch `feat/language-pack-client-c3` in `wt/servos-c3-bts`)

### Task A1: old packs build their books with a real originals pack

**Files:**
- Modify: `packages/language-pack-v3/src/source/zipSource.ts` (`carriedBooks`, ~74-78)
- Test: `packages/language-pack-v3/src/source/zipSource.test.ts` (create if absent)
- Test: `packages/language-pack-client/src/client.test.ts`

**Interfaces:**
- Produces: `zipSource(originalsZip).resources('originals')` lists, per original, the books it has rows of, when the
  manifest has no `books` for it. `importOldPack(bookPack, { originals: await zipSource(originalsZip) })` activates
  `book:<code>` for each book of the pack.

- [ ] **Step 1: Write the failing tests.** `zipSource: an original without "books" in the manifest lists the books of
  its sot rows` builds a tiny zip in the test (manifest `kind: 'originals'`, resource `role: 'original'` with
  `rows.sot` and no `books`, rows `scripture-usj:unfoldingWord/el-x-koine/ugnt:tit:1` and `…:tit:2`) and expects
  `books: ['tit']`. In the client: `importOldPack builds the book with an originals pack whose manifest lists no books`
  with `spec/tests/data/es-419-tit.langpack.zip` and an originals zip made the same way from the test data, expecting
  `activated` to contain `es-419/book:tit`. An opt-in test (`LP3_OLD_PACKS=<folder>`) does the same with the real
  `originals.langpack.zip` and `es-419-tit.langpack.zip` and reads `passage('tit 2:11')`.
- [ ] **Step 2: Run** `bun test packages/language-pack-v3/src/source packages/language-pack-client/src/client.test.ts`;
  expected FAIL (`books: []`).
- [ ] **Step 3: Implement.** When a resource has `rows.sot` and no `books`, its books are the distinct book codes of
  its sot row keys (the key forms `bookOfRow` already reads), sorted; the `kind: 'book'` filter still applies.
- [ ] **Step 4: Run** the same tests and the package suites; expected PASS.
- [ ] **Step 5: Commit** `fix(language-pack-v3): an originals pack lists the books of its rows`.

### Task A2: installs fetch several segments at a time

**Files:**
- Modify: `packages/language-pack-client/src/install.ts` (segment loop ~120-160), `src/client.ts` (option),
  `README.md` (the option and the measured time)
- Test: `packages/language-pack-client/src/install.test.ts` or `client.test.ts`

**Interfaces:**
- Produces: `install(lang, want, { signal?, onProgress?, concurrency? })`, `concurrency` default `4`, `1` keeps
  today's order. Same `InstallReport`, same rules: a 404 leaves its unit waiting; any other `E_NETWORK` lets the
  requests already running settle, stores what verified, activates what is complete, saves the state once, then
  rejects with the first such error (its `status` and `retryAfter`). `onProgress` still fires once per stored segment.

- [ ] **Step 1: Write the failing tests** against `test/fakeServer.ts` with a delay per segment:
  `install runs up to 4 segment requests at once` (max in flight is 4, never 5);
  `install with concurrency 1 asks in catalog order`;
  `stops on E_NETWORK and keeps complete units` (a 503 on one segment of book B while book A is complete: A active,
  B waiting, state saved, rejects `E_NETWORK` 503, no request started after the failure is seen);
  `a 429 rejects with retryAfter after in-flight requests settle`;
  `abort stops new requests and keeps complete units`.
- [ ] **Step 2: Run** them; expected FAIL on the in-flight count.
- [ ] **Step 3: Implement** a small worker pool over the segment list (no new dependency): N workers take the next
  segment; the first non-404 failure sets a stop flag that workers check before taking another.
- [ ] **Step 4: Run** the client suite and `LP3_STAGING=1 bun test src/staging.e2e.test.ts`; expected PASS. Measure
  `install('es-419', { books: ['tit'] })` from staging again and write the time in the README beside the 48 s.
- [ ] **Step 5: Commit** `feat(language-pack-client): install several segments at a time`.

After A1 and A2: one whole-branch review (subagent; Codex on A2 if available), then Abel decides the PR to
`unfoldingWord/tc-study`. Its merge commit becomes Servos's `bt-synergy.ref` (Task B9).

---

## Part B — Servos (this branch, `claude/lp3-c3-73f4b1`)

### Task B1: the format 3 client and the switch

**Files:**
- Create: `src/resources/v3/client.ts`, `src/resources/v3/keys.ts`, `src/resources/v3/client.test.ts`
- Modify: `bt-synergy.ref` (→ `2bb01a6c`), `src/resources/btSynergy.d.ts` (the client's types Servos uses),
  `src/resources/online/packsServer.ts` (`packsFormat`, `V3_ORIGINS`)

**Interfaces:**
- Produces:
  - `packsFormat(): 2 | 3` — 3 iff `packsServer()` is `staging`.
  - `V3_ORIGINS: Record<PacksServerId, string>` — staging `https://translation-helps-mcp-v2-preview.unfoldingword.workers.dev`;
    production's origin is listed but `packsFormat()` never sends it a request.
  - `trustedKeys(): Record<string, Uint8Array>` — every `*.pub` of bt-synergy's `language-pack-v3/keys/`
    (`import.meta.glob(..., { query: '?raw', eager: true })`), key id = file name.
  - `packsV3(): Promise<LanguagePackClient>` — one client per app run: `indexedDbStore({ name: 'servos-paquetes-v3' })`,
    `httpSource({ base: V3_ORIGINS.staging })`, `trust: { trustedKeys: trustedKeys() }`, `index: searchIndexV3()`
    (Task B7; until then none).
  - `readerV3(lang): Promise<PackReader | null>` — cached per language, dropped by `forgetReadersV3()` after any
    install or import.

- [ ] **Step 1: Write the failing tests:** `trustedKeys has 78d2e6299a2de4d0 with the 32 bytes of the .pub file`;
  `packsFormat is 3 only for staging`; `packsV3 installs and reads a signed sample` (the client's
  `test/fakeServer.ts` and `test/sample.ts` through an injected `fetch`, fake-indexeddb, `book:tit` active, `passage`
  answers); `a catalog signed by an unknown key installs nothing (E_SIGNATURE)`.
- [ ] **Step 2: Run** `npx vitest run src/resources/v3`; expected FAIL (no module).
- [ ] **Step 3: Implement** the three files; move `bt-synergy.ref`; declare in `btSynergy.d.ts` only the client
  surface Servos calls.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`; expected PASS.
- [ ] **Step 5: Commit** `Servos talks to format 3 packs on staging`.

### Task B2: a book read from format 3 is the same book on screen

The heart of C3: `readBookV3` gives `loadBook` what `chapterData` gives it today.

**Files:**
- Create: `src/resources/v3/bookV3.ts` (texts and words), `src/resources/v3/helpsV3.ts` (notes, questions, links,
  intros), `src/resources/v3/companionsV3.ts` (lexicon, MACULA, articles), and a test file for each
- Create: `src/resources/v3/sameBook.test.ts` (rows against format 3, from the same pack)

**Interfaces:**
- Consumes: `PackReader.book/orig/articles/segments/unitOf` (B1); bt-synergy `lexView`, `eventKind`.
- Produces:
  - `readBookV3(reader: PackReader, language: string, book: string, o?: { sections?: (ch: number) => SectionStarts }):
    Promise<{ chapters: PrototypeData[]; lexicon: Record<string, LexiconFile>; macula: { trees; referents } } | null>`
    — `null` when `book:<book>` is not installed.
  - `sourcesV3(reader, language): BookSources` — the resource keys of the language's texts and helps (from
    `BookModel.res`), so credits and the panels name them as today.
  - `readArticleV3(reader, ref: ArticleRef): Promise<{ title: string; markdown: string } | null>` — via
    `reader.article('ta:…' | 'tw:…', 'all')`.
  - `verseHelpsV3(reader, language, book, places): Promise<VerseHelps[]>` — same answer as `readVerseHelps` (for
    «qué cambió», Task B4).
- What maps to what (the implementer decides the code; these are the decisions):
  - `TextModel.events` → `ChapterPiece[]` (headings from `para:s*`, paragraphs from `para:p|q*|m…`, verses from verse
    events, `"1-2"` as its first number) and `lines` / `WordLine[]`; word numbers run through the chapter as today.
  - `align[word]` (original positions) → `toOriginal`, via the `orig` segment's positions of that chapter.
  - `OrigModel.words` → the original's `words` (lemma, strong, morph); the qere/ketiv and word notes as the rows path
    gives them today (`originalWordsOf`).
  - Note and link places: a row's `quote` (original positions) → the bridge words aligned to them (`align`), the k-th
    of repeated links as `screenData.ts` does now. The text of the note's quote in each text (`glt`, `gst`) is those
    words joined.
  - Intros: notes whose `isIntro` flag is set, `front`/`intro` refs → `bookIntro` and `intro`.
  - `words` / `academy` of a chapter: the articles its links and notes name, via `readArticleV3`.
  - Lexicon: the `lex:` units the book's Strong numbers fall in, read with `lexView`, keyed as `keepLexicon` keys them.
- [ ] **Step 1: Write the failing equivalence test** `sameBook.test.ts`: open the bt-synergy spec fixture
  `es-419-tit.langpack.zip` (with an originals zip built as in A1's test) twice, once with today's `openPack` into
  fake IndexedDB and once with `importOldPack` into a memory client, then for every chapter of Titus compare
  `chapterData(...)` with `readBookV3(...).chapters[i]`: same verses and verse text (spaces normalised), same word
  count per verse, same original words with Strong numbers, same note ids with their `quote`, `academy` and `places`,
  same questions, same link ids, articles and places, same intros. Allowed differences are listed in the test, each
  with its reason, and nothing else. The same comparison runs opt-in on the real packs with `SERVOS_PAQUETES`.
- [ ] **Step 2: Run** it; expected FAIL (no module).
- [ ] **Step 3: Implement** `bookV3.ts`, then `helpsV3.ts`, then `companionsV3.ts`, each with its unit tests
  (`a verse range "1-2" counts as verse 1`, `a heading before verse 1 is a heading piece`, `a link repeated in a verse
  takes the k-th place`, `a note with no quote has no places`, `a lexicon entry is read from its lex unit`).
- [ ] **Step 4: Run** `npx vitest run src/resources` and the opt-in real run; expected PASS.
- [ ] **Step 5: Commit** in three commits, one per file group.

### Task B3: the library reads format 3 first

**Files:**
- Modify: `src/app/projects/library.ts` (`openLibrary`, `refreshLibrary`, `availabilityOf`, `bookState`,
  `helpsLanguagesHere`, `readArticle`, `loadBook`), `src/resources/sources.ts` (merge format 3 availability)
- Test: `src/app/projects/libraryV3.test.ts`

**Interfaces:**
- Consumes: `packsFormat`, `readerV3`, `readBookV3`, `sourcesV3`, `readArticleV3`.
- Produces: `refreshLibrary()` also reads `client.status(lang)` for each helps language and keeps
  `v3Books: Map<language, Set<book>>`; a book in it is read by `readBookV3`, any other by today's `chapterData`.

- [ ] **Step 1: Write the failing tests:** `keeps reading rows until format 3 has the book`;
  `reads format 3 once the book is installed there`; `format 2 builds never open the format 3 store`
  (`packsFormat() === 2`: no `indexedDB.open('servos-paquetes-v3')`); `an article reads from format 3 when the
  language has it there`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`; expected PASS. Open the web app with `?packs=staging` and the fake Worker of Task B4
  and see Titus read as before.
- [ ] **Step 5: Commit** `The library reads books from format 3 when the device has them there`.

### Task B4: download and update from the Worker

**Files:**
- Create: `src/resources/v3/onlineV3.ts`, `src/resources/v3/onlineV3.test.ts`
- Modify: `src/resources/online/onlineResources.ts` (each exported action delegates when `packsFormat() === 3`:
  `startOnline`, `checkForUpdates`, `downloadBook`, `downloadOffer`, `bookDownloadSize`, `askLanguage`,
  `declineOffer`), `src/app/i18n/{es,pt,en}.json`

**Interfaces:**
- Consumes: `packsV3`, `forgetReadersV3`, `refreshLibrary`, `watchHelps`/`keepHelpsChanges` with `verseHelpsV3`.
- Produces: the same `OnlineState` through `useOnlineResources()`, so Home, AddBook and BookScreen do not change.
  - Book download: `install(lang, { books: [book], units: <the lex units of its Strong numbers> })`, with progress
    into `OnlineState` (`bajando` with percent from `Progress.bytes` over the planned bytes).
  - Size: the bytes of the units not yet installed (`status(lang).units`), the same `BookSize` shape.
  - Updates: `refresh(lang)` at start, on reconnect and every `RECHECK_MS`; an update of an installed unit is the
    Home offer with its bytes; «Ahora no» remembers the offered revisions.
  - Answers → today's words: `E_NO_PACK` → `sinIdioma`; `E_NETWORK` 429 → `espera` with `retryAfter`; 404 `v3-off`,
    5xx, offline → `noDisponible`; `E_SIGNATURE` → new `paquetes3.noConfiable` («No se pudo comprobar que estos
    textos vienen de Idiomas Puentes. No se instaló nada.»); `E_STORE` → today's «no hay espacio» phrase;
    `E_DOWNGRADE` never shown (refresh without `confirmDowngrade` keeps what is here).
  - Before an install that replaces a book: `watchHelps` with `verseHelpsV3`; after: `keepHelpsChanges`, then
    `forgetReadersV3()`, `refreshLibrary()`.
- [ ] **Step 1: Write the failing tests** with the client's fake server behind an injected `fetch`:
  `downloads a book and the library reads it`; `a second download fetches only what is missing`;
  `a 429 waits and says espera`; `v3-off says noDisponible and keeps the book`; `E_SIGNATURE installs nothing and
  says noConfiable`; `a full store says no hay espacio and activates nothing new`; `an update is offered with its
  bytes and Ahora no hides it until the next revision`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement**; add the new texts in es, pt, en.
- [ ] **Step 4: Run** `npm test`; the opt-in `SERVOS_WORKER=staging` test installs es-419 Titus from staging.
- [ ] **Step 5: Commit** `Servos downloads and updates format 3 packs`.

### Task B5: today's packs and transfer files

**Files:**
- Create: `src/resources/v3/filesV3.ts`, `src/resources/v3/filesV3.test.ts`
- Modify: `src/app/screens/ReceivePack.tsx` (accept `.zip` and `.tcpack`), `src/app/projects/receiveHelps.ts`,
  `src/app/projects/packsInside.ts` (format 3: bundled packs through `importOldPack`), `src/app/frame/saveFile.ts`
  (a bytes variant), `src/app/screens/BookScreen.tsx` (menu «Pasar textos y ayudas»), i18n files

**Interfaces:**
- Produces:
  - `originalsSource(): Promise<RowSource | null>` — the bundled `paquetes/originals*.langpack.zip` (phone and
    computer builds), else an originals pack the person received before (its bytes kept in IndexedDB
    `servos-originales`), else `null`.
  - `importOldPackV3(bytes): Promise<FileOutcome>` and `importTransferV3(bytes): Promise<FileOutcome>`, with
    `FileOutcome = { state: 'added'; books: string[]; articles: boolean } | { state: 'sinOriginales' } |
    { state: 'yaPublicado' } | { state: 'noConfiable' } | { state: 'sinEspacio' } | { state: 'noEsPaquete' }`.
  - `exportBookV3(lang, book): Promise<Uint8Array>` — `exportTransfer({ lang, mode: 'full', books: [book] })`,
    saved as `<lang>-<book>.tcpack`.
- Rules: in format 3 an originals pack is kept (for later book packs) and also imported; a book pack with no
  originals here says `sinOriginales` («Para abrir este paquete hace falta también el de los originales»);
  `skipped` → `yaPublicado` («Este aparato ya tiene una versión más nueva de estos textos»). Old rows are never
  deleted (spec: «los recursos viejos se quedan hasta que la importación termina bien»).
- [ ] **Step 1: Write the failing tests:** `an old book pack becomes an active book` (A1's fixture);
  `no originals here says sinOriginales`; `a published catalog here says yaPublicado`; `a transfer file round-trips
  a book` (export from one client, import into another, `passage` answers); `a transfer file with a local catalog
  says noConfiable`; `a cut transfer file adds nothing` (truncate the bytes); `a full store says sinEspacio`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement**, then the screen: the file picker takes `.zip,.tcpack`; the summary step shows the
  file's name and size before importing a `.tcpack` (the library has no describe for it), and what was added after.
- [ ] **Step 4: Run** `npm test`; check ReceivePack and the book menu at 375 px.
- [ ] **Step 5: Commit** `Servos imports today's packs and passes transfer files`.

### Task B6: the cross-book lookups on screen

**Files:**
- Create: `src/resources/v3/lookups.ts` (pure shaping of the answers), `src/app/frame/EnTodaLaBiblia.tsx`,
  `src/app/frame/DondeAparece.tsx`, tests for `lookups.ts`
- Modify: `src/app/frame/OriginalWord.tsx` (word card), `src/app/frame/ArticleSheet.tsx`, i18n files

**Interfaces:**
- Consumes: `reader.renderings({ strong })`, `reader.books({ article } | { concept })`, `Answer.notInstalled`,
  `downloadBook` (B4).
- Produces: `wordAcrossBooks(answer): { renderings: { text; count; refs }[]; missing: { book; bytes }[] }` and
  `articleAcrossBooks(answer): { here: { book; count }[]; missing: { book; count; bytes }[]; none: string[];
  installed: boolean }`.
- What the person sees (texts from the 28 Oct plan, group `ayudas.*`): in the word card, «En toda la Biblia»: how
  the bridge text renders the word, with count and places (a tap opens the verse when the book is here); below, «No
  están en este aparato» with each missing book and its size, and «Bajar» when online. In an article, «Dónde
  aparece»: the books with their counts, those not here apart with their size. No map on the device (`installed:
  false`) hides the section and offers nothing; `none` is never written as zero.
- [ ] **Step 1: Write the failing tests** for `lookups.ts`: `missing books carry their bytes`, `none is not zero`,
  `no map hides the section`, `more than 300 places shows counts only`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** the shaping, then the two components.
- [ ] **Step 4: Run** `npm test`; check both at 375 px on Titus from staging (Rut appears as not here, 53 KB).
- [ ] **Step 5: Commit** `Show where a word and an article appear across books`.

### Task B7: full-text search with SQLite

**Files:**
- Create: `src/resources/v3/search/tauriDriver.ts`, `src/resources/v3/search/capacitorDriver.ts`,
  `src/resources/v3/search/searchIndex.ts`, `src/app/screens/SearchSheet.tsx`, tests
- Modify: `src-tauri/Cargo.toml` and `src-tauri/src/lib.rs` (`tauri-plugin-sql`, feature `sqlite`),
  `src-tauri/capabilities/default.json` (`sql:default`), `package.json` (`@tauri-apps/plugin-sql`,
  `@capacitor-community/sqlite`), `android/` (`npx cap sync`), `src/app/screens/BookScreen.tsx` (menu «Buscar»),
  i18n files

**Interfaces:**
- Produces: `searchIndexV3(): SearchIndex | undefined` — `sqlIndex(tauriDriver())` on Windows,
  `sqlIndex(capacitorDriver())` on Android, `undefined` on the web (the library's memory index). Each driver
  implements `SqlDriver` (`exec` of two statements, `run`/`all` with `?` params, nested `transaction`).
- [ ] **Step 1: Spike, before any code:** on the emulator, open `@capacitor-community/sqlite` and run
  `CREATE VIRTUAL TABLE t USING fts5(x, tokenize='unicode61 remove_diacritics 2')`; on Windows the same with
  `tauri-plugin-sql`. If one has no FTS5, stop and ask Abel (the fallback is wa-sqlite on that platform).
- [ ] **Step 2: Write the failing tests:** each driver against a fake of its plugin API (statements split, params
  passed, transaction commits and rolls back); `search finds a note by a word without its accent`; the sheet's
  shaping (`hits grouped by kind`, `a hit opens its verse`).
- [ ] **Step 3: Implement**; the index is filled by the client on install and import.
- [ ] **Step 4: Run** `npm test`; on the emulator and on Windows, search «gracia» in es-419 Titus.
- [ ] **Step 5: Commit** `Full-text search over installed books`.

### Task B8: the phone timings

**Files:**
- Create: `src/resources/v3/timings.ts`, `src/app/screens/TimingsSheet.tsx`, a test for `timings.ts`
- Modify: `src/app/screens/AboutSheet.tsx` (a «Medir paquetes» row, shown only with `?medir` or after staging was
  chosen)

**Interfaces:**
- Produces: `measure(lang, book, ref, runs = 20): Promise<{ open: Stat; book: Stat; passage: Stat; context: Stat }>`,
  `Stat = { median; min; max }` in ms; each run opens a fresh reader over the IndexedDB store, so store reads count
  (the desktop bench did not count them).
- [ ] **Step 1: Write the failing test** `measure returns a median of n runs` (a memory client, 3 runs).
- [ ] **Step 2–4: Implement**, show the table with the targets (< 3 s readable, < 50 ms a verse with its helps) and a
  «Copiar» button.
- [ ] **Step 5: Commit** `A screen to measure format 3 on the phone`.

Steps for Abel on the 2 GB phone (in the report): install the test APK; open «Acerca de» → «Medir paquetes»; let it
install English Psalms from staging (about 2 MB with its original); press «Medir»; copy the table to the chat.

### Task B9: test builds and the report

**Files:** `bt-synergy.ref` (→ Part A's merge commit, after Abel merges it), `docs/PAQUETES_DE_IDIOMA.md` (a short
format 3 section), report in the shared notes folder.

- [ ] **Step 1:** whole-branch review (three Opus reviewers: client and files; reading equivalence; screens and
  native), fixes until clean.
- [ ] **Step 2:** Android APK and Windows installer as test builds (memories `servos-android-build`,
  `servos-tauri-build`), opened once with `?packs=staging` saved, with the bundled packs inside.
- [ ] **Step 3:** on the emulator and on Windows: install es-419 Titus from staging; import `es-419-tit.langpack.zip`
  from a folder standing for the SD card (the file picker); open «En toda la Biblia» on «gracia» (Tit 2:11) and
  «Dónde aparece» on `figs-metaphor`; search «gracia»; export Titus as `.tcpack` and import it on the other device.
  Screenshots into the report.
- [ ] **Step 4:** the report in Spanish to Abel and to the session that started this one; Abel runs B8 on his phone.
- [ ] **Step 5:** push, PR and release only with Abel's yes.
