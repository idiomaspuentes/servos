import { beforeEach, describe, expect, it } from 'vitest'
import type { VerseHelps } from '../../resources/reading'
import { changeAt, changedVerses, compareHelps, keepChanges, noteChangedAt, seeChange, type NoteChange } from './helpsChanges'
import { readCheck, stateOf, writeCheck } from './noteChecks'
import { inProject } from './scope'

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

const verse = (v: number, notes: Array<[string, string, string?]>, literal = 'Jonás oró', simple = 'Jonás le habló a Dios'): VerseHelps => ({
  chapter: 2,
  verse: v,
  notes: notes.map(([id, note, quote = 'q']) => ({ id, note, quote })),
  literal,
  simple,
})

describe('qué cambió en las ayudas de lo ya traducido', () => {
  it('dice la nota nueva, la cambiada con lo que decía, la quitada, y el texto que cambió', () => {
    const before = [verse(1, [['a', 'Una metáfora'], ['b', 'Un nombre']]), verse(2, [['c', 'Igual']])]
    const after = [verse(1, [['a', 'Una metáfora del mar'], ['d', 'Nueva']], 'Jonás oró a Yahvé'), verse(2, [['c', 'Igual']])]
    expect(compareHelps(before, after, 'T1')).toEqual([
      {
        chapter: 2,
        verse: 1,
        at: 'T1',
        notes: [
          { id: 'a', kind: 'cambiada', quote: 'q', before: 'Una metáfora' },
          { id: 'd', kind: 'nueva', quote: 'q' },
          { id: 'b', kind: 'quitada', quote: 'q', before: 'Un nombre' },
        ],
        texts: [{ text: 'literal', before: 'Jonás oró' }],
      },
    ])
  })

  it('una nota cuya cita cambió también cambió; los espacios de más no son un cambio', () => {
    const before = [verse(1, [['a', 'Una  metáfora', 'קָרָא']], 'Jonás  oró')]
    const after = [verse(1, [['a', 'Una metáfora', 'וַיִּקְרָא']], 'Jonás oró')]
    expect(compareHelps(before, after, 'T1')[0].notes).toEqual([{ id: 'a', kind: 'cambiada', quote: 'וַיִּקְרָא', before: 'Una  metáfora' }])
    expect(compareHelps([verse(1, [['a', 'x']])], [verse(1, [['a', ' x ']])], 'T1')).toEqual([])
  })

  it('cambió el texto simple', () => {
    expect(compareHelps([verse(1, [])], [verse(1, [], 'Jonás oró', 'Jonás oró a Dios')], 'T1')[0].texts).toEqual([{ text: 'simple', before: 'Jonás le habló a Dios' }])
  })

  it('un versículo que la versión nueva no tiene no se dice', () => {
    expect(compareHelps([verse(9, [['a', 'x']])], [], 'T1')).toEqual([])
  })
})

describe('lo que cambió se guarda por proyecto y libro', () => {
  const change = (v: number, at: string, notes: NoteChange[] = [{ id: 'a', kind: 'cambiada', quote: 'q', before: 'antes' }]) => ({ chapter: 2, verse: v, at, notes, texts: [] })

  it('cada proyecto ve los suyos, en orden, hasta que se marcan vistos', () => {
    inProject('kichwa', () => keepChanges('jon', [change(5, 'T1'), change(3, 'T1')]))
    expect(inProject('quechua', () => changedVerses('jon'))).toEqual([])
    inProject('kichwa', () => {
      expect(changedVerses('jon').map((c) => c.verse)).toEqual([3, 5])
      expect(changeAt('jon', 2, 3)?.notes[0].before).toBe('antes')
      seeChange('jon', 2, 3)
      expect(changeAt('jon', 2, 3)).toBeNull()
      expect(changedVerses('jon', 2).map((c) => c.verse)).toEqual([5])
    })
  })

  it('un paquete después de otro: la nota guarda lo que decía primero; nueva y luego quitada no queda', () => {
    inProject('kichwa', () => {
      keepChanges('jon', [change(3, 'T1', [{ id: 'a', kind: 'cambiada', quote: 'q', before: 'primero' }, { id: 'b', kind: 'nueva', quote: 'q' }])])
      keepChanges('jon', [change(3, 'T2', [{ id: 'a', kind: 'cambiada', quote: 'q', before: 'segundo' }, { id: 'b', kind: 'quitada', quote: 'q', before: 'x' }])])
      const c = changeAt('jon', 2, 3)!
      expect(c.at).toBe('T2')
      expect(c.notes).toEqual([{ id: 'a', kind: 'cambiada', quote: 'q', before: 'primero' }])
    })
  })

  it('una revisión hecha antes de que su nota cambiara vuelve a quedar por hacer', () => {
    inProject('kichwa', () => {
      const check = { status: 'bien' as const, words: [0], verseText: 'Jonás oró', by: 'Ana', at: '2026-10-01T00:00:00.000Z' }
      writeCheck('jon', 'a', check)
      writeCheck('jon', 'z', check)
      expect(stateOf(readCheck('jon', 'a'), 'Jonás oró')).toBe('bien')
      keepChanges('jon', [change(3, '2026-10-19T00:00:00.000Z')])
      // Seen or not: the answer was to another note.
      seeChange('jon', 2, 3)
      expect(noteChangedAt('jon', 'a')).toBe('2026-10-19T00:00:00.000Z')
      expect(stateOf(readCheck('jon', 'a'), 'Jonás oró')).toBe('cambio')
      expect(stateOf(readCheck('jon', 'z'), 'Jonás oró')).toBe('bien')
      // Words checks are not about notes.
      writeCheck('jon', 'a', check, 'revisionPalabra')
      expect(stateOf(readCheck('jon', 'a', 'revisionPalabra'), 'Jonás oró')).toBe('bien')
      // Answered again after the change, it stands; what is kept does not carry the read-back mark.
      writeCheck('jon', 'a', { ...readCheck('jon', 'a')!, at: '2026-10-20T00:00:00.000Z' })
      expect(stateOf(readCheck('jon', 'a'), 'Jonás oró')).toBe('bien')
      expect(localStorage.getItem('servos.prototipo.revisionNota.jon~kichwa.a')).not.toContain('noteChanged')
    })
  })
})
