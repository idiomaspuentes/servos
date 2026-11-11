import { describe, expect, it } from 'vitest'
import { creditsOf, creditsOnDevice, type ResourceV3 } from './credits'
import type { ResourceStores } from './store'

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

  it('format 3 resources are credited from their catalogs, with the credit sentence some sources ask for', async () => {
    // As a format 3 catalog lists them (es-419 and common on staging): no rows on the device.
    const v3: ResourceV3[] = [
      { key: 'es-419_gl/es-419/glt', title: 'Texto Puente Literal', subject: 'Aligned Bible', license: 'CC-BY-SA-4.0' },
      { key: 'es-419_gl/es-419/tn', title: 'Notas de Traducción', subject: 'TSV Translation Notes', license: 'CC-BY-SA-4.0' },
      { key: 'unfoldingWord/el-x-koine/ugnt', title: 'unfoldingWord® Greek New Testament', subject: 'Greek New Testament', license: 'CC-BY-SA-4.0' },
      {
        key: 'STEPBible/STEPBible-Data/TIPNR',
        title: 'TIPNR',
        subject: 'Topics',
        license: 'CC-BY-4.0',
        attribution: '"STEP Bible" (www.STEPBible.org), data by Tyndale House Cambridge, licensed CC BY 4.0.',
      },
    ]
    const credits = await creditsOnDevice(storesWith({}), undefined, v3)
    expect(credits.map(({ titles, by, license, notes }) => ({ titles, by, license, notes }))).toEqual([
      { titles: ['Texto Puente Literal', 'Notas de Traducción'], by: 'es-419_gl', license: 'CC BY-SA 4.0', notes: [] },
      { titles: ['TIPNR'], by: 'STEPBible', license: 'CC BY 4.0', notes: [v3[3].attribution] },
      { titles: ['unfoldingWord® Greek New Testament'], by: 'unfoldingWord', license: 'CC BY-SA 4.0', notes: [] },
    ])
  })

  it('a resource with a row and in a format 3 catalog is credited once, from its row', async () => {
    const v3: ResourceV3[] = [
      { key: 'es-419_gl/es-419/glt', title: 'Texto Puente Literal', subject: 'Aligned Bible', license: 'CC-BY-SA-4.0' },
      { key: 'es-419_gl/es-419/gst', title: 'Texto Puente Simple', subject: 'Aligned Bible', license: 'CC-BY-SA-4.0', rights: 'CC BY-SA 4.0' },
    ]
    const credits = await creditsOnDevice(storesWith({ 'es-419_gl/es-419/glt': glt }), undefined, v3)
    expect(credits.map(({ titles, by, license, notes }) => ({ titles, by, license, notes }))).toEqual([
      { titles: ['Texto Puente Literal'], by: 'Idiomas Puentes', license: 'CC BY-SA 4.0', notes: [] },
      // The same license said twice is no note.
      { titles: ['Texto Puente Simple'], by: 'es-419_gl', license: 'CC BY-SA 4.0', notes: [] },
    ])
  })
})

/** The rows' store as `creditsOnDevice` reads it. */
function storesWith(rows: Record<string, Record<string, unknown>>): ResourceStores {
  return { catalog: { getAll: async () => Object.keys(rows), get: async (key: string) => rows[key] } } as unknown as ResourceStores
}
