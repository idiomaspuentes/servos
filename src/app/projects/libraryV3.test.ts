/// <reference types="node" />
/**
 * The library reads a book from format 3 when the device has it installed there (staging only), and from the rows
 * otherwise. The rows are today's: bt-synergy's spec fixtures (es-419 Titus and the UGNT of Titus, format 1.1) opened
 * as Servos opens packs. Format 3 is the signed sample of the same Titus, installed through the client into the app's
 * own store (`servos-paquetes-v3`, in fake-indexeddb) from a fake Worker.
 */
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { btSynergyRoot } from '../../../scripts/btSynergy'
import type { Project } from './model'

/** How many chapters each path read. */
const calls = vi.hoisted(() => ({ rows: 0, v3: 0 }))
/** What the last format 3 read gave beside the chapters. */
const lastV3 = vi.hoisted(() => ({ lexicon: 0 }))

vi.mock('../../resources/screenData', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../resources/screenData')>()
  return {
    ...real,
    chapterData: (...args: Parameters<typeof real.chapterData>) => {
      calls.rows++
      return real.chapterData(...args)
    },
  }
})
vi.mock('../../resources/v3/bookV3', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../resources/v3/bookV3')>()
  return {
    ...real,
    readBookV3: async (...args: Parameters<typeof real.readBookV3>) => {
      const read = await real.readBookV3(...args)
      calls.v3 += read?.chapters.length ?? 0
      lastV3.lexicon = Object.keys(read?.lexicon ?? {}).length
      return read
    },
  }
})

const DATA = join(btSynergyRoot(join(__dirname, '..', '..', '..')), 'packages', 'language-pack-v3', 'spec', 'tests', 'data')
const STORE_V3 = 'servos-paquetes-v3'

const project: Project = {
  id: 'p1',
  kind: 'bible',
  name: 'Tito',
  languageName: 'Prueba',
  languageCode: 'xyz',
  direction: 'ltr',
  helpsLanguage: 'es-419',
  font: '',
  versification: 'ufw',
  books: [{ code: 'tit' }] as Project['books'],
  miniApps: {} as Project['miniApps'],
}

/** A new app run: the library and the format 3 client with nothing in memory, the databases as they are. */
async function freshApp() {
  vi.resetModules()
  const library = await import('./library')
  const client = await import('../../resources/v3/client')
  const sample = await import('../../resources/v3/testing/sample')
  const data = await import('../../prototype/data')
  return { library, client, sample, data }
}

/** Format 3 is used with the staging packs server, which a `?packs=staging` link chooses. */
const useStaging = () => vi.stubGlobal('location', { search: '?packs=staging' })

const opened: string[] = []
const realOpen = indexedDB.open.bind(indexedDB)

beforeAll(async () => {
  vi.spyOn(indexedDB, 'open').mockImplementation((name: string, version?: number) => {
    opened.push(name)
    return realOpen(name, version)
  })
  // Today's rows of es-419 Titus, as a device that received the packs before has them.
  const { openPack } = await import('../../resources/packs')
  const { openResourceStores } = await import('../../resources/store')
  const stores = openResourceStores()
  const file = (name: string) => new Uint8Array(readFileSync(join(DATA, name)))
  expect((await openPack(stores, file('originals-tit.langpack.zip'))).skippedResources).toEqual([])
  expect((await openPack(stores, file('es-419-tit.langpack.zip'))).droppedRows).toEqual({})
}, 60_000)

afterEach(() => {
  vi.unstubAllGlobals()
  calls.rows = 0
  calls.v3 = 0
})

