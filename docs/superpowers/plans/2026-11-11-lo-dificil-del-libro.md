# Lo difícil de este libro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Estudio a stop that lists the Academy articles a book's notes use, a sheet per article with its notes in the book, and a fold per section that indexes them.

**Architecture:** One pure module (`bookIssues.ts`) turns the book's chapters, already in memory in both pack formats, into the issues; `MiniAppScreen` computes them once per book and hands them to the stops (`stopsOf`), the place picker and the mini app's context. Estudio draws the stop and the section fold; `ArticleSheet` gains an optional «En {libro}» part. Format 3 needs no new code: `DondeAparece` is already in the sheet.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest (`environment: 'node'`, no component tests in this repo: UI is checked in the app).

**Spec:** `docs/superpowers/specs/2026-11-11-lo-dificil-del-libro-design.md`

## Global Constraints

- Interface text only through i18n, in es, pt and en (`estudio.texts` for Estudio's, `src/app/i18n/{es,pt,en}.json` for the frame's). No string in a component.
- Code comments and commit messages in English; commits with a short title and a body that says why, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `docs/FILOSOFIA_DE_DISENO.md`: 44 px touch targets; rows that open something are full-width rows with «›» (or «▾» that turns); a tag («Leído», «aquí») is tinted, no border, not touchable; nothing hidden without its count.
- Works in both pack formats; no `readerV3` call is added.
- «No está en este aparato» is never said as «no existe».
- `localStorage` reads and writes always inside `try`.
- Before finishing: `npm test` and `npm run typecheck` pass.

## Review Focus

1. A note covering two verses (`1:1-2`) is in `data.verses` of both: counted once, listed once in the sheet, and the section fold shows it for a section holding either verse.
2. A person whose kept place is `BOOK_ISSUES` in a book that no longer has issues (a new pack): the screen moves to the first stop, not a blank one (`lost` in `MiniAppScreen`).
3. An article not on the device: the stop's row shows the path's last part, the sheet says `ayudas.articuloNoEsta`, «En {libro}» still lists its notes.
4. A section whose verses carry the same article in two notes: one row, both verses, the book count unchanged.
5. Following a link to another article inside the sheet: «En {libro}» follows the article shown, and disappears for an article the book's notes never use.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/app/projects/bookIssues.ts` (new) | Pure: issues of a book, of a section, a sheet's ordered notes, a note's gist |
| `src/app/projects/bookIssues.test.ts` (new) | Its tests |
| `src/app/projects/work.ts` | Which issues were read, per book |
| `src/app/miniapps/contract.ts` | `BOOK_ISSUES`, `MiniApp.issues`, `MiniAppContext.bookIssues` |
| `src/app/frame/PlacePicker.tsx` | `stopsOf` places the stop; its label and passage |
| `src/app/frame/MiniAppScreen.tsx` | Computes the book's issues once; passes them on |
| `src/app/projects/progress.ts` | `placeLabel` names the stop |
| `src/app/frame/ArticleSheet.tsx` | Optional «En {libro}» part |
| `src/app/miniapps/estudio/BookIssues.tsx` (new) | The stop's list |
| `src/app/miniapps/estudio/SectionIssues.tsx` (new) | The section fold |
| `src/app/miniapps/estudio/estudio.tsx` | Wires the stop and the fold; Estudio's texts |

---

### Task 1: The issues of a book

**Files:**
- Create: `src/app/projects/bookIssues.ts`
- Test: `src/app/projects/bookIssues.test.ts`

**Interfaces:**
- Consumes: `PrototypeData` (`src/prototype/data.ts`): `verses[].notes[]` with `id`, `quote`, `note`, `academy: string | null`; `academy: Record<path, { title, markdown }>`.
- Produces:
  ```ts
  export type IssueNote = { chapter: number; verse: number; covers: number[]; id: string; quote: string; note: string }
  export type BookIssue = { path: string; title: string; onDevice: boolean; notes: IssueNote[]; chapters: number }
  export function issuesOfBook(chapters: ReadonlyArray<{ chapter: number; data: PrototypeData }>): BookIssue[]
  export function issuesOfSection(issues: BookIssue[], chapter: number, verses: number[]): Array<{ issue: BookIssue; verses: number[] }>
  export function notesInBook(issues: BookIssue[], path: string, here?: { chapter: number; verses: number[] }): Array<IssueNote & { here: boolean }> | null
  export function noteGist(markdown: string): string
  ```

