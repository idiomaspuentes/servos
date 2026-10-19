import { describe, expect, it } from 'vitest'
import { compareStamps, packAgainstDevice, standingOf } from './freshness'

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
