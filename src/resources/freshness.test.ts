import { describe, expect, it } from 'vitest'
import { bringsAnything, compareStamps, packAgainstDevice, standingOf } from './freshness'

const TN = 'es-419_gl/es-419/tn'
const TPL = 'es-419_gl/es-419/glt'
const TW = 'es-419_gl/es-419/tw'
const V87 = 'v87#2026-09-02T10_00_00Z'
const V88 = 'v88#2026-10-12T14_03_00Z'

describe('compareStamps', () => {
  it('compara por la fecha de publicación', () => {
    expect(compareStamps(V88, V87)).toBeGreaterThan(0)
    expect(compareStamps(V87, V88)).toBeLessThan(0)
    expect(compareStamps(V88, V88)).toBe(0)
  })

  it('sin fecha, compara los números de la etiqueta: v10 es más nueva que v9', () => {
    expect(compareStamps('v10', 'v9')).toBeGreaterThan(0)
    expect(compareStamps('v1.2', 'v1.10')).toBeLessThan(0)
  })

  it('una copia sin versión es más vieja que una con versión', () => {
    expect(compareStamps('nostamp', V87)).toBeLessThan(0)
    expect(compareStamps(V87, 'nostamp')).toBeGreaterThan(0)
  })

  it('no adivina cuando no se puede saber', () => {
    expect(compareStamps('borrador', 'final')).toBeNull()
  })
})

describe('standingOf', () => {
  it('dice si la otra copia es nueva aquí, más nueva, la misma, más vieja u otra', () => {
    const copy = (stamp: string) => ({ key: TN, stamp, books: ['jon'] })
    expect(standingOf(copy(V88), undefined)).toBe('new')
    expect(standingOf(copy(V88), copy(V87))).toBe('newer')
    expect(standingOf(copy(V87), copy(V87))).toBe('same')
    expect(standingOf(copy(V87), copy(V88))).toBe('older')
    expect(standingOf(copy('borrador'), copy('final'))).toBe('other')
  })

  // MACULA in the packs of rc.1 and the first rc.2 was stamped with the day the pack was built (prepare-language's
  // `builtNow`); production stamps it with its Taller commit. Built on 29 October, the same MACULA looked newer than
  // its release of 15 October, the pack that brought the commit was not opened, and the app offered 10.1 MB again.
  describe('una copia sellada con el día en que se hizo el paquete', () => {
    const MACULA = 'Biblica/hbo/macula'
    const copy = (stamp: string) => ({ key: MACULA, stamp, books: [] })
    const BUILT = '2026-10-29#2026-10-29T02_00_38.785Z'
    const RELEASE = '3b8aa380e8#2026-10-15T02_19_35.000Z'

    it('la reemplaza una copia que dice su versión, aunque sea de antes', () => {
      expect(standingOf(copy(RELEASE), copy(BUILT))).toBe('newer')
    })

    it('no reemplaza una copia que dice su versión', () => {
      expect(standingOf(copy(BUILT), copy(RELEASE))).toBe('older')
    })

    it('entre dos así, la del día más nuevo es la más nueva, como antes', () => {
      expect(standingOf(copy(BUILT), copy('2026-10-19#2026-10-19T20_30_00.000Z'))).toBe('newer')
    })

    it('una copia sin versión sigue siendo más vieja que esta, y esta más nueva', () => {
      expect(standingOf(copy('nostamp'), copy(BUILT))).toBe('older')
      expect(standingOf(copy(BUILT), copy('nostamp'))).toBe('newer')
    })

    it('una versión de Door43 con fecha por nombre, publicada ese día, no se toma por una de estas', () => {
      const dated = '2025-03-01#2025-03-01T14_00_00Z'
      expect(standingOf(copy('v1#2024-01-01T00_00_00Z'), copy(dated))).toBe('older')
    })

    it('el paquete que dice la versión la reemplaza al abrirse', () => {
      const against = packAgainstDevice({ resources: [copy(RELEASE)] }, [copy(BUILT)])
      expect(against.replace).toEqual([MACULA])
      expect(bringsAnything(against)).toBe(true)
    })
  })
})

describe('packAgainstDevice', () => {
  it('reemplaza solo lo más nuevo; lo más viejo deja lo de aquí', () => {
    const result = packAgainstDevice(
      {
        resources: [
          { key: TN, stamp: V88, books: ['jon', 'tit'] },
          { key: TPL, stamp: V87, books: ['jon', 'tit'] },
          { key: TW, stamp: V88, books: [] },
        ],
      },
      [
        { key: TN, stamp: V87, books: ['jon', 'tit'] },
        { key: TPL, stamp: V88, books: ['jon', 'tit'] },
      ]
    )
    expect(result.resources.map((r) => [r.key, r.standing])).toEqual([
      [TN, 'newer'],
      [TPL, 'older'],
      [TW, 'new'],
    ])
    expect(result.replace).toEqual([TN])
  })

  it('un paquete de un libro no reemplaza un recurso del que aquí hay más libros, y dice cuáles faltan', () => {
    const result = packAgainstDevice(
      { resources: [{ key: TN, stamp: V88, books: ['jon', 'rut', 'tit'] }], books: ['RUT'] },
      [{ key: TN, stamp: V87, books: ['jon', 'tit'] }]
    )
    expect(result.resources[0]).toMatchObject({ standing: 'newer', lacking: ['jon', 'tit'] })
    expect(result.replace).toEqual([])
  })

  it('de la misma versión, dice qué libros trae que aquí no están', () => {
    const result = packAgainstDevice({ resources: [{ key: TN, stamp: V87, books: ['jon', 'rut', 'tit'] }] }, [{ key: TN, stamp: V87, books: ['jon', 'tit'] }])
    expect(result.resources[0]).toMatchObject({ standing: 'same', adds: ['rut'] })
    expect(result.replace).toEqual([])
  })

  it('un recurso por artículos (palabras, academia) llega entero', () => {
    const result = packAgainstDevice({ resources: [{ key: TW, stamp: V88, books: [] }], books: ['rut'] }, [{ key: TW, stamp: V87, books: [] }])
    expect(result.replace).toEqual([TW])
  })

  it('lo que aquí ya no se puede leer se reemplaza, aunque el paquete no sea más nuevo', () => {
    const result = packAgainstDevice({ resources: [{ key: TPL, stamp: V87, books: ['jon'] }] }, [{ key: TPL, stamp: V87, books: ['jon'], stale: true }])
    expect(result.resources[0]).toMatchObject({ standing: 'same', stale: true })
    expect(result.replace).toEqual([TPL])
  })
})