- [ ] **Step 1: Write the failing tests** in `bookIssues.test.ts`, with a small `chapter(n, verses)` fixture builder making `PrototypeData` objects (only `chapter`, `verses`, `academy` matter; other fields minimal):
  - `issuesOfBook` orders by `notes.length` descending, then by `title` (`localeCompare`): metaphor ×3 before passive ×1; two at 2 notes ordered «Doblete» before «Metáfora».
  - a note `id: 'n1'` present in verses 1 and 2 of chapter 1 gives one `IssueNote` `{ chapter: 1, verse: 1, id: 'n1' }`.
  - notes with `academy: null` are left out; a book with none gives `[]`.
  - `chapters` counts distinct chapters (notes in ch. 1 and 3 → `2`).
  - `title` is `data.academy[path].title` when its `markdown` is non-empty in any chapter, with `onDevice: true`; otherwise `title` is the path's last part (`'translate/figs-metaphor'` → `'figs-metaphor'`) and `onDevice: false`.
  - `issuesOfSection(issues, 1, [1, 2])` returns each issue with a note on those verses once, with `verses` sorted and unique, in the book's order; the two-verse note `n1` (kept at verse 1) also shows for section `[2, 3]` with `verses: [2]` (it covers verse 2: match by the note `id` being in that verse's `data.verses`, so `issuesOfSection` must keep, per issue, every `(chapter, verse)` a note id was seen at — store it as `IssueNote.covers: number[]` and add `covers` to the `IssueNote` type).
  - `notesInBook(issues, path, { chapter: 2, verses: [5] })` puts the notes covering 2:5 first with `here: true`, then the rest in book order with `here: false`; `notesInBook(issues, 'translate/unused')` is `null`.
  - `noteGist('**Siervo** es una [metáfora](rc://*/ta/man/translate/figs-metaphor).\nOtra línea')` is `'Siervo es una metáfora.'`; the literal `\n` (two characters) also ends the first line.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/app/projects/bookIssues.test.ts`
  Expected: FAIL, module not found.

- [ ] **Step 3: Implement the four functions** in `bookIssues.ts`. `IssueNote` is `{ chapter, verse, covers: number[], id, quote, note }` (`verse` = first verse it was seen at, `covers` = all verses of that chapter it was seen at). `noteGist` strips `**`, `*`, `_`, `` ` ``, `#` headings and `[text](link)` → `text`, and cuts at the first real or written `\n`.

- [ ] **Step 4: Run them to see them pass**

  Run: `npx vitest run src/app/projects/bookIssues.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit** — `Count the Academy articles a book's notes use` (body: why — the study's new stop and fold read them, in both formats).

---

### Task 2: The stop in the frame

**Files:**
- Modify: `src/app/miniapps/contract.ts` (after `CHAPTER_INTRO`; `MiniApp` near `intros?: boolean`; `MiniAppContext` near `chapterData`)
- Modify: `src/app/frame/PlacePicker.tsx:16-36` (`stopsOf`, `stopLabel`, `passageOf`) and its `PlacePicker` props
- Modify: `src/app/frame/MiniAppScreen.tsx` (stops at :127 and :155; context at ~:212; `<PlacePicker` at ~:355)
- Modify: `src/app/projects/progress.ts:44-48` (`placeLabel`)
- Modify: `src/app/i18n/{es,pt,en}.json`
- Test: `src/app/frame/stops.test.ts` (new), `src/app/projects/progress.test.ts` (add to it if it exists, else new)

**Interfaces:**
- Consumes: Task 1's `BookIssue`, `issuesOfBook`.
- Produces:
  ```ts
  export const BOOK_ISSUES = -2                      // contract.ts
  MiniApp.issues?: boolean                           // a mini app with `intros` that also stops at the book's issues
  MiniAppContext.bookIssues: BookIssue[]             // [] when the app does not ask for them
  stopsOf(data: PrototypeData, unit: Unit, intros = false, issues = false): number[][]
  ```

