# Servos al día con bt-synergy (plan 3, parte A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servos builds and reads against bt-synergy `e36aa839` (pinned and checked), finds alignments by the per-book
stamps bt-synergy now writes, refuses packs of another version on all five layers, and is proven with real `q9-a12`
packs.

**Architecture:** A small module (`scripts/btSynergy.ts`) owns where bt-synergy is (`SERVOS_BT_SYNERGY` or
`../bt-synergy`) and whether that checkout contains the commit in `bt-synergy.ref`; `vite.config.ts` and one test use
it. The reader in `src/resources/reading.ts` computes alignment stamps with bt-synergy's own `bookContentStamp` and
`targetBookStamp`. `madeForOtherVersion` compares every layer of `RESOURCE_VERSIONS`.

**Tech Stack:** TypeScript, React, Vite 7, Vitest (`environment: 'node'`, fake IndexedDB as the existing tests use),
bt-synergy packages from source (Bun 1.3.3 for `bun install` there), wrangler for R2.

**Spec:** `docs/superpowers/specs/2026-10-26-servos-al-dia-con-bt-synergy-design.md`

## Global Constraints

- bt-synergy commit to pin: `e36aa83936dc12f05dc99d252382d4393aa9074f` (tc-study `master` after PR #50).
- Env var name: `SERVOS_BT_SYNERGY`; pin file: `bt-synergy.ref` at the repository root, one line, the full commit.
- Default bt-synergy folder stays `../bt-synergy` relative to `vite.config.ts`. The shared `../bt-synergy` checkout is
  never switched, pulled or installed in this plan: work against a separate worktree,
  `C:\Users\LENOVO\Git\Github\wt\bts-master` (detached at the pinned commit, `bun install` done).
- Compat of the whole packs Servos accepts after this plan: `f1.1-u2.3.0-p6000230-q9-a12-t1`.
- Interface and product docs in Spanish; code comments and commits in English; every commit ends with a blank line
  and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No new interface text (no i18n change expected).
- Nothing is published, dispatched or merged without Abel's yes (Task 4's CI publish asks first).
- Tests: `npm test` (Vitest) and `npm run typecheck` (`tsc --noEmit -p .`, which covers `src` only).

## Review Focus

1. `SERVOS_BT_SYNERGY` pointing at a folder that does not exist: the check must fail naming that path, not fail later
   with an unresolved import (Task 1, state `missing`).
2. A notes or text catalog row whose `bookBlobsRef` is not its release tag (blobs recorded for an older release): the
   stamp falls back to the release stamp and the reader still finds rows keyed that way (Task 2).
3. Notes with blobs and a text without them (or the reverse): each stamp comes from its own row (Task 2).
4. A device with no catalog row for the notes: `notesOfVerse` still returns the notes, with `textQuote: null`, and
   does not throw (Task 2).
5. A pack that differs only in `quote` or only in `text` versions: refused up front, the same as the importer would
   drop those layers (Task 3).

---

### Task 1: Where bt-synergy is, and the pinned commit

**Files:**
- Create: `scripts/btSynergy.ts`, `scripts/btSynergy.test.ts`, `bt-synergy.ref`
- Modify: `vite.config.ts:12-17` (the `BT` constant and its comment), `CLAUDE.md` («Empezar»)

**Interfaces:**
- Produces:
  - `btSynergyRoot(configDir: string, env?: Record<string, string | undefined>): string` — absolute folder of the
    bt-synergy checkout: `env.SERVOS_BT_SYNERGY` when set and non-empty, else `resolve(configDir, '../bt-synergy')`.
    `env` defaults to `process.env`.
  - `type Git = (args: string[]) => { status: number; stdout: string }`
  - `type RefCheck = { state: 'contains' | 'behind' | 'not-git' | 'missing'; message: string }`
  - `checkBtSynergyRef(args: { root: string; ref: string; exists: (path: string) => boolean; git: Git }): RefCheck`
  - `vite.config.ts`: `const BT = join(btSynergyRoot(HERE), 'packages')`.

