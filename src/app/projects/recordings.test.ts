import { beforeEach, describe, expect, it } from 'vitest'
import { addTake, audioFileOf, blobOf, chooseTake, chosenTake, clock, gatherTakes, recordedPlaces, recorderOptions, takeCovering, takesOf } from './recordings'

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

describe('recordings of a verse said aloud', () => {
  it('keeps every take, the last one counting', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-16T10:00:00Z', ms: 5200, mime: 'audio/webm' }, 'a')
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-16T10:01:00Z', ms: 4800, mime: 'audio/webm' }, 'b')
    expect(takesOf('jon', 1, 1).map((x) => x.id)).toEqual(['a', 'b'])
    expect(chosenTake('jon', 1, 1)?.id).toBe('b')
  })

  it('lets an earlier take be the one that counts, without losing the others', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '', ms: 1, mime: '' }, 'a')
    addTake('jon', 1, 1, { by: 'Bea', at: '', ms: 1, mime: '' }, 'b')
    chooseTake('jon', 1, 1, 'a')
    expect(chosenTake('jon', 1, 1)?.by).toBe('Ana')
    expect(takesOf('jon', 1, 1)).toHaveLength(2)
  })

  it('counts a passage said in one take for each of its verses, and no further', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '', ms: 1, mime: '', to: 3 }, 's')
    expect([1, 2, 3].map((v) => takeCovering('jon', 1, v)?.id)).toEqual(['s', 's', 's'])
    expect(takeCovering('jon', 1, 4)).toBeNull()
  })

  it('still counts the passage for its later verses when one verse of it was said again alone', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '', ms: 1, mime: '', to: 5 }, 's')
    addTake('jon', 1, 2, { by: 'Bea', at: '', ms: 1, mime: '' }, 'v2')
    expect(takeCovering('jon', 1, 2)?.id).toBe('v2')
    expect(takeCovering('jon', 1, 4)?.id).toBe('s')
  })

  it('gathers takes from another phone without losing any, keeping the one that counts here', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '', ms: 1, mime: '' }, 'a')
    const fresh = gatherTakes('jon', 1, 1, { takes: [{ id: 'a', by: 'Ana', at: '', ms: 1, mime: '' }, { id: 'b', by: 'Bea', at: '', ms: 1, mime: '' }], chosen: 'b' })
    expect(fresh.map((x) => x.id)).toEqual(['b'])
    expect(takesOf('jon', 1, 1).map((x) => x.id)).toEqual(['a', 'b'])
    expect(chosenTake('jon', 1, 1)?.id).toBe('a')
  })

  it('takes the one that counted there where nothing was recorded here', () => {
    gatherTakes('jon', 1, 4, { takes: [{ id: 'x', by: 'Bea', at: '', ms: 1, mime: '' }, { id: 'y', by: 'Bea', at: '', ms: 1, mime: '' }], chosen: 'x' })
    expect(chosenTake('jon', 1, 4)?.id).toBe('x')
  })

  it('lists the places of a book that have recordings, in order', () => {
    addTake('jon', 2, 1, { by: 'Ana', at: '', ms: 1, mime: '' }, 'p')
    addTake('jon', 1, 4, { by: 'Ana', at: '', ms: 1, mime: '' }, 'q')
    expect(recordedPlaces('jon').map((p) => `${p.chapter}:${p.verse}`)).toEqual(['1:4', '2:1'])
  })

  it('names a take in the repository by its place, the passage it says and its sound', () => {
    const take = { id: 's', by: 'Ana', at: '', ms: 1, mime: 'audio/webm;codecs=opus', to: 3 }
    expect(audioFileOf('jon', 1, 1, take)).toBe('audio/JON/001/001-003.webm')
    expect(audioFileOf('jon', 2, 10, { ...take, to: undefined, mime: 'audio/mp4' })).toBe('audio/JON/002/010.m4a')
  })

  it('turns a sound received as base64 back into its bytes', async () => {
    const blob = blobOf(btoa('\x00\x01\xff'), 'audio/webm')
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 1, 255])
    expect(blob.type).toBe('audio/webm')
  })

  it('has none for a verse not said yet', () => {
    expect(chosenTake('jon', 1, 9)).toBeNull()
  })

  it('says how long a take is as a clock', () => {
    expect(clock(7400)).toBe('0:07')
    expect(clock(65000)).toBe('1:05')
  })
})

describe('cómo se graba una toma', () => {
  it('a 32 kbps, en Opus donde el navegador lo tiene; si no, en lo que tenga, a la misma tasa', () => {
    expect(recorderOptions((t) => t.startsWith('audio/webm'))).toEqual({ audioBitsPerSecond: 32000, mimeType: 'audio/webm;codecs=opus' })
    // Safari records AAC in MP4.
    expect(recorderOptions((t) => t === 'audio/mp4')).toEqual({ audioBitsPerSecond: 32000, mimeType: 'audio/mp4' })
    expect(recorderOptions(() => false)).toEqual({ audioBitsPerSecond: 32000 })
  })
})