- [ ] **Step 1: Write the failing tests**
  - `stops.test.ts`: with chapter-1 data that has `bookIntro` and `intro`, `stopsOf(d, 'verse', true, true)` starts `[[-1], [-2], [0], [1], …]`; with `issues = false` there is no `[-2]`; in a chapter without `bookIntro` (chapter 2) `[-2]` never appears even with `issues = true`; with `intros = false` neither does it.
  - `stopLabel([BOOK_ISSUES], t)` is `t('marco.loDificilCorta')`; `passageOf('Rut', 1, [BOOK_ISSUES], t)` is `` `Rut · ${t('marco.loDificil')}` `` (use an identity `t` that returns the key).
  - `placeLabel(t, 'Rut', { chapter: 1, verse: BOOK_ISSUES })` is `t('libro.loDificil', { libro: 'Rut' })`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/app/frame/stops.test.ts src/app/projects/progress.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - `stopsOf`: `[BOOK_ISSUES]` right after `[BOOK_INTRO]`, only when `intros && issues && data.bookIntro`.
  - `stopLabel`, `passageOf`, `placeLabel`: the new cases.
  - `MiniAppScreen`: `const bookIssues = useMemo(() => (app.issues ? issuesOfBook(chapters.flatMap((c) => { const d = dataOf(c); return d ? [{ chapter: c, data: d }] : [] })) : []), [app.issues, chapters, dataOf])`; pass `bookIssues.length > 0` as `stopsOf`'s 4th argument at both calls and as a new `issues: boolean` prop of `PlacePicker` (its own `stopsOf` call); put `bookIssues` in the context. The existing `lost` effect already moves a kept `BOOK_ISSUES` with no such stop to the first stop: leave it.
  - i18n keys, es / pt / en:
    - `marco.loDificil`: «Lo difícil de este libro» / «O difícil deste livro» / «What is hard in this book»
    - `marco.loDificilCorta`: «Difícil» / «Difícil» / «Hard»
    - `libro.loDificil`: «lo difícil de {libro}» / «o difícil de {libro}» / «what is hard in {libro}»

- [ ] **Step 4: Run them to see them pass**, then `npm run typecheck`.

  Expected: PASS; no type errors (Checking and other `MiniAppContext` builders, if any, get `bookIssues: []`).

- [ ] **Step 5: Commit** — `Add a stop for the book's translation issues` (body: the stop sits after the book's introduction and exists only when the book's notes use an article).

---

### Task 3: What was read

**Files:**
- Modify: `src/app/projects/work.ts` (next to `studiedIn` / `markStudied`, :164-178)
- Test: the existing work tests file, or `src/app/projects/issuesRead.test.ts` (new)

**Interfaces:**
- Produces: `issuesReadIn(book: string): string[]`, `markIssueRead(book: string, path: string): void`.

- [ ] **Step 1: Write the failing test**: after `markIssueRead('rut', 'translate/figs-metaphor')` twice and once for another path, `issuesReadIn('rut')` is the two paths, each once; `issuesReadIn('jon')` is `[]`. Use the same `localStorage` stand-in the other work tests use.
- [ ] **Step 2: Run it to see it fail** — `npx vitest run <that file>`: FAIL.
- [ ] **Step 3: Implement** with key `` `${KEY}.asuntosLeidos.${scoped(book)}` ``, read and written with `read` / `write` like `studiedIn`.
- [ ] **Step 4: Run it to see it pass.**
- [ ] **Step 5: Commit** — `Keep which of a book's issues were read`.

---

### Task 4: «En {libro}» in the article sheet

**Files:**
- Modify: `src/app/frame/ArticleSheet.tsx`
- Modify: `src/app/i18n/{es,pt,en}.json`, `src/app/styles.css`

**Interfaces:**
- Consumes: Task 1's `BookIssue`, `notesInBook`, `noteGist`.
- Produces: `ArticleSheet` prop
  ```ts
  inBook?: { name: string; issues: BookIssue[]; here?: { chapter: number; verses: number[] }; onGo(chapter: number, verse: number): void }
  ```