- [ ] **Step 1: Set up the bt-synergy worktree** (no product change). From `C:\Users\LENOVO\Git\Github\bt-synergy`:
  `git fetch uw` then `git worktree add --detach ../wt/bts-master e36aa83936dc12f05dc99d252382d4393aa9074f`, then
  `bun install` in it, then `git checkout -- bun.lock` if Bun rewrote it. Expected: `git -C ../wt/bts-master rev-parse
  HEAD` prints the pinned commit and `ls ../wt/bts-master/node_modules/pako` exists.

- [ ] **Step 2: Write the failing tests** in `scripts/btSynergy.test.ts`:

```ts
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { btSynergyRoot, checkBtSynergyRef, type Git } from './btSynergy'

const REF = 'e36aa83936dc12f05dc99d252382d4393aa9074f'
const gitAnswering = (answers: Record<string, number>): Git => (args) => ({ status: answers[args.join(' ')] ?? 0, stdout: '' })

describe('dónde está bt-synergy', () => {
  it('usa SERVOS_BT_SYNERGY cuando está, y ../bt-synergy si no', () => {
    expect(btSynergyRoot('C:/r/servos', { SERVOS_BT_SYNERGY: 'C:/wt/bts' })).toBe(resolve('C:/wt/bts'))
    expect(btSynergyRoot('C:/r/servos', {})).toBe(resolve('C:/r/bt-synergy'))
    expect(btSynergyRoot('C:/r/servos', { SERVOS_BT_SYNERGY: '' })).toBe(resolve('C:/r/bt-synergy'))
  })
})

describe('el commit fijado', () => {
  const base = { root: 'C:/wt/bts', ref: REF, exists: () => true }
  it('pasa cuando la carpeta contiene el commit', () => {
    expect(checkBtSynergyRef({ ...base, git: gitAnswering({}) }).state).toBe('contains')
  })
  it('falla cuando va atrás, y dice qué hacer', () => {
    const check = checkBtSynergyRef({ ...base, git: gitAnswering({ [`-C C:/wt/bts merge-base --is-ancestor ${REF} HEAD`]: 1 }) })
    expect(check.state).toBe('behind')
    expect(check.message).toMatch(/SERVOS_BT_SYNERGY/)
    expect(check.message).toContain(REF)
  })
  it('un commit que la carpeta no conoce también es ir atrás', () => {
    const check = checkBtSynergyRef({ ...base, git: gitAnswering({ [`-C C:/wt/bts merge-base --is-ancestor ${REF} HEAD`]: 128 }) })
    expect(check.state).toBe('behind')
  })
  it('una carpeta que no es repositorio git solo avisa', () => {
    const check = checkBtSynergyRef({ ...base, git: gitAnswering({ '-C C:/wt/bts rev-parse --git-dir': 128 }) })
    expect(check.state).toBe('not-git')
  })
  it('una carpeta que no existe falla nombrándola', () => {
    const check = checkBtSynergyRef({ ...base, exists: () => false, git: gitAnswering({}) })
    expect(check.state).toBe('missing')
    expect(check.message).toContain('C:/wt/bts')
  })
})

describe('la carpeta de bt-synergy en uso', () => {
  it('contiene el commit de bt-synergy.ref', () => {
    const here = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const ref = readFileSync(resolve(here, 'bt-synergy.ref'), 'utf8').trim()
    const git: Git = (args) => {
      const r = spawnSync('git', args, { encoding: 'utf8' })
      return { status: r.status ?? 1, stdout: r.stdout ?? '' }
    }
    const check = checkBtSynergyRef({ root: btSynergyRoot(here), ref, exists: existsSync, git })
    if (check.state === 'not-git') console.warn(check.message)
    expect(check.state === 'contains' || check.state === 'not-git', check.message).toBe(true)
  })
})
```

- [ ] **Step 3: Run them to see them fail.** Run: `npx vitest run scripts/btSynergy.test.ts`. Expected: FAIL, cannot
  resolve `./btSynergy`.

