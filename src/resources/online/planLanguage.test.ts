import { describe, expect, it } from 'vitest'
import type { PartEntry, PartsList } from '@bt-synergy/language-pack'
import { blockedByList, booksOfUnits, keptOriginals, languagesOf, listHasBook, newestOriginals, planLanguage, unitsOf, type KeptList } from './planLanguage'

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

  it('a list that names originals is not planned without them; one that names none plans alone', () => {
    const tn = entry('a', 'book', 'o/es-419/tn', 'tit')
    const orig = entry('b', 'original', 'unfoldingWord/el-x-koine/ugnt', 'tit')
    const named = list('es-419', [tn], 'b')
    expect(planLanguage({ list: named, originals: null, register: new Map(), chosen: ['book tit'] })).toBeNull()
    const plan = planLanguage({ list: named, originals: list('originals', [orig]), register: new Map(), chosen: ['book tit'] })
    expect(plan?.download.map((p) => p.sha256).sort()).toEqual([sha('a'), sha('b')])
    // Originals given to a list that names none are not planned with it.
    const alone = planLanguage({ list: list('es-419', [tn]), originals: list('originals', [orig]), register: new Map(), chosen: ['book tit'] })
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