- [ ] **Step 1: Implement.** Under the back button, before the article: when `inBook` and `shown.ref?.kind === 'ta'` and `notesInBook(inBook.issues, shown.ref.path, inBook.here)` is not null, a `<details>` (closed) whose summary is `t('ayudas.enLibro', { libro: inBook.name, n })`. Each note is a full-width `<button>` row with «›»: line 1 `` `${name} ${chapter}:${verse}` `` and, when `quote`, «{quote}»; line 2 `noteGist(note)`; a tag `t('ayudas.aqui')` when `here`. A click calls `onClose()` then `inBook.onGo(chapter, verse)`. Reuse the classes of `DondeAparece` (`word-help-other across`, `across-list`, `across-row`); add only what the row's two lines need.
- [ ] **Step 2: i18n**: `ayudas.enLibro`: «En {libro}: {n} notas» / «Em {libro}: {n} notas» / «In {libro}: {n} notes», with the one-note forms `ayudas.enLibroUna`: «En {libro}: 1 nota» / «Em {libro}: 1 nota» / «In {libro}: 1 note»; `ayudas.aqui`: «aquí» / «aqui» / «here».
- [ ] **Step 3: Check** `npm run typecheck`; the sheet still opens as before where `inBook` is not passed (it is not passed anywhere yet).
- [ ] **Step 4: Commit** — `Show an article's notes in this book in its sheet`.

---

### Task 5: The stop in Estudio

**Files:**
- Create: `src/app/miniapps/estudio/BookIssues.tsx`
- Modify: `src/app/miniapps/estudio/estudio.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `context.bookIssues` (Task 2), `BOOK_ISSUES`, `issuesReadIn` / `markIssueRead` (Task 3), `ArticleSheet` `inBook` (Task 4), `articleIn`, `readArticle`.
- Produces: `BookIssues({ issues, bookName, read, onOpen }: { issues: BookIssue[]; bookName: string; read: string[]; onOpen(issue: BookIssue): void })`.

- [ ] **Step 1: `BookIssues.tsx`**: heading `t('estudio.loDificil')`, the line `t('estudio.loDificilPara', { libro })`, then one full-width row per issue with «›»: line 1 `issue.title` and the tag `t('estudio.leido')` when `read` has its path; line 2 `t('estudio.asuntoCuenta', { n: notes.length, c: chapters })` (singular forms `estudio.asuntoCuentaUna` for one note, `estudio.asuntoCuentaUnCapitulo` for one chapter — pick by count). The first 8 rows show; the rest go in a `<details>` with summary `t('estudio.otrosAsuntos', { n })`.
- [ ] **Step 2: Wire it in `estudio.tsx`**: `estudio.issues = true`. When `position.verse === BOOK_ISSUES`, render the same two panes as the book's introduction (`introOf === 'libro'` path: its note is the book note, `BOOK_NOTE_CHAPTER`), with `BookIssues` as the first pane (id `asuntos`, label `t('marco.loDificil')`) in place of the introduction text. Opening an issue: `markIssueRead(book, path)`, then open `ArticleSheet` with `articleIn(data, { kind: 'ta', path })` or, for one not in this chapter's data, `readArticle(ref)`, or `{ ref, title: issue.title, markdown: t('ayudas.articuloNoEsta') }`; pass `inBook = { name: context.bookTitle, issues: context.bookIssues, onGo: (chapter, verse) => context.goTo({ book, chapter, verse }) }`.
- [ ] **Step 3: Estudio's texts** in `estudio.texts`, es / pt / en:
  - `loDificil`: «Lo difícil de este libro» / «O difícil deste livro» / «What is hard in this book»
  - `loDificilPara`: «Las notas de {libro} explican estos asuntos. Léalos antes de traducir; los volverá a encontrar en cada sección.» / «As notas de {libro} explicam estes assuntos. Leia-os antes de traduzir; vai encontrá-los de novo em cada seção.» / «The notes on {libro} explain these issues. Read them before translating; you will meet them again in each section.»
  - `asuntoCuenta`: «{n} notas · en {c} capítulos» / «{n} notas · em {c} capítulos» / «{n} notes · in {c} chapters»; `asuntoCuentaUna`: «1 nota · en 1 capítulo» / «1 nota · em 1 capítulo» / «1 note · in 1 chapter»; `asuntoCuentaUnCapitulo`: «{n} notas · en 1 capítulo» / «{n} notas · em 1 capítulo» / «{n} notes · in 1 chapter»
  - `leido`: «Leído» / «Lido» / «Read»
  - `otrosAsuntos`: «Ver los otros {n} asuntos» / «Ver os outros {n} assuntos» / «See the other {n} issues»
- [ ] **Step 4: Check in the app** (`npm run dev`, the bundled Titus): the stop comes after «Libro» in the place picker; the list, «Leído» after opening one, the sheet's «En Tito», a row there goes to that verse's section. `npm run typecheck`, `npm test`.
- [ ] **Step 5: Commit** — `Study the book's translation issues before translating it`.

