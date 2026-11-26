import { describe, expect, it } from 'vitest'
import { isLanguageCatalog, languageCatalogs } from './catalogNames'

describe('languageCatalogs', () => {
  it('leaves out the originals and the shared companions, such as the OBS images', () => {
    expect(languageCatalogs(['common', 'zxx-obsimg', 'es-419', 'zxx-basemap', 'pt-br'])).toEqual(['es-419', 'pt-br'])
  })

  it('keeps a language whose code only looks alike', () => {
    expect(isLanguageCatalog('zxa-x')).toBe(true)
    expect(isLanguageCatalog('es-419')).toBe(true)
  })
})
