import { describe, expect, it } from 'vitest'
import type { PartEntry, PartsList } from '@bt-synergy/language-pack'
import { RESOURCE_VERSIONS } from '../store'
import { blockedByList, booksOfUnits, keptOriginals, languagesOf, listHasBook, newestOriginals, planLanguage, unitsOf, unitsWorthPlanning, type KeptList } from './planLanguage'

const sha = (c: string) => c.repeat(64)
const entry = (s: string, kind: PartEntry['kind'], resource: string, book?: string): PartEntry => ({
  sha256: sha(s), bytes: 100, rows: 1, kind, resource, book, fingerprint: 'f', layers: ['sot'],
})
const list = (language: string, parts: PartEntry[], originals?: string, stamps?: Record<string, string>): PartsList =>
  ({
    schema: 2, language, compat: 'c', code: `${language}-1`, versions: {}, resources: [], parts,
    ...(originals ? { originals: { path: `catalog/c/originals/${sha(originals)}.json`, sha256: sha(originals) } } : {}),
    ...(stamps ? { stamps } : {}),
  }) as PartsList
const UGNT = 'unfoldingWord/el-x-koine/ugnt'
const UHB = 'unfoldingWord/hbo/uhb'
const kept = (l: PartsList, at: string, originals?: PartsList): KeptList => ({
  etag: null, list: l, at, ...(originals ? { originals: { sha256: l.originals!.sha256, list: originals } } : {}),
})

const projects = [
  { helpsLanguage: 'es-419', books: [{ code: 'tit' }, { code: 'RUT' }] },
  { helpsLanguage: 'pt-br', books: [{ code: 'jon' }] },
  { helpsLanguage: 'es-419', books: [{ code: 'tit' }, { code: 'jon' }] },
]

