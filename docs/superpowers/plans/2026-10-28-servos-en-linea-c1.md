# Servos en línea, núcleo (plan 3, parte C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servos downloads the parts a project needs from the Worker (the project's book when it is chosen; updates
offered with their size) and applies them with bt-synergy's parts importer when nobody is typing, with «qué cambió».

**Architecture:** `src/resources/online/` holds a Worker client (`packsClient.ts`), a download queue into B's staging
(`downloads.ts`), the server choice (`packsServer.ts`) and the flow with its module store (`onlineResources.ts`). The UI
(AddBook, BookScreen, Home, PersonMenu) reads that store through a hook; triggers live in `main.tsx` and `App.tsx`.
Opening a whole pack forgets the register slots it overwrites (`packs.ts`).

**Tech Stack:** TypeScript, React, Vite 7, Vitest (node env, fake-indexeddb), bt-synergy `language-pack` /
`cache-adapter-indexeddb` from source.

**Spec:** `docs/superpowers/specs/2026-10-27-servos-en-linea-c1-design.md`

## Global Constraints

- bt-synergy: B is PR unfoldingWord/tc-study#51, branch `feat/packs-parts-importer`, head `b884621`, checked out with
  `bun install` at `C:\Users\LENOVO\Git\Github\wt\tcs-parts-importer`. Every test run uses
  `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/tcs-parts-importer`. Task 1 sets `bt-synergy.ref` to
  `b884621…` (full sha); after #51 merges, Task 9 moves it to the merge commit and the shared `../bt-synergy` (with
  Abel's yes). Never touch `C:\Users\LENOVO\Git\Github\bt-synergy` before that.
- Worker paths: list `{server}{compat}/{lang}`, originals `{server}{compat}/originals/{sha}`, part
  `{server}parts/{sha}`; `compat` = `f2.0-u2.3.0-p6000230-q9-a12-t1` (bt-synergy `compatKeyOf(PARTS_FORMAT_VERSION,
  …)` — compute it, do not hard-code it twice). Servers: production `https://tc-helps.mcp.servant.bible/v2/packs/`,
  staging `https://translation-helps-mcp-v2-preview.unfoldingword.workers.dev/v2/packs/`.
- localStorage keys: `servos.enLinea.servidor`, `servos.enLinea.buscado` (ISO time of the last check),
  `servos.enLinea.reintentar` (per language: ISO time), `servos.enLinea.ahoraNo` (per language: key of the offer
  declined, a hash of its sorted part shas — not the list `code`, which is the build's and stays the same across
  content releases),
  `servos.enLinea.listas` (per language: `{etag, list}` kept for 304s and for planning offline).
- Staging database name: `servos-partes`.
- Queue: 4 parts at a time; originals parts first. Recheck interval: 3 h (`RECHECK_MS = 3 * 60 * 60 * 1000`). Free
  space rule: `quota - usage >= 2 * plan.bytes`.
- UI texts only in `src/app/i18n/{es,pt,en}.json`, group `enLinea.*`; phrases saying «teléfono» get a `.computadora`
  twin; `wording.test.ts` must pass. Interface and product docs in Spanish; code comments and commits in English;
  commits end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; commit messages via
  `git commit -F <file>`.
- Every screen touched passes FILOSOFIA's 375 px checklist; one filled button per screen; the team's work is never
  touched.
- Nothing is pushed, published or deployed without Abel's yes. Tests: `npm test` and `npm run typecheck`.

## Review Focus

1. The Worker answers HTML or garbage with 200 (a captive portal): treated as `noDisponible`, nothing staged, no crash
   (Task 2).
2. The connection drops mid-queue, then returns: no part downloaded twice; the apply happens once all are staged
   (Task 3, Task 5).
3. The person types continuously while an update is ready: it never applies under them; it applies at the next pause
   (Task 5).
4. Two projects with different helps languages: originals planned once, from the newest originals list (Task 5).
5. A whole pack opened after parts: its books' register slots are forgotten and the next check plans them again
   (Task 6).

---

### Task 1: B's importer reachable from Servos

**Files:** Modify `bt-synergy.ref`, `src/resources/btSynergy.d.ts`, `src/resources/store.ts`; Test `src/resources/online/staging.test.ts`

