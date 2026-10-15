import { beforeEach, describe, expect, it } from 'vitest'
import { authorOf, chooseVersion, otherVersion, readDraft, receiveWork, workOf, writeDraft } from './work'

// The prototype keeps the work in localStorage; the tests run without a browser.
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

describe('juntar el trabajo de varias computadoras', () => {
  it('cada versículo recuerda quién lo escribió, y el capítulo suma por persona', () => {
    writeDraft('jon', 1, 1, 'Ana escribió', 'Ana')
    writeDraft('jon', 1, 2, 'Bea escribió', 'Bea')
    writeDraft('jon', 1, 3, 'Ana otra vez', 'Ana')
    expect(authorOf('jon', 1, 2)).toBe('Bea')
    expect(workOf('jon', 1, [1, 2, 3, 4])).toEqual({ written: 3, total: 4, people: [['Ana', 2], ['Bea', 1]], choices: 0 })
  })

  it('un versículo vacío aquí toma lo recibido; uno igual no cambia; uno distinto guarda las dos versiones', () => {
    writeDraft('jon', 3, 2, 'lo mismo', 'Ana')
    writeDraft('jon', 3, 3, 'lo de Ana', 'Ana')
    const result = receiveWork({
      from: 'Bea',
      book: 'jon',
      label: 'Jonás 3:1–3',
      verses: [
        { chapter: 3, verse: 1, text: 'nuevo de Bea' },
        { chapter: 3, verse: 2, text: 'lo mismo' },
        { chapter: 3, verse: 3, text: 'lo de Bea' },
      ],
    })
    expect(result).toEqual({ taken: 1, same: 1, choices: 1 })
    expect([readDraft('jon', 3, 1), authorOf('jon', 3, 1)]).toEqual(['nuevo de Bea', 'Bea'])
    // Nothing written here is overwritten without a choice.
    expect(readDraft('jon', 3, 3)).toBe('lo de Ana')
    expect(otherVersion('jon', 3, 3)).toEqual({ text: 'lo de Bea', by: 'Bea' })
    expect(workOf('jon', 3, [1, 2, 3]).choices).toBe(1)
  })

  it('elegir la otra versión la deja como el versículo, con su autor; elegir la propia la descarta', () => {
    writeDraft('jon', 4, 1, 'de Ana', 'Ana')
    writeDraft('jon', 4, 2, 'de Ana', 'Ana')
    receiveWork({ from: 'Carlos', book: 'jon', label: 'Jonás 4:1–2', verses: [1, 2].map((verse) => ({ chapter: 4, verse, text: 'de Carlos' })) })
    chooseVersion('jon', 4, 1, true)
    chooseVersion('jon', 4, 2, false)
    expect([readDraft('jon', 4, 1), authorOf('jon', 4, 1)]).toEqual(['de Carlos', 'Carlos'])
    expect([readDraft('jon', 4, 2), authorOf('jon', 4, 2)]).toEqual(['de Ana', 'Ana'])
    expect([otherVersion('jon', 4, 1), otherVersion('jon', 4, 2)]).toEqual([null, null])
  })
})