describe('what a language needs', () => {
  it('units are the shared one and every book of every project in that language, once', () => {
    expect(unitsOf(projects, 'es-419')).toEqual(['shared', 'book tit', 'book rut', 'book jon'])
    expect(unitsOf(projects, 'pt-br')).toEqual(['shared', 'book jon'])
    expect(languagesOf(projects)).toEqual(['es-419', 'pt-br'])
    expect(booksOfUnits(['shared', 'book tit', 'book jon'])).toEqual(['tit', 'jon'])
  })

  it('plans originals from the most recently fetched list that names them, whichever language it is (Review Focus 4)', () => {
    const o1 = list('originals', [entry('1', 'original', 'unfoldingWord/el-x-koine/ugnt', 'tit')])
    const es = list('es-419', [], '1')
    const pt = list('pt-br', [], '2')
    const all = { 'es-419': kept(es, '2026-10-28T10:00:00Z', o1), 'pt-br': kept(pt, '2026-10-28T11:00:00Z') }
    expect(newestOriginals(all, ['es-419', 'pt-br'])).toMatchObject({ sha256: sha('2'), from: 'pt-br' })
    // Only the languages asked about count: a language no project reads any more does not choose.
    expect(newestOriginals(all, ['es-419'])).toMatchObject({ sha256: sha('1'), from: 'es-419' })
    expect(newestOriginals({ 'en': kept(list('en', []), '2026-10-28T12:00:00Z') }, ['en'])).toBeNull()
    // A kept originals list is found by its sha, whichever language fetched it.
    expect(keptOriginals(all, sha('1'))).toBe(o1)
    expect(keptOriginals(all, sha('2'))).toBeNull()
  })

  it('the newest originals are told by their release stamps; the fetch time only breaks a tie (Review Focus 4)', () => {
    const newer = { [UGNT]: 'v2#2026-10-01T00:00:00Z', [UHB]: 'v2#2026-10-01T00:00:00Z', 'o/es-419/tn': 'v9#2026-01-01T00:00:00Z' }
    const older = { [UGNT]: 'v1#2026-01-01T00:00:00Z', [UHB]: 'v2#2026-10-01T00:00:00Z', 'o/pt-br/tn': 'v99#2026-10-20T00:00:00Z' }
    // A stale list fetched last does not win: its language's own resources do not count, the originals' stamps do.
    const all = {
      'es-419': kept(list('es-419', [], '2', newer), '2026-10-28T10:00:00Z'),
      'pt-br': kept(list('pt-br', [], '1', older), '2026-10-28T11:00:00Z'),
    }
    expect(newestOriginals(all, ['es-419', 'pt-br'])).toMatchObject({ sha256: sha('2'), from: 'es-419' })
    expect(newestOriginals(all, ['pt-br', 'es-419'])).toMatchObject({ sha256: sha('2'), from: 'es-419' })

    // A kept originals list says its own stamps (its resources'), for a language list without `stamps`.
    const o2 = { ...list('originals', []), resources: [{ key: UGNT, stamp: 'v2#2026-10-01T00:00:00Z', role: 'original' }] } as unknown as PartsList
    const kept2 = {
      'es-419': kept(list('es-419', [], '2'), '2026-10-28T10:00:00Z', o2),
      'pt-br': kept(list('pt-br', [], '1', older), '2026-10-28T11:00:00Z'),
    }
    expect(newestOriginals(kept2, ['es-419', 'pt-br'])).toMatchObject({ sha256: sha('2') })

    // Stamps that cannot tell them apart (equal, mixed, or none in common): the later fetch.
    const same = {
      'es-419': kept(list('es-419', [], '2', { [UGNT]: 'v1#2026-01-01T00:00:00Z' }), '2026-10-28T11:00:00Z'),
      'pt-br': kept(list('pt-br', [], '1', { [UGNT]: 'v1#2026-01-01T00:00:00Z' }), '2026-10-28T10:00:00Z'),
    }
    expect(newestOriginals(same, ['es-419', 'pt-br'])).toMatchObject({ sha256: sha('2') })
    const mixed = {
      'es-419': kept(list('es-419', [], '2', { [UGNT]: 'v2#2026-10-01T00:00:00Z', [UHB]: 'v1#2026-01-01T00:00:00Z' }), '2026-10-28T10:00:00Z'),
      'pt-br': kept(list('pt-br', [], '1', { [UGNT]: 'v1#2026-01-01T00:00:00Z', [UHB]: 'v2#2026-10-01T00:00:00Z' }), '2026-10-28T11:00:00Z'),
    }
    expect(newestOriginals(mixed, ['es-419', 'pt-br'])).toMatchObject({ sha256: sha('1') })
  })

  it('the choice does not depend on the order of the lists, with three of them and mixed stamps', () => {
    const at = (h: number) => `2026-10-28T${String(h).padStart(2, '0')}:00:00Z`
    // A is newer than B; C is newer than both in one original and older in the other (cannot be told).
    const a = kept(list('a', [], 'a', { [UGNT]: 'v3#2026-03-01T00:00:00Z', [UHB]: 'v2#2026-02-01T00:00:00Z' }), at(10))
    const b = kept(list('b', [], 'b', { [UGNT]: 'v2#2026-02-01T00:00:00Z', [UHB]: 'v2#2026-02-01T00:00:00Z' }), at(12))
    const c = kept(list('c', [], 'c', { [UGNT]: 'v1#2026-01-01T00:00:00Z', [UHB]: 'v3#2026-03-01T00:00:00Z' }), at(11))
    const all = { a, b, c }
    // B is older than A, so it is out; of A and C, which nothing is newer than, the one fetched last.
    for (const order of [['a', 'b', 'c'], ['b', 'c', 'a'], ['c', 'a', 'b'], ['b', 'a', 'c']]) {
      expect(newestOriginals(all, order)).toMatchObject({ sha256: sha('c') })
    }
  })

  it('a list that names originals is not planned without them; one that names none plans alone', () => {
    const tn = entry('a', 'book', 'o/es-419/tn', 'tit')
    const orig = entry('b', 'original', 'unfoldingWord/el-x-koine/ugnt', 'tit')
    const named = list('es-419', [tn], 'b')
    expect(planLanguage({ list: named, originals: null, register: new Map(), chosen: ['book tit'], versions: RESOURCE_VERSIONS })).toBeNull()
    const plan = planLanguage({ list: named, originals: list('originals', [orig]), register: new Map(), chosen: ['book tit'], versions: RESOURCE_VERSIONS })
    expect(plan?.download.map((p) => p.sha256).sort()).toEqual([sha('a'), sha('b')])
    // Originals given to a list that names none are not planned with it.
    const alone = planLanguage({ list: list('es-419', [tn]), originals: list('originals', [orig]), register: new Map(), chosen: ['book tit'], versions: RESOURCE_VERSIONS })
    expect(alone?.download.map((p) => p.sha256)).toEqual([sha('a')])
    expect(listHasBook(named, 'TIT')).toBe(true)
    expect(listHasBook(named, 'rut')).toBe(false)
  })

  it('each refusal of a list says what to tell the person and when to ask again', () => {
    expect(blockedByList({ kind: 'preparando', retryAfter: 600 })).toEqual({ blocked: 'preparando', retryAfter: 600 })
    expect(blockedByList({ kind: 'noDisponible', retryAfter: 300 })).toEqual({ blocked: 'noDisponible', retryAfter: 300 })
    expect(blockedByList({ kind: 'espera', retryAfter: 30 })).toEqual({ blocked: 'noDisponible', retryAfter: 30 })
    expect(blockedByList({ kind: 'actualizarApp' })).toEqual({ blocked: 'actualizarApp' })
    expect(blockedByList({ kind: 'sinIdioma' })).toEqual({ blocked: 'sinIdioma' })
  })
})

