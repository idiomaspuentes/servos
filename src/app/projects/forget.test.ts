import { beforeEach, describe, expect, it } from 'vitest'
import { forgetProject, keysOfProject } from './forget'
import { ask, waiting } from './outbox'
import { addTake, takeIdsWhere } from './recordings'
import { inProject } from './scope'
import { activeProjects, archivedProjects } from './model'

let store: Map<string, string>
beforeEach(() => {
  store = new Map<string, string>()
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

describe('what belongs to a project', () => {
  const keys = [
    'servos.libro.jon~kichwa',
    'servos.saliendo.tit~kichwa',
    'servos.prototipo.alineacion.jon~kichwa.1.2',
    'servos.prototipo.posicion.Ana.jon~kichwa.editor',
    'servos.prototipo.grabacion.jon~kichwa.1.1',
    'servos.prototipo.glosario.kichwa.G5485',
    'servos.prototipo.glosarioCompartido.kichwa',
    'servos.prototipo.door43.destino.kichwa',
    'servos.prototipo.door43.subido.kichwa.jon',
    'servos.prototipo.door43.visto.kichwa.jon',
    'servos.prototipo.sugerencia.nombre.kichwa.jon',
    'servos.copias.huella.kichwa',
  ]
  const others = [
    // Another project whose id ends the same way, or begins the same way.
    'servos.libro.jon~biblia-kichwa',
    'servos.prototipo.alineacion.jon~kichwa-cusco.1.2',
    'servos.prototipo.glosario.kichwa-cusco.G5485',
    'servos.prototipo.door43.destino.kichwa-cusco',
    // What is the device's, or a person's.
    'servos.prototipo.proyectos',
    'servos.prototipo.door43.cuenta.Ana',
    'servos.copias',
    'servos.interfaz',
  ]

  it('is every key of its books and every key kept by its id, and nothing of another project', () => {
    expect(keysOfProject('kichwa', [...keys, ...others]).sort()).toEqual([...keys].sort())
  })
})

describe('deleting a project from the device', () => {
  it('forgets what was kept for it and leaves another project’s work', async () => {
    for (const k of ['servos.prototipo.alineacion.jon~kichwa.1.2', 'servos.prototipo.glosario.kichwa.G5485', 'servos.prototipo.door43.destino.kichwa'])
      store.set(k, '{}')
    store.set('servos.prototipo.alineacion.jon~otro.1.2', '{}')
    inProject('kichwa', () => addTake('jon', 1, 1, { by: 'Ana', at: '', ms: 1, mime: '' }, 'mia'))
    inProject('otro', () => addTake('jon', 1, 1, { by: 'Bea', at: '', ms: 1, mime: '' }, 'suya'))
    ask({ kind: 'subir', projectId: 'kichwa', person: 'Ana' })
    ask({ kind: 'subir', projectId: 'otro', person: 'Ana' })

    await forgetProject('kichwa')

    expect([...store.keys()].filter((k) => k.includes('kichwa'))).toEqual([])
    expect(store.has('servos.prototipo.alineacion.jon~otro.1.2')).toBe(true)
    expect(takeIdsWhere((b) => b.endsWith('~otro'))).toEqual(new Set(['suya']))
    expect(waiting().map((e) => e.projectId)).toEqual(['otro'])
  })
})

describe('the archive', () => {
  it('keeps archived projects apart, the last archived first', () => {
    const ps = [
      { id: 'a', archived: '2026-10-01T00:00:00Z' },
      { id: 'b' },
      { id: 'c', archived: '2026-10-20T00:00:00Z' },
    ]
    expect(activeProjects(ps).map((p) => p.id)).toEqual(['b'])
    expect(archivedProjects(ps).map((p) => p.id)).toEqual(['c', 'a'])
  })
})