- [ ] **Step 4: Implement `scripts/btSynergy.ts`** with the interfaces above. Order of `checkBtSynergyRef`: `exists(root)`
  false → `missing`; `git(['-C', root, 'rev-parse', '--git-dir'])` non-zero → `not-git`;
  `git(['-C', root, 'merge-base', '--is-ancestor', ref, 'HEAD'])` 0 → `contains`, anything else → `behind`. The
  `behind` message (English is fine; it is for developers) names the folder, the pinned commit, and the two ways out:
  bring `master` into that checkout, or set `SERVOS_BT_SYNERGY` to a checkout that has it. Create `bt-synergy.ref`
  with the pinned commit and a trailing newline.

- [ ] **Step 5: Use it in `vite.config.ts`.** `import { btSynergyRoot } from './scripts/btSynergy'`; replace the `BT`
  line with `const BT = join(btSynergyRoot(dirname(fileURLToPath(import.meta.url))), 'packages')`; update its comment
  to name `SERVOS_BT_SYNERGY` and `bt-synergy.ref`. `server.fs.allow` already uses `BT`.

- [ ] **Step 6: Run the new tests against the worktree.** Run (Git Bash):
  `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/bts-master npx vitest run scripts/btSynergy.test.ts`.
  Expected: PASS (7 tests). Then without the variable (the shared checkout at `c2ea014`): expected FAIL of «contiene el
  commit de bt-synergy.ref» with the `behind` message — record this output in the task report; it is the guard
  working.

- [ ] **Step 7: Whole suite against the pinned commit.** Run:
  `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/bts-master npm test` and `npm run typecheck`. Expected: all pass
  (the real-pack tests skip without `SERVOS_PAQUETES`). If anything else fails, stop and report it: Task 2 owns the
  only known break, and its current test still passes (no blobs in its fixture).

- [ ] **Step 8: `CLAUDE.md` «Empezar».** Replace the first bullet with: bt-synergy next to the repository or wherever
  `SERVOS_BT_SYNERGY` says, with `bun install` done; `bt-synergy.ref` is the commit Servos was tested with, and
  `npm test` fails if the checkout in use does not contain it; to move Servos to a newer bt-synergy, test against it
  and write its commit in `bt-synergy.ref`. Spanish, same style as the file.

- [ ] **Step 9: Commit.** `git add scripts/btSynergy.ts scripts/btSynergy.test.ts bt-synergy.ref vite.config.ts CLAUDE.md`;
  message `Build against a pinned bt-synergy, wherever it is` with a body saying why (the shared checkout fell 63
  commits behind with nothing noticing).

### Task 2: Alignments found by the book's stamp

**Files:**
- Modify: `src/resources/reading.ts` (`alignedPlaces` ~:361, `alignedQuotes` ~:393, `notesOfVerse` ~:499),
  `src/resources/btSynergy.d.ts` (the `resource-catalog` and `helps/helpsAlignCache` modules)
- Test: `src/resources/reading.test.ts`

**Interfaces:**
- Consumes: `bookContentStamp(metadata: unknown, book: string): string` from `@bt-synergy/resource-catalog`;
  `targetBookStamp(metadata: unknown, book: string, prepareVersion?: number): string` from
  `@bt-synergy/resource-pipeline/helps/helpsAlignCache` (declare both in `btSynergy.d.ts`, each with a one-line doc as
  its neighbours have).
- Produces: `alignedQuotes(stores, notesKey, textKey, book, chapter)` — no stamp parameter; it reads both catalog
  rows itself. `alignedPlaces` and `notesOfVerse` keep their exported signatures.