---

### Task 6: The section fold

**Files:**
- Create: `src/app/miniapps/estudio/SectionIssues.tsx`
- Modify: `src/app/miniapps/estudio/estudio.tsx`, `src/app/styles.css`

**Interfaces:**
- Consumes: `issuesOfSection` (Task 1), `context.bookIssues`, `ArticleSheet` `inBook` with `here`.
- Produces: `SectionIssues({ rows, bookName, onOpen }: { rows: ReturnType<typeof issuesOfSection>; bookName: string; onOpen(issue: BookIssue): void })`.

- [ ] **Step 1: `SectionIssues.tsx`**: nothing when `rows` is empty. Else a `<details>` with summary `t('estudio.asuntosAqui', { n: rows.length })`, its `open` read from and written to `localStorage['servos.estudio.asuntosAqui']` (`'1'` / `'0'`, in `try`). Each row, full width with «›»: line 1 the title; line 2 `` `${verses.join(', ')} · ${t('estudio.enTodoLibro', { n: issue.notes.length, libro: bookName })}` ``.
- [ ] **Step 2: Wire it in `estudio.tsx`** for sections only (not introductions, not `BOOK_ISSUES`): above `<Panes>` inside `.study`, `rows = issuesOfSection(context.bookIssues, position.chapter, shown)`. Opening a row opens the sheet as in Task 5, with `inBook.here = { chapter: position.chapter, verses: shown }`, and marks it read.
- [ ] **Step 3: Texts**: `asuntosAqui`: «Asuntos de traducción aquí ({n})» / «Assuntos de tradução aqui ({n})» / «Translation issues here ({n})»; `enTodoLibro`: «{n} en todo {libro}» / «{n} em todo {libro}» / «{n} in all of {libro}».
- [ ] **Step 4: Check in the app**: a section with notes shows the fold closed, one row per article; a section without shows nothing; the sheet opened from it lists this section's notes first with «aquí»; the open/closed state survives moving to the next section. `npm run typecheck`, `npm test`.
- [ ] **Step 5: Commit** — `Index each section's translation issues above its text`.

---

### Task 7: Check it whole, and the docs

**Files:**
- Modify: `docs/DISENO.md` (where Estudio's stops are described: one sentence on the new stop and fold, pointing to the spec)

- [ ] **Step 1: The philosophy's checklist** (`docs/FILOSOFIA_DE_DISENO.md`, «Cómo comprobarlo») on the stop, the fold and the sheet at 375 px and at 1280 × 800, 1440 × 900, ~900 px; in es, pt, en; airplane mode. Note the numbers (controls in sight, filled buttons, heights).
- [ ] **Step 2: Both formats**: a real 2.0 pack (production server) — no «Dónde aparece» in the sheet, everything else there; a format 3 pack (staging, `VITE_SERVOS_PACKS`) — «Dónde aparece» lists other books, those not on the device apart.
- [ ] **Step 3: The Review Focus list**: walk each of its five cases in the app (a two-verse note; a kept place at the stop after a pack without issues — simulate by setting the kept place in `localStorage`; an article not on the device; two notes of one article in a section; a link to another article in the sheet).
- [ ] **Step 4: `docs/DISENO.md`** sentence; `npm test`, `npm run typecheck`.
- [ ] **Step 5: Commit** — `Note the study's issues stop in the design`.
