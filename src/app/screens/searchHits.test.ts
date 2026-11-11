import type { Hit } from '@bt-synergy/language-pack-client'
import { describe, expect, test } from 'vitest'
import type { T } from '../i18n/i18n'
import { groupHits, groupKey, hitPlace, hitWhere, plainSnippet, resLabel, searchCoverage, snippetParts } from './searchHits'

const hit = (kind: string, ref: string, extra: Partial<Hit> = {}): Hit => ({ kind, book: 'tit', ref, res: `es-419/${kind}`, snippet: '', score: 1, ...extra })
const t: T = (key, values) => `${key}${values ? JSON.stringify(values) : ''}`

describe('the search sheet', () => {
  test('hits grouped by kind', () => {
    const hits = [hit('note', '3:7', { score: 9 }), hit('link', '2:11'), hit('text', '3:7'), hit('note', '2:11', { score: 4 }), hit('lex', '1:1'), hit('question', '3:15')]
    const groups = groupHits(hits)
    expect(groups.map((g) => g.kind)).toEqual(['text', 'note', 'question', 'link', 'lex'])
    // Within a group the library's order (best first) is kept.
    expect(groups[1]!.hits.map((h) => h.ref)).toEqual(['3:7', '2:11'])
    expect(groupKey('note')).toBe('buscar.tipo.note')
    expect(groupKey('lex')).toBe('buscar.tipo.otro')
    expect(groupHits([])).toEqual([])
  })

  test('a hit opens its verse', () => {
    expect(hitPlace(hit('text', '3:7'))).toEqual({ book: 'tit', chapter: 3, verse: 7 })
    // A note on a range opens its first verse.
    expect(hitPlace(hit('note', '2:11-14'))).toEqual({ book: 'tit', chapter: 2, verse: 11 })
    // An introduction is no verse: the hit is read in the sheet, not opened.
    expect(hitPlace(hit('note', 'front:intro'))).toBeNull()
    expect(hitPlace(hit('note', '3:intro'))).toBeNull()
  })

  test('says where a hit is', () => {
    expect(hitWhere(hit('text', '3:7'), t)).toBe('Tito 3:7')
    expect(hitWhere(hit('note', 'front:intro'), t)).toBe('buscar.introLibro{"libro":"Tito"}')
    expect(hitWhere(hit('note', '3:intro'), t)).toBe('buscar.introCapitulo{"libro":"Tito","n":3}')
    expect(resLabel('es-419/glt')).toBe('GLT')
  })

  test('marks the words searched, not the quotes of the text', () => {
    expect(snippetParts('La «gracia» de Dios', 'gracia')).toEqual([
      { text: 'La ', found: false },
      { text: 'gracia', found: true },
      { text: ' de Dios', found: false },
    ])
    // Spanish quotes around the word found, and around a word not searched.
    expect(snippetParts('La palabra ««gracía»» y «favor» …', 'Gracia')).toEqual([
      { text: 'La palabra «', found: false },
      { text: 'gracía', found: true },
      { text: '» y «favor» …', found: false },
    ])
    expect(snippetParts('su «GRÁCIA» y «paz»', 'gracia paz').filter((p) => p.found).map((p) => p.text)).toEqual(['GRÁCIA', 'paz'])
  })

  test('names the books read here that a search does not look in', () => {
    // Titus read from today's pack, Jonah and Ruth in format 3, 3 John installed but not indexed yet.
    const c = searchCoverage(['TIT', 'jon', 'rut'], { searchable: ['rut', 'jon'], notIndexed: ['3jn'] })
    expect(c).toEqual({ searchable: ['rut', 'jon'], notIndexed: ['3jn'], before: ['tit'] })
    // Nothing read here outside format 3: nothing to name.
    expect(searchCoverage(['tit'], { searchable: ['tit'], notIndexed: [] }).before).toEqual([])
    expect(searchCoverage(['tit'], { searchable: [], notIndexed: [] })).toEqual({ searchable: [], notIndexed: [], before: ['tit'] })
  })

  test("a note's snippet is plain text: no markdown marks, links as their words, the found words kept", () => {
    // As the emulator showed them (B9): bold, a link, and a link cut by the snippet's end.
    expect(plainSnippet('La frase **he hallado «gracia» ante tus ojos** es')).toBe('La frase he hallado «gracia» ante tus ojos es')
    expect(plainSnippet('(ver [Tito 2:11](../02/11.md)) y la «gracia» de')).toBe('(ver Tito 2:11) y la «gracia» de')
    expect(plainSnippet('la «gracia» ([Tito 2:11](../02/11…')).toBe('la «gracia» (Tito 2:11')
    expect(plainSnippet('# Gracia\n> la *«gracia»* de `Dios` y __más__')).toBe('Gracia la «gracia» de Dios y más')
    // What is not markdown stays: a name with an underscore, a lone asterisk.
    expect(plainSnippet('es-419_gl 3 * 4 y la «gracia» de Dios')).toBe('es-419_gl 3 * 4 y la «gracia» de Dios')
    expect(snippetParts('**«gracia»** de [Dios](x)', 'gracia')).toEqual([
      { text: 'gracia', found: true },
      { text: ' de Dios', found: false },
    ])
  })
})