- [ ] **Step 1: Write the failing tests** in `reading.test.ts`, in `describe('leer sin internet')`. Add a helper that
  builds and opens a pack from a variant of `META` and `ROWS`:
  `deviceWith(meta: typeof META, alignKey: string)` — same rows as `ROWS` but with the `helps-align:` row's key
  replaced by `alignKey`, `source.catalogRow` reading `meta`. Blob fixture values:
  `TN_BLOB = '1234567890abcdef1234567890abcdef12345678'`, `GLT_BLOB = 'abcdef1234567890abcdef1234567890abcdef12'`;
  `withBlobs(key, sha) = { ...META[key], contentMetadata: { bookBlobs: { tit: sha }, bookBlobsRef: META[key].release.tag_name } }`.
  The align key for a stamp pair `(h, t)`:
  `` `helps-align:${TN}@${h}:${UGNT}@v0.34#2023-09-27T02_19_31Z+${USJ_PROCESSING_VERSION}:${GLT}@${t}+${SCRIPTURE_PREPARE_VERSION}:tit:1` ``.
  Tests (each asserts `notesOfVerse(... verse: 1)` mapped to `[id, textQuote]`):
  - `'con blobs por libro, la cita se busca con el sello del libro'`: meta with both rows `withBlobs`, key
    `(g1234567890, gabcdef1234)` → `[['abcd', 'siervo de Dios'], ['efgh', null]]`.
  - `'una alineación hecha sobre otra versión del texto del libro no se usa'`: both `withBlobs`, key
    `(g1234567890, stamp(GLT))` → `[['abcd', null], ['efgh', null]]`.
  - `'notas con blobs y texto sin ellos: cada sello sale de su fila'`: only TN `withBlobs`, key
    `(g1234567890, stamp(GLT))` → `[['abcd', 'siervo de Dios'], ['efgh', null]]`.
  - `'blobs de un release anterior no cuentan: se usa el sello del release'`: TN with `bookBlobsRef: 'v65'` (tag is
    `v66`), key `(stamp(TN), stamp(GLT))` → `[['abcd', 'siervo de Dios'], ['efgh', null]]`.
  - `'sin la fila del catálogo de las notas, las notas salen sin cita y nada falla'`: open the normal pack, then
    `stores.catalog` without the TN row (delete it through the adapter, or open stores whose catalog lacks it) →
    `[['abcd', null], ['efgh', null]]`.
  The existing test `'las notas de un versículo traen sus palabras…'` stays as it is (release stamps, no blobs).

- [ ] **Step 2: Run them.** Run with the worktree: `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/bts-master npx vitest
  run src/resources/reading.test.ts`. Expected: FAIL on «con blobs por libro…» (textQuote null) and «una alineación
  hecha sobre otra versión…» (textQuote found); the others may pass already — say which in the report.

- [ ] **Step 3: Implement.** In `alignedQuotes`, read the notes row and the text row from `stores.catalog`; prefix
  `` `helps-align:${notesKey}@${bookContentStamp(notesRow, book)}:` ``; keep a row only when its key ends with
  `` `:${book.toLowerCase()}:${chapter}` `` and its fourth `:`-part equals
  `` `${textKey}@${targetBookStamp(textRow, book)}` `` exactly. Drop the stamp computation from `alignedPlaces` and
  `notesOfVerse`. Keep reading raw by prefix (rows past their cache lifetime are still read) and
  `unwrapVersioned(…, HELPS_ALIGN_VERSION)`. Update the doc comment of `alignedQuotes` to say the stamps are per book.

- [ ] **Step 4: Run.** Same command as Step 2. Expected: PASS, all of `reading.test.ts`. Then the whole suite and
  `npm run typecheck` with the variable set. Expected: PASS.

- [ ] **Step 5: Commit.** `src/resources/reading.ts`, `src/resources/btSynergy.d.ts`, `src/resources/reading.test.ts`;
  message `Find aligned quotes by the book's stamp`, body: bt-synergy now stamps helps and target keys per book
  (`g` + blob sha), so the release-stamped prefix found nothing; the target's stamp is now required so an alignment
  made on another version of the book's text is not shown.

### Task 3: Every layer's version, and the comment about quotes

**Files:**
- Modify: `src/resources/packs.ts:30-43` (`madeForOtherVersion` and its doc), `src/resources/freshness.ts:71-75`
- Test: `src/resources/reading.test.ts`, `describe('abrir un paquete de recursos')`

**Interfaces:**
- Consumes: `RESOURCE_VERSIONS` (`store.ts`), `describePack(bytes)` → `summary.otherVersion`, `buildLanguagePack({
  source, language, versions })` as the existing tests call it.

- [ ] **Step 1: Write the failing test** `'un paquete hecho con otra versión de cualquier capa se rechaza antes de
  abrirlo'`: for each `[layer, field, value]` of
  `[['sot','usjProcessing','1.0.0-usj'], ['prepared','scripturePrepare',1], ['quote','helpsQuote',8], ['align','helpsAlign',11], ['text','helpsText',99]]`,
  build a pack with `versions: { ...RESOURCE_VERSIONS, [layer]: { [field]: value } }` and expect
  `(await describePack(bytes)).otherVersion` to be `true`; and with `RESOURCE_VERSIONS` unchanged, `false`.

