import { beforeEach, describe, expect, it } from 'vitest'
import {
  entriesAbout,
  entryFor,
  gatherGlossary,
  glossaryBundle,
  glossaryCode,
  glossaryFileFor,
  parseGlossary,
  readBundle,
  readGlossary,
  readGlossaryFor,
  saveGlossaryEntry,
  serializeGlossary,
  type GlossaryEntry,
} from './glossary'

// The prototype keeps the glossary in localStorage; the tests run without a browser.
beforeEach(() => {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
})

const entry = (over: Partial<GlossaryEntry>): GlossaryEntry => ({
  id: 'a1b2',
  lemma: 'קָרָא',
  strong: 'H7121',
  english: [],
  sense: '',
  rendering: 'waqyay',
  alternatives: [],
  avoid: [],
  scope: 'all',
  variants: [],
  twLink: '',
  examples: [],
  status: 'proposed',
  note: '',
  by: 'Ana',
  ...over,
})

describe('glosario', () => {
  it('se escribe y se lee como el TSV de Taller, con la columna de quién al final', () => {
    const entries = [entry({ alternatives: ['kayay', 'qapariy'], note: 'clamar a Dios' })]
    const tsv = serializeGlossary(entries)
    expect(tsv.split('\n')[0]).toBe('ID\tLemma\tStrong\tEnglish\tSense\tRendering\tAlternatives\tAvoid\tScope\tVariants\tTWLink\tExamples\tStatus\tNote\tBy')
    expect(parseGlossary(tsv)).toEqual(entries)
    // A file from Taller has no `By`: it reads as nobody's.
    const taller = tsv
      .split('\n')
      .map((line) => line.split('\t').slice(0, 14).join('\t'))
      .join('\n')
    expect(parseGlossary(taller)[0].by).toBe('')
  })

  it('una entrada se encuentra por la palabra del original, aunque su Strong lleve prefijo', () => {
    const entries = [entry({}), entry({ id: 'c3d4', lemma: 'פָּלַל + אֶל', strong: 'H6419;H0413', rendering: 'mañay' })]
    expect(entryFor(entries, 'c:H7121')?.id).toBe('a1b2')
    expect(entryFor(entries, 'c:H6419;H0413')?.id).toBe('c3d4')
    expect(entriesAbout(entries, ['c:H6419']).map((e) => e.id)).toEqual(['c3d4'])
    expect(glossaryFileFor('c:H6419')).toBe('tg_hbo.tsv')
    expect(glossaryFileFor('G23160')).toBe('tg_grc.tsv')
  })

  it('juntar un glosario recibido agrega lo nuevo y guarda la otra forma como alternativa, sin perder nada', () => {
    const mine = [entry({ rendering: 'waqyay' })]
    const theirs = [entry({ id: 'zz99', rendering: 'qapariy', by: 'Bea' }), entry({ id: 'x1y2', lemma: 'יוֹנָה', strong: 'H3124', rendering: 'Jonás' })]
    const { entries, gathered } = gatherGlossary(mine, theirs)
    expect(gathered).toEqual({ added: 1, same: 0, joined: 1 })
    expect(entries[0]).toMatchObject({ rendering: 'waqyay', alternatives: ['qapariy'], status: 'proposed' })
    expect(entries[1]).toMatchObject({ lemma: 'יוֹנָה', rendering: 'Jonás' })
    expect(gatherGlossary(entries, theirs).gathered).toEqual({ added: 0, same: 2, joined: 0 })
  })

  it('se guarda un archivo por palabra y se leen solo los de las palabras pedidas', () => {
    saveGlossaryEntry('p', entry({}), new Date('2026-10-01'))
    saveGlossaryEntry('p', entry({ id: 'x1y2', lemma: 'יוֹנָה', strong: 'H3124', rendering: 'Jonás' }), new Date('2026-10-02'))
    saveGlossaryEntry('p', entry({ id: 'g1h2', lemma: 'θεός', strong: 'G23160', rendering: 'Dios' }), new Date('2026-10-03'))
    expect([glossaryCode('c:H7121'), glossaryCode('G23160'), glossaryCode('H1254a')]).toEqual(['H7121', 'G2316', 'H1254a'])
    expect(localStorage.getItem('servos.prototipo.glosario.p.H7121')).toContain('"strong":"H7121"')
    expect(readGlossaryFor('p', ['c:H7121', 'H0413']).map((e) => e.rendering)).toEqual(['waqyay'])
    expect(readGlossary('p')).toHaveLength(3)
  })

  it('compartir lleva solo lo cambiado desde la última vez, y recibir lee eso o un TSV de Taller', () => {
    saveGlossaryEntry('p', entry({}), new Date('2026-10-01'))
    saveGlossaryEntry('p', entry({ id: 'x1y2', lemma: 'יוֹנָה', strong: 'H3124', rendering: 'Jonás' }), new Date('2026-10-05'))
    const bundle = glossaryBundle(readGlossary('p'), '2026-10-03T00:00:00.000Z')
    expect(readBundle(bundle).map((e) => e.rendering)).toEqual(['Jonás'])
    expect(readBundle(glossaryBundle(readGlossary('p')))).toHaveLength(2)
    expect(readBundle(serializeGlossary([entry({})])).map((e) => e.rendering)).toEqual(['waqyay'])
  })
})