**Interfaces — Produces:** declarations in `btSynergy.d.ts` for `@bt-synergy/language-pack`: `planParts`,
`partsCoverage`, `applyParts`, `readRegister`, `REGISTER_PREFIX`, `stagingFrom`, `compatKeyOf`, `PARTS_FORMAT_VERSION`,
types `PartsList`, `PartEntry`, `PlanInput`, `PartsPlan`, `Coverage`, `Register`, `SlotRecord`, `PartsStaging`,
`ApplyInput`, `ApplyResult`, `ApplyFailure`, `PackTarget.transactRaw`; for `@bt-synergy/cache-adapter-indexeddb`:
`IndexedDBByteStore` and `IndexedDBCacheAdapter.transactRaw`. Copy the shapes from
`wt/tcs-parts-importer/packages/language-pack/src/parts/*.ts` exactly. `store.ts` gains
`openPartsStaging(name = 'servos-partes'): PartsStaging` and `readPartsRegister(stores): Promise<Register>` (rows by
`getByPrefix(REGISTER_PREFIX)`).

- [ ] Step 1: set `bt-synergy.ref` to the full sha of `b884621` (`git -C …/wt/tcs-parts-importer rev-parse b884621`).
- [ ] Step 2: test `'the staging keeps verified parts and the register reads back what applyParts wrote'` — build a
  tiny list + one part with `writePart`, stage it, `planParts` + `applyParts` into `openResourceStores()` (unique
  names) with `packTargetFrom`, then `readPartsRegister` has that slot. RED (missing declarations/functions), then
  implement, GREEN; `npm test` and `npm run typecheck` with the variable set.
- [ ] Step 3: commit `Reach the parts importer from Servos`.

### Task 2: The Worker client, and a fake Worker

**Files:** Create `src/resources/online/packsClient.ts`, `src/resources/online/fakeWorker.ts`, `src/resources/online/packsClient.test.ts`

**Interfaces — Produces:**
```ts
type ListAnswer =
  | { kind: 'listo'; list: PartsList; etag: string | null }
  | { kind: 'igual' }                                   // 304
  | { kind: 'preparando'; retryAfter: number }          // 202, seconds
  | { kind: 'actualizarApp' }                           // 404 old-compat
  | { kind: 'noDisponible'; retryAfter: number }        // 503, 404 parts-off, non-JSON 200, network error
  | { kind: 'sinIdioma' }                               // 404 no packs for this language
  | { kind: 'espera'; retryAfter: number }              // 429
function fetchList(server: string, compat: string, lang: string, etag?: string | null): Promise<ListAnswer>
type OriginalsAnswer = { kind: 'listo'; list: PartsList } | { kind: 'noEstá' } | { kind: 'espera'; retryAfter: number } | { kind: 'falla' }
function fetchOriginals(server: string, compat: string, sha: string): Promise<OriginalsAnswer>  // checks sha256 and language 'originals'
type PartAnswer = { kind: 'listo'; bytes: Uint8Array } | { kind: 'parteNoEstá' } | { kind: 'espera'; retryAfter: number } | { kind: 'falla' }
function fetchPart(server: string, sha: string): Promise<PartAnswer>                            // checks sha256; mismatch → 'falla'
function fakeWorker(opts): { fetch: typeof fetch; lists, parts, setAnswer(...) }                // test helper, like projects/fakeDoor43.ts
```
`retryAfter` from the header, else 600 (202), 300 (503), 3600 (503 with `reason`), 60 (429).

- [ ] Steps: tests for each status (and a 200 that is not a schema-2 list → `noDisponible`, Review Focus 1; a part
  whose bytes do not match → `falla`; `If-None-Match` sent and 304 → `igual`); RED; implement with `fetch` injected
  (default global); GREEN; commit `Parts: a Worker client that says what each answer means`.

### Task 3: The download queue

**Files:** Create `src/resources/online/downloads.ts`, test `downloads.test.ts`

**Interfaces — Produces:**
```ts
type Progress = { done: number; total: number; bytesDone: number; bytesTotal: number }
type QueueResult = { kind: 'listo' } | { kind: 'listaOtraVez' } | { kind: 'espera'; retryAfter: number } | { kind: 'falla'; message: string }
function downloadParts(input: { server: string; parts: PartEntry[]; originals: Set<string> /* shas of the originals list */;
  staging: PartsStaging; onProgress?: (p: Progress) => void; fetchPart?: typeof fetchPart; at?: number /* 4 */ }): Promise<QueueResult>
```
Skips shas `staging.has`; originals' shas first; at most `at` in flight; `parteNoEstá` → stop the queue,
`listaOtraVez`; `espera` → stop, `espera`; three `falla` of one part → `falla`.