- [ ] **Step 2: Run it.** Expected: FAIL for `quote` and `text` (today only three layers are compared).

- [ ] **Step 3: Implement.** `madeForOtherVersion` compares each layer present in `RESOURCE_VERSIONS` with the same
  layer of the manifest, field by field, by `String()` (as `importLanguagePack` compares); keep today's rule that a
  manifest without `prepared.scripturePrepare` counts as other (packs that did not say it were made before packs said
  it), and that an absent `sot` or `align` value does not by itself. Update the doc comment to say every layer.
  In `freshness.ts`, the comment that says quotes are kept by release says by book.

- [ ] **Step 4: Run.** `npx vitest run src/resources/reading.test.ts src/resources/freshness.test.ts` with the
  variable set. Expected: PASS. Then `npm test` and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit.** Message `Refuse packs made with another version of any layer`.

### Task 4: Real q9-a12 packs, and the app

**Files:**
- Modify: `docs/superpowers/specs/2026-10-26-servos-al-dia-con-bt-synergy-design.md` («Paquetes llevados dentro»)
- Not in the repository: the pack folder `C:\Users\LENOVO\Git\Github\wt\paquetes-q9a12`

- [ ] **Step 1: Ask Abel** for the yes to dispatch `language-packs.yml` on tc-study `master` with `language: es-419`,
  `mode: publish`, `target: staging` and no `parts`. Do not dispatch without it.

- [ ] **Step 2: Dispatch and watch it.** `gh workflow run language-packs.yml -R unfoldingWord/tc-study --ref master -f
  language=es-419 -f mode=publish -f target=staging`; watch with `gh run watch <id> --exit-status`. Expected:
  success; the log names `catalog/f1.1-u2.3.0-p6000230-q9-a12-t1/es-419.json` and an `originals.json`.

- [ ] **Step 3: Download and verify.** With wrangler (from a translation-helps-mcp checkout, which has the bucket
  config): get `language-packs-staging/catalog/f1.1-u2.3.0-p6000230-q9-a12-t1/es-419.json` and `originals.json`, read
  each entry's pack path and sha256, get the two `.langpack.zip`, and check `sha256sum` of each equals its entry.
  Save them in the pack folder as `es-419.langpack.zip` and `originals.langpack.zip` (the names
  `realPacks.test.ts` opens; check that file for any other name it needs, e.g. a single-book pack, and say in the
  report which tests skip for lack of one). Expected: both sha256 match.

- [ ] **Step 4: Real-pack tests.** Run with both variables:
  `SERVOS_BT_SYNERGY=C:/Users/LENOVO/Git/Github/wt/bts-master SERVOS_PAQUETES=C:/Users/LENOVO/Git/Github/wt/paquetes-q9a12 npx vitest run src/resources/realPacks.test.ts src/resources/screenData.test.ts src/resources/sources.test.ts`.
  Expected: PASS, with aligned quotes and places present. Do not run `src/prototype/makeData.test.ts`.

- [ ] **Step 5: In the app.** Start the dev server with the variable set, as the memory note on worktree fonts says
  (a local `.claude/vite.local.config.ts` that allows the main checkout's `node_modules`), open the two packs through
  «Recibir un paquete», open Titus 1:1 in a project at 375 px, open the first note: it shows its quote in the text
  and marks its words. Take a screenshot for the report.

- [ ] **Step 6: Record the packs** in the spec's «Paquetes llevados dentro»: file name, compat, run id, sha256 of
  each. Commit: message `Spec: the q9-a12 packs Servos is tested with`.

---

## Execution notes

- Tasks run in order; each one's tests run with `SERVOS_BT_SYNERGY` pointing at `wt/bts-master`.
- After Task 4, the branch is ready for a PR to `main`, which Abel opens or approves.
- Out of this plan, each with Abel's yes: moving the shared `../bt-synergy` to `master`; building installers with
  these packs (`SERVOS_PAQUETES_DENTRO`).
