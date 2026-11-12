import { beforeEach, describe, expect, it } from 'vitest'
import { issuesReadIn, markIssueRead } from './work'
import { setProject } from './scope'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  setProject('kichwa')
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

describe('the issues read', () => {
  it('keeps each article read once, by book', () => {
    markIssueRead('rut', 'translate/figs-metaphor')
    markIssueRead('rut', 'translate/figs-metaphor')
    markIssueRead('rut', 'translate/figs-activepassive')
    expect(issuesReadIn('rut')).toEqual(['translate/figs-metaphor', 'translate/figs-activepassive'])
    expect(issuesReadIn('jon')).toEqual([])
  })

  it('belongs to the project', () => {
    markIssueRead('rut', 'translate/figs-metaphor')
    setProject('otro')
    expect(issuesReadIn('rut')).toEqual([])
  })
})