describe('the library reads format 3 first', () => {
  it('format 2 builds never open the format 3 store', async () => {
    const { library, client } = await freshApp()
    opened.length = 0
    await library.openLibrary([project])
    await library.loadBook('tit', 'es-419')
    expect(library.bookState('tit', 'es-419').state).toBe('ready')
    expect(calls.rows).toBe(3)
    library.articlesOnDevice('tw', 'es-419')
    await library.readArticle({ kind: 'tw', path: 'bible/kt/god' }, 'es-419')
    await library.refreshLibrary()
    await library.loadBook('tit', 'es-419')
    expect(library.v3Books().size).toBe(0)
    expect(calls.v3).toBe(0)
    expect(opened).not.toContain(STORE_V3)
    expect(opened).toContain('servos-recursos')
    client.resetPacksV3()
  }, 60_000)

  it('keeps reading rows until format 3 has the book', async () => {
    useStaging()
    const { library, client, sample } = await freshApp()
    const built = await sample.buildSample()
    const packs = await client.packsV3({ fetch: sample.fakeFetch(built), trustedKeys: { [built.keyId]: built.publicKey } })
    // The device knows the language's catalog in format 3, and has nothing of it installed yet.
    await packs.refresh('es-419')
    await library.openLibrary([project])
    await library.loadBook('tit', 'es-419')
    expect(library.v3Books().get('es-419')?.has('tit')).toBeFalsy()
    expect(library.bookState('tit', 'es-419').state).toBe('ready')
    expect(calls).toEqual({ rows: 3, v3: 0 })

    // Installed in format 3: from now on Titus is read from there, a chapter at a time, and the rows stay.
    await packs.install('es-419', { books: ['tit'] })
    const states: string[] = []
    const stop = library.subscribeLibrary(() => {
      const s = library.bookState('tit', 'es-419')
      states.push(s.state === 'loading' ? `${s.done}/${s.total}` : s.state)
    })
    await library.refreshLibrary()
    await library.loadBook('tit', 'es-419')
    stop()
    expect(library.v3Books().get('es-419')).toEqual(new Set(['tit']))
    expect(calls).toEqual({ rows: 3, v3: 3 })
    expect(library.bookState('tit', 'es-419').state).toBe('ready')
    expect(states).toEqual(expect.arrayContaining(['1/3', '2/3', '3/3', 'ready']))
    expect(states.indexOf('1/3')).toBeLessThan(states.indexOf('3/3'))
    expect(opened).toContain(STORE_V3)
    client.resetPacksV3()
  }, 60_000)

  it('reads format 3 once the book is installed there', async () => {
    useStaging()
    const { library, client, sample, data } = await freshApp()
    const built = await sample.buildSample()
    const packs = await client.packsV3({ fetch: sample.fakeFetch(built), trustedKeys: { [built.keyId]: built.publicKey } })
    // With the lexicon group of its words, as a book download brings it.
    await packs.install('es-419', { books: ['tit'], units: ['lex:G0'] })
    const resources = await client.catalogResourcesV3('es-419')

    // The app opens on a device that has Titus in format 3 (and in rows): it reads format 3.
    await library.openLibrary([project])
    await library.loadBook('tit', 'es-419')
    expect(calls).toEqual({ rows: 0, v3: 3 })
    const found = library.availabilityOf('tit', 'es-419')
    expect(found).toMatchObject({ here: true, needsOriginal: false, has: { literal: true } })
    expect(library.helpsLanguagesHere().find((l) => l.code === 'es-419')?.books).toContain('tit')

    // Every text titled as its catalog titles it, the original's too: never by its key.
    const chapter = data.chapterOf('tit', 1)!
    expect(chapter.texts.length).toBeGreaterThanOrEqual(2)
    for (const text of chapter.texts) {
      expect(text.title).not.toBe(text.key)
      expect(text.title).toBe(resources.find((r) => r.key === text.key)?.title)
    }
    expect(chapter.texts.find((t) => t.original)).toBeTruthy()
    // The lexicon comes from what format 3 read, as the rows' did.
    expect(lastV3.lexicon).toBeGreaterThan(0)
    const strong = chapter.texts.find((t) => t.original)!.words!.find((w) => w.strong)!.strong
    expect(data.lexiconOf(strong)).not.toBeNull()
    client.resetPacksV3()
  }, 60_000)

  it('an article reads from format 3 when the language has it there', async () => {
    useStaging()
    const { library, client, sample } = await freshApp()
    const built = await sample.buildSample()
    const packs = await client.packsV3({ fetch: sample.fakeFetch(built), trustedKeys: { [built.keyId]: built.publicKey } })
    await packs.install('es-419', { books: ['tit'] })
    const units = (await packs.status('es-419')).units
    await packs.install('es-419', { units: units.filter((u) => /\/art:/.test(u.key)).map((u) => u.key.split('/').pop()!) })
    await library.openLibrary([project])
    const reader = (await client.readerV3('es-419'))!
    const { readArticleV3 } = await import('../../resources/v3/companionsV3')
    // A word article of the installed ones (`tw:kt/god` is `bible/kt/god` for the screens).
    const group = units.map((u) => u.key.split('/').pop()!).find((u) => u.startsWith('art:tw:'))!
    const id = (await reader.articles(group.slice('art:'.length)))![0].id
    const ref = { kind: 'tw' as const, path: `bible/${id.slice('tw:'.length)}` }
    const fromV3 = await readArticleV3(reader, ref)
    expect(fromV3).not.toBeNull()
    expect(library.articlesOnDevice('tw', 'es-419')).toBe(true)
    expect(await library.readArticle(ref, 'es-419')).toEqual(fromV3)
    client.resetPacksV3()
  }, 60_000)
})