- [ ] Steps: tests (4 in flight max, originals first, already staged not fetched, a cut in the middle then a second
  run fetches only the rest — Review Focus 2, 404 → `listaOtraVez`, 429 → `espera`, progress counts); RED; implement;
  GREEN; commit `Parts: a download queue that resumes from staging`.

### Task 4: The server, and the desktop CSP

**Files:** Create `src/resources/online/packsServer.ts`, test `packsServer.test.ts`; Modify `src-tauri/tauri.conf.json` (`connect-src`)

**Interfaces — Produces:** `PACKS_SERVERS = { produccion, staging }` (URLs in Global Constraints);
`packsServer(search = location.search): string` — `?packs=staging|produccion` saves to `servos.enLinea.servidor` and
wins; else the saved one; else production; `packsServerChoice(): 'produccion' | 'staging' | null` (null when never
chosen, to hide the setting); `setPacksServer(id)`.

- [ ] Steps: tests (default production, `?packs=staging` saved and kept, unknown value ignored); a test that reads
  `tauri.conf.json` and checks `connect-src` contains both origins; RED; implement + add the two origins; GREEN;
  commit `Parts: the server to download from, and the desktop may reach it`.

### Task 5: The flow

**Files:** Create `src/resources/online/onlineResources.ts`, test `onlineResources.test.ts`

