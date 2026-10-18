import { beforeEach, expect, it } from 'vitest'
import { EXAMPLE_PROJECT_ID, loadProjects } from './model'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
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

it('un proyecto guardado a medias se deja fuera, y los demás se abren: la app no se detiene por uno', () => {
  const whole = { id: 'kichwa', name: 'Biblia en kichwa', books: [{ code: 'jon', phase: 'traduccion' }], miniApps: {} }
  store.set('servos.prototipo.proyectos', JSON.stringify([whole, { id: 'roto', name: 'Roto', books: null, miniApps: {} }, null, 'x']))
  expect(loadProjects().map((p) => p.id)).toEqual(['kichwa'])
})

it('la primera vez no hay proyectos: el ejemplo llega solo cuando alguien pide verlo', () => {
  expect(loadProjects()).toEqual([])
})

it('quien ya había empezado antes de esta versión conserva el ejemplo, que antes estaba sin guardarse', () => {
  store.set('servos.prototipo.personas', JSON.stringify({ names: ['Ana', 'Bea', 'Carlos'], current: 'Ana' }))
  expect(loadProjects().map((p) => p.id)).toEqual([EXAMPLE_PROJECT_ID])
})

it('quien empezó con su nombre y no tiene proyectos no ve el ejemplo al volver', () => {
  store.set('servos.prototipo.personas', JSON.stringify({ names: ['Rosa'], current: 'Rosa' }))
  store.set('servos.prototipo.proyectos', '[]')
  expect(loadProjects()).toEqual([])
})
