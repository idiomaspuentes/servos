import { describe, expect, it } from 'vitest'
import type { ArticleData, PackReader } from '@bt-synergy/language-pack-client'
import type { OrigModel, Segment } from '@bt-synergy/language-pack-v3'
import { articlesV3, lexiconV3, maculaV3, readArticleV3 } from './companionsV3'

/** A lexicon segment of the group G5, as `lexView` reads it. */
const lexG5: Segment = {
  h: { class: 'lex', v: 1, tables: {}, lang: 'es-419', group: 'G5', res: [['es-419_gl/es-419/ugl', 'v1']] },
  t: {
    entries: [
      {
        res: 0,
        strong: 'G5228',
        lemma: 'ὑπέρ',
        brief: 'por, sobre',
        long: '',
        senses: [
          { glosses: ['por'], definition: 'a favor de', refs: [[56002014, 56002014], [56001001, 56001003]] },
          { glosses: ['[Glosses - es]'] },
        ],
      },
    ],
  },
}

const grace: ArticleData = {
  id: 'tw:kt/grace',
  title: 'gracia, amable',
  sections: [
    { sid: 'definition', level: 2, role: 'definition', title: 'Definición:', lang: 'es-419', md: 'Ver [[tw:kt/god]].', otherLang: false },
  ],
  more: [],
}

function reader(units: Record<string, Segment[]>, articles: Record<string, ArticleData> = {}): PackReader {
  return {
    installed: (unit: string) => unit in units,
    segments: async (unit: string) => units[unit],
    unitOf: () => undefined,
    articles: async () => undefined,
    article: async (id: string) => ({ query: 'article', data: articles[id] ?? null, cites: [], revision: { units: {} }, notInstalled: [] }),
  } as unknown as PackReader
}

describe('what a format 3 pack gives beside the texts', () => {
  it('a lexicon entry is read from its lex unit', async () => {
    const found = await lexiconV3(reader({ 'lex:G5': [lexG5] }), ['G52280', 'G23160'])
    expect(Object.keys(found)).toEqual(['greek:5228'])
    expect(found['greek:5228']).toEqual({
      brief: 'por, sobre',
      long: '',
      entries: [{ strong: 'G5228', lemma: 'ὑπέρ', senses: [{ definition: 'a favor de', glosses: ['por'], refs: { TIT: '2:14;1:1-3' } }] }],
    })
  })

  it('reads each group once, finds each number among the entries that share its thousand, and gives turns', async () => {
    const entry = (strong: string) => ({ ...(lexG5.t.entries as object[])[0], strong, lemma: strong })
    const group: Segment = { ...lexG5, t: { entries: [entry('G5228'), entry('G5000'), entry('G05228')] } }
    let read = 0
    let turns = 0
    const r = reader({ 'lex:G5': [group] })
    const counted = { ...r, segments: async (unit: string) => (read++, r.segments(unit)) } as PackReader
    const found = await lexiconV3(counted, ['G52280', 'G50000', 'G59990'], async () => void turns++)
    expect(read).toBe(1)
    expect(Object.keys(found).sort()).toEqual(['greek:5000', 'greek:5228'])
    // G05228 is the same number.
    expect(found['greek:5228'].entries.map((e) => e.strong)).toEqual(['G5228', 'G05228'])
    expect(turns).toBe(3)
  })

  it('reads no lexicon of a group that is not installed', async () => {
    expect(await lexiconV3(reader({}), ['G52280'])).toEqual({})
  })

  it('an article is its title and its sections, its links as rc links; one not installed is titled by its name', async () => {
    const r = reader({}, { 'tw:kt/grace': grace })
    expect(await readArticleV3(r, { kind: 'tw', path: 'bible/kt/grace' })).toEqual({
      title: 'gracia, amable',
      markdown: '# gracia, amable\n\n## Definición:\n\nVer [[rc://*/tw/dict/bible/kt/god]].\n',
    })
    const all = await articlesV3(r, ['bible/kt/grace', 'bible/kt/faith'], ['translate/figs-you'])
    expect(all.tw['bible/kt/faith']).toEqual({ title: 'faith', markdown: '' })
    expect(all.ta['translate/figs-you']).toEqual({ title: 'translate/figs-you', markdown: '' })
  })

  it('MACULA is none when the original has none', () => {
    expect(maculaV3({ macula: undefined } as OrigModel)).toEqual({ trees: null, referents: null })
  })
})