describe('only what differs is planned again (final review, I2)', () => {
  const TN = 'o/es-419/tn'
  const TW = 'o/es-419/tw'
  const l = {
    ...list('es-419', [entry('a', 'book', TN, 'tit'), entry('b', 'book', TN, 'rut'), entry('c', 'titles', TW)]),
    resources: [
      { key: TN, stamp: 'v2', role: 'language', subject: '', title: '', metadata: 'v2' },
      { key: TW, stamp: 'v1', role: 'language', subject: '', title: '', metadata: 'v1' },
    ],
  } as PartsList
  const chosen = ['shared', 'book tit', 'book rut']
  const worth = (register: Map<string, { sha256: string; keys: string[]; list: string; at: string }>, here: string[], device: Record<string, string>) =>
    unitsWorthPlanning({
      list: l, originals: null, register, chosen,
      plan: planLanguage({ list: l, originals: null, register, chosen, versions: RESOURCE_VERSIONS })!,
      here: (u) => u === 'shared' || here.includes(u),
      deviceStamp: (key) => device[key] ?? 'nostamp',
      listStamp: (metadata) => String(metadata),
    })
  const slot = (s: string) => ({ sha256: sha(s), keys: [], list: 'es-419', at: '' })

  it("a unit here in the lists' release, without slots, is left out; one here in another release is not", () => {
    expect(worth(new Map(), ['book tit', 'book rut'], { [TN]: 'v2', [TW]: 'v1' })).toEqual([])
    expect(worth(new Map(), ['book tit', 'book rut'], { [TN]: 'v1', [TW]: 'v1' })).toEqual(['book tit', 'book rut'])
  })

  it('a book not here is planned, whatever the release of its resources on the device', () => {
    expect(worth(new Map(), ['book tit'], { [TN]: 'v2', [TW]: 'v1' })).toEqual(['book rut'])
  })

  it('a slot of another sha keeps its unit: the catalog row may be the release another book brought', () => {
    // Titus was applied from parts in v2 (the catalog row says v2); Ruth still holds v1's notes.
    const register = new Map([['book:o/es-419/tn:tit', slot('a')], ['book:o/es-419/tn:rut', slot('z')], ['titles:o/es-419/tw', slot('c')]])
    expect(worth(register, ['book tit', 'book rut'], { [TN]: 'v2', [TW]: 'v1' })).toEqual(['shared', 'book tit', 'book rut'])
  })

  it('a resource the lists give no row for keeps its unit', () => {
    const bare = { ...l, resources: [] } as PartsList
    const units = unitsWorthPlanning({
      list: bare, originals: null, register: new Map(), chosen,
      plan: planLanguage({ list: bare, originals: null, register: new Map(), chosen, versions: RESOURCE_VERSIONS })!,
      here: () => true, deviceStamp: () => 'v1', listStamp: (m) => String(m),
    })
    expect(units).toEqual(chosen)
  })
})

describe('the final re-review: what the catalog row can tell', () => {
  const TN = 'o/es-419/tn'

  it('a missing stamp, on the device or in the list, never matches', () => {
    const l = {
      ...list('es-419', [entry('a', 'book', TN, 'tit')]),
      resources: [{ key: TN, stamp: 'nostamp', role: 'language', subject: '', title: '', metadata: 'nostamp' }],
    } as PartsList
    const plan = planLanguage({ list: l, originals: null, register: new Map(), chosen: ['book tit'], versions: RESOURCE_VERSIONS })!
    const worth = (device: string) =>
      unitsWorthPlanning({ list: l, originals: null, register: new Map(), chosen: ['book tit'], plan, here: () => true, deviceStamp: () => device, listStamp: (m) => String(m) })
    expect(worth('nostamp')).toEqual(['book tit'])
  })

  it('once a resource has a slot, its catalog row says nothing of the books a pack brought', () => {
    const l = {
      ...list('es-419', [entry('a', 'book', TN, 'tit'), entry('b', 'book', TN, 'rut')]),
      resources: [{ key: TN, stamp: 'v2', role: 'language', subject: '', title: '', metadata: 'v2' }],
    } as PartsList
    const register = new Map([['book:o/es-419/tn:rut', { sha256: sha('b'), keys: [], list: 'es-419', at: '' }]])
    const plan = planLanguage({ list: l, originals: null, register, chosen: ['book tit', 'book rut'], versions: RESOURCE_VERSIONS })!
    const units = unitsWorthPlanning({
      list: l, originals: null, register, chosen: ['book tit', 'book rut'], plan,
      here: () => true, deviceStamp: () => 'v2', listStamp: (m) => String(m),
    })
    // Titus is planned: tn has a slot (Ruth's), so the row's v2 may be only Ruth's.
    expect(units).toEqual(['book tit', 'book rut'])
  })
})
