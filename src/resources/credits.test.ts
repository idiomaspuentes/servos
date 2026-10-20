import { describe, expect, it } from 'vitest'
import { creditsOf } from './credits'

// Catalog rows as packs leave them: es-419_gl's releases (with the attribution bt-synergy keeps since it reads
// dublin_core), a lexicon, unfoldingWord's originals and MACULA.
const glt = {
  owner: 'es-419_gl',
  title: 'Texto Puente Literal',
  license: { id: 'CC BY-SA 4.0' },
  attribution: {
    rights: 'CC BY-SA 4.0',
    publisher: 'Idiomas Puentes',
    creator: 'Door43 World Missions Community',
    sources: [{ owner: 'unfoldingWord', identifier: 'ult', language: 'en' }],
  },
}
const tn = { ...glt, title: 'Notas de Traducción', attribution: { ...glt.attribution, sources: [{ owner: 'unfoldingWord', identifier: 'tn', language: 'en' }] } }
const ugl = {
  owner: 'es-419_gl',
  title: 'Español Latinoamericano',
  license: { id: 'CC BY-SA 4.0' },
  attribution: { rights: 'CC BY-SA 4.0', publisher: 'Idiomas Puentes', creator: 'United Bible Societies', sources: [{ identifier: 'ubs-dgnt', language: 'es' }] },
}
const ugnt = { owner: 'unfoldingWord', title: 'unfoldingWord® Greek New Testament', license: { id: 'CC BY-SA 4.0' }, attribution: { publisher: 'unfoldingWord', creator: 'unfoldingWord' } }
const macula = { owner: 'Biblica', title: 'MACULA griego', license: { id: 'CC BY 4.0' }, attribution: { rights: 'CC BY 4.0', publisher: 'Biblica' } }

describe('creditsOf', () => {
  it('puts together the resources with the same author, sources and license', () => {
    const credits = creditsOf([
      ['es-419_gl/es-419/glt', glt],
      ['es-419_gl/es-419/tn', tn],
      ['es-419_gl/es-419/ugl', ugl],
      ['unfoldingWord/el-x-koine/ugnt', ugnt],
      ['Biblica/el-x-koine/macula', macula],
    ])
    expect(credits.map(({ titles, by, basedOn, license }) => ({ titles, by, basedOn, license }))).toEqual([
      { titles: ['Texto Puente Literal', 'Notas de Traducción'], by: 'Idiomas Puentes', basedOn: ['unfoldingWord', 'Door43 World Missions Community'], license: 'CC BY-SA 4.0' },
      { titles: ['Español Latinoamericano'], by: 'Idiomas Puentes', basedOn: ['United Bible Societies'], license: 'CC BY-SA 4.0' },
      { titles: ['unfoldingWord® Greek New Testament'], by: 'unfoldingWord', basedOn: [], license: 'CC BY-SA 4.0' },
      { titles: ['MACULA griego'], by: 'Biblica', basedOn: [], license: 'CC BY 4.0' },
    ])
    expect(credits[0].keys).toEqual(['es-419_gl/es-419/glt', 'es-419_gl/es-419/tn'])
  })

  it('an older pack, with no attribution: its owner in the catalog, never a name made up', () => {
    const [credit] = creditsOf([['es-419_gl/es-419/gst', { owner: 'es-419_gl', title: 'Texto Puente Simple', license: { id: 'CC BY-SA 4.0' } }]])
    expect(credit).toMatchObject({ by: 'es-419_gl', basedOn: [], license: 'CC BY-SA 4.0' })
  })

  it('no license in the pack: null, for the sheet to say so', () => {
    const [credit] = creditsOf([['Biblica/hbo/macula', { owner: 'Biblica', title: 'MACULA hebreo' }]])
    expect(credit.license).toBeNull()
    expect(credit.by).toBe('Biblica')
  })
})
