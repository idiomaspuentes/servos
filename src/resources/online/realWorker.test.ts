/// <reference types="node" />
/**
 * With the real staging Worker (the translation-helps preview): SERVOS_WORKER=staging npx vitest run
 * src/resources/online/realWorker.test.ts --silent=false (without the flag, Vitest hides what it prints: the time,
 * the parts and the bytes)
 *
 * Spec §5: on empty stores, a project of es-419 with Titus downloads Titus and applies it, and the notes of Titus 1
 * have their quotes aligned to the text. It only reads from the Worker (the list, the originals list and the parts),
 * though asking for a list may start a build there when its sources moved. Skipped unless the variable is set, so the
 * usual test run needs no network.
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyParts } from '@bt-synergy/language-pack'
import type { Project } from '../../app/projects/model'
import { notesOfVerse, readChapter } from '../reading'
import { openPartsStaging, openResourceStores, readPartsRegister } from '../store'
import { downloadBook, onOnline, onlineState, setOnlineDeps, setOnlineProjects } from './onlineResources'
import type { Progress } from './downloads'
import type { KeptList } from './planLanguage'
import { PACKS_SERVERS } from './packsServer'

const staging = process.env.SERVOS_WORKER === 'staging'

describe.skipIf(!staging)('the real staging Worker', () => {
  it('a project of es-419 with Titus, on empty stores: Titus comes, and the notes of Titus 1 have aligned quotes', async () => {
    const at = Date.now()
    const stores = openResourceStores({ cache: `real-worker-cache-${at}`, catalog: `real-worker-catalog-${at}` })
    const kept = new Map<string, string>()
    setOnlineDeps({
      fetch: globalThis.fetch.bind(globalThis),
      server: () => PACKS_SERVERS.staging,
      stores: () => stores,
      staging: () => openPartsStaging(`real-worker-staging-${at}`),
      storage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) },
      isOnline: () => true,
      whenNotTyping: (run) => {
        run()
        return () => {}
      },
      estimate: null,
      wakeLock: async () => null,
      bookIsHere: () => false,
      refreshLibrary: async () => {},
      watchHelps: async () => [],
      keepHelpsChanges: async () => [],
      applyParts,
    })
    setOnlineProjects([{ id: 'p', helpsLanguage: 'es-419', books: [{ code: 'tit', phase: 'traduccion' }] } as unknown as Project])

    let last: Progress | null = null
    const off = onOnline((s) => {
      if (s.busy) last = s.busy.progress
    })
    await downloadBook('es-419', 'tit')
    off()
    const seconds = (Date.now() - at) / 1000

    expect(onlineState().blocked).toEqual({})
    const register = await readPartsRegister(stores)
    expect([...register.keys()].some((id) => id.startsWith('book:') && id.endsWith(':tit'))).toBe(true)

    // The text and the notes of es-419, as its list names them.
    const lists = JSON.parse(kept.get('servos.enLinea.listas') ?? '{}') as Record<string, KeptList>
    const resources = lists['es-419'].list.resources
    const textKey = resources.find((r) => r.subject === 'Aligned Bible' && r.key.endsWith('/glt'))?.key ?? resources.find((r) => r.subject === 'Aligned Bible')!.key
    const notesKey = resources.find((r) => r.subject === 'TSV Translation Notes')!.key

    const chapter = (await readChapter(stores, textKey, 'tit', 1))!
    const verses = chapter.flatMap((p) => (p.kind === 'paragraph' ? p.verses : []))
    expect(verses.length).toBeGreaterThan(10)

    let notes = 0
    let aligned = 0
    for (const v of verses) {
      const found = await notesOfVerse(stores, { notesKey, textKey, book: 'tit', chapter: 1, verse: v.verse })
      notes += found.length
      aligned += found.filter((n) => n.textQuote).length
    }
    const p = last as Progress | null
    const said =
      `Staging Worker, es-419 Titus: ${seconds.toFixed(1)} s, ${p?.total ?? '?'} parts, ${p?.bytesTotal ?? '?'} bytes; ` +
      `${register.size} slots; Titus 1: ${verses.length} verses, ${notes} notes, ${aligned} with aligned quotes.`
    // Said whatever happens: printed with --silent=false, and in the message of an assertion that fails.
    console.log(`\n${said}\n`)
    expect(notes, said).toBeGreaterThan(0)
    expect(aligned, said).toBeGreaterThan(0)
    const first = await notesOfVerse(stores, { notesKey, textKey, book: 'tit', chapter: 1, verse: 1 })
    for (const n of first.slice(0, 4)) console.log(`  · ${n.textQuote ?? `(${n.quote})`}: ${n.note.split('\n')[0].slice(0, 90)}`)
  }, 300_000)
})