**Interfaces — Consumes:** Tasks 1–4; `library.ts` (`refreshLibrary`, `bookIsHere`), `helpsWatch.ts` (`watchHelps`,
`keepHelpsChanges`), `online.ts` (`isOnline`, `whenNotTyping`), `store.ts`. **Produces** (deps injectable for tests):
```ts
type OnlineState = {
  offer: { language: string; bytes: number; key: string } | null       // the Home card
  busy: { language: string; books: string[]; progress: Progress } | null
  blocked: Record<string /* language */, 'preparando' | 'actualizarApp' | 'noDisponible' | 'sinIdioma' | 'sinEspacio'>
  done: { language: string; changedVerses: number } | null               // the line that goes away
}
function onlineState(): OnlineState; function onOnline(fn): () => void; function useOnlineResources(): OnlineState
function startOnline(projects: Project[]): Promise<void>      // heal (applyParts with the current plan) then check if online
function checkForUpdates(opts?: { force?: boolean }): Promise<void>  // respects RECHECK_MS and reintentar
function downloadBook(language: string, book: string): Promise<void> // the project's book now
function downloadOffer(): Promise<void>                       // the Home card's «Bajar»
function declineOffer(): void                                 // «Ahora no», remembered by the offer's key (hash of its part shas)
```
Rules (spec §3–§4): units per language = `shared` + `book <b>` of every project book with that `helpsLanguage`;
originals from the newest originals list kept in `servos.enLinea.listas` (by the list's fetch time) — Review Focus 4;
plan with `planParts`, free-space check (`navigator.storage.estimate`, Global Constraints) → `sinEspacio`; download;
apply via `whenNotTyping` (never while typing — Review Focus 3): `watchHelps` → `applyParts` → `refreshLibrary` →
`keepHelpsChanges` → `done.changedVerses`; `refused.versions` → `actualizarApp`; `refused.missing` → download again;
`quota` → `sinEspacio`; wake lock where available during apply. Originals `noEstá` → fetch the language list again once in that check; a second `noEstá` → `noDisponible` (no loop); originals `espera` → `reintentar`; `falla` → try at the next check.

- [ ] Steps: tests with the fake Worker and fake stores — new book downloaded and applied (`bookIsHere` after
  `refreshLibrary`); an offer appears with its bytes and key; «Ahora no» hides it until what is offered changes (a
  new release with the same list code is offered again); apply waits while typing (simulate `whenNotTyping` holding) and runs at the pause; a cut queue then a second check finishes;
  `preparando`/`actualizarApp`/`sinIdioma`/`noDisponible`/`sinEspacio` set `blocked` and nothing is written;
  `reintentar` respected; two languages plan originals once from the newest list; startup heal calls `applyParts`
  with an empty-download plan. RED; implement; GREEN; commit `Parts: check, download and apply, without getting in
  the way`.

### Task 6: Opening a whole pack forgets the slots it overwrites

**Files:** Modify `src/resources/packs.ts` (`openPack`); test in `src/resources/reading.test.ts` or a new
`src/resources/packsAndParts.test.ts`

- [ ] After `importLanguagePack` succeeds, delete the `parts-slot:` rows whose slot's resource is one of the pack's
  resources and whose book (if any) is one of the pack's books (`readRegister` + `unitOfSlotId` / slot parsing), in one
  `transactRaw`. Test: apply parts for Titus, open a whole pack with Titus → those slots gone, another book's slots
  kept, and `planParts` plans Titus again (Review Focus 5). Commit `Opening a pack forgets the parts it overwrote`.

### Task 7: What the person sees

**Files:** Modify `src/app/screens/AddBook.tsx`, `src/app/screens/BookScreen.tsx`, `src/app/screens/Home.tsx`,
`src/app/screens/PersonMenu.tsx` (Acerca de: server setting when `packsServerChoice() !== null`), `src/app/i18n/{es,pt,en}.json`,
`src/styles.css` if needed

- [ ] Texts (es; pt and en translated; keys `enLinea.*`): `alCrear` «Al crearlo se bajarán sus textos y ayudas
  ({tamaño})», `bajar` «Bajar sus textos y ayudas · {tamaño}», `bajando` «Bajando textos y ayudas · {pct} %»,
  `seguirUsando` «Puede seguir usando la app», `preparando` «Se están preparando los textos de este idioma; se
  intentará otra vez más tarde», `actualizarApp` «Esta versión de Servos ya no puede bajar textos nuevos: actualice la
  app», `sinIdioma` «Este idioma todavía no tiene textos para bajar», `noDisponible` «No se pueden bajar ahora; se
  intentará más tarde», `sinEspacio` (+`.computadora`) «No hay espacio en el teléfono para bajarlos», `hayNuevos` «Hay
  textos y ayudas nuevos para {idioma} ({tamaño})», `alDia` «Textos y ayudas al día · cambiaron {n} versículos
  traducidos» (+ singular key), `servidor` «Servidor de textos y ayudas». Sizes formatted like the rest of the app
  (KB/MB, one decimal).
- [ ] AddBook (spec §2), BookScreen missing state (filled «Bajar…», secondary «Recibir un paquete», progress, blocked
  notices without retry), Home (the `Suggestion` card in the single suggestion slot; status lines for `busy` and
  `done`), PersonMenu «Acerca de» server choice.
- [ ] `npm test` (wording) + `npm run typecheck`; dev server with `?packs=staging` at 375 px: each touched screen
  passes FILOSOFIA's checklist; screenshots in the report. Commit `Servos online: download a book and offer updates`.

### Task 8: Triggers, the real Worker, and the design text

**Files:** Modify `src/main.tsx` (after `openLibrary`: `startOnline(projects)`), `src/app/App.tsx` (`visibilitychange`
and `online` → `checkForUpdates()`), `docs/DISENO.md` §7; Create `src/resources/online/realWorker.test.ts`

- [ ] Triggers per spec §4 (never while applying; `whenNotTyping`).
- [ ] Real Worker test, only with `SERVOS_WORKER=staging`: empty stores, a project es-419 with Titus,
  `downloadBook('es-419','tit')` against the staging Worker, then the notes of Titus 1 have aligned quotes
  (`notesOfVerse`). Run it once.
- [ ] `DISENO.md` §7: replace the Door43 `tc-ready` plan with how resources download now (book on choosing it,
  updates offered, applied without interrupting, packs still work and make the parts be fetched again).
- [ ] App check: dev server with `?packs=staging`, new project es-419 + a book not on the device → downloads with its
  size and opens with notes and quotes; then the same in the desktop app (`npm run build:escritorio`, Tauri) for the
  CSP. Commit `Servos online: checks at the right moments; the design says how resources arrive`.

### Task 9: After #51 merges (with Abel's yes)

- [ ] `bt-synergy.ref` → the merge commit of tc-study#51; move the shared `../bt-synergy` to it (`git fetch`,
  fast-forward `master`, `bun install`, restore `bun.lock`), as in part A; `npm test` without `SERVOS_BT_SYNERGY`.
  Commit `Build against bt-synergy with the parts importer`.
