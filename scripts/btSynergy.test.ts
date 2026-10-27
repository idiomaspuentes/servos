import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { btSynergyRoot, checkBtSynergyRef, type Git } from './btSynergy'

const REF = 'e36aa83936dc12f05dc99d252382d4393aa9074f'
const gitAnswering = (answers: Record<string, number>): Git => (args) => ({ status: answers[args.join(' ')] ?? 0, stdout: '' })

describe('dónde está bt-synergy', () => {
  it('usa SERVOS_BT_SYNERGY cuando está, y ../bt-synergy si no', () => {
    expect(btSynergyRoot('C:/r/servos', { SERVOS_BT_SYNERGY: 'C:/wt/bts' })).toBe(resolve('C:/wt/bts'))
    expect(btSynergyRoot('C:/r/servos', {})).toBe(resolve('C:/r/bt-synergy'))
    expect(btSynergyRoot('C:/r/servos', { SERVOS_BT_SYNERGY: '' })).toBe(resolve('C:/r/bt-synergy'))
  })
})

describe('el commit fijado', () => {
  const base = { root: 'C:/wt/bts', ref: REF, exists: () => true }
  it('pasa cuando la carpeta contiene el commit', () => {
    expect(checkBtSynergyRef({ ...base, git: gitAnswering({}) }).state).toBe('contains')
  })
  it('falla cuando va atrás, y dice qué hacer', () => {
    const check = checkBtSynergyRef({ ...base, git: gitAnswering({ [`-C C:/wt/bts merge-base --is-ancestor ${REF} HEAD`]: 1 }) })
    expect(check.state).toBe('behind')
    expect(check.message).toMatch(/SERVOS_BT_SYNERGY/)
    expect(check.message).toContain(REF)
  })
  it('un commit que la carpeta no conoce también es ir atrás', () => {
    const check = checkBtSynergyRef({ ...base, git: gitAnswering({ [`-C C:/wt/bts merge-base --is-ancestor ${REF} HEAD`]: 128 }) })
    expect(check.state).toBe('behind')
  })
  it('una carpeta que no es repositorio git solo avisa', () => {
    const check = checkBtSynergyRef({ ...base, git: gitAnswering({ '-C C:/wt/bts rev-parse --git-dir': 128 }) })
    expect(check.state).toBe('not-git')
  })
  it('una carpeta que no existe falla nombrándola', () => {
    const check = checkBtSynergyRef({ ...base, exists: () => false, git: gitAnswering({}) })
    expect(check.state).toBe('missing')
    expect(check.message).toContain('C:/wt/bts')
  })
})

describe('la carpeta de bt-synergy en uso', () => {
  it('contiene el commit de bt-synergy.ref', () => {
    const here = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const ref = readFileSync(resolve(here, 'bt-synergy.ref'), 'utf8').trim()
    const git: Git = (args) => {
      const r = spawnSync('git', args, { encoding: 'utf8' })
      return { status: r.status ?? 1, stdout: r.stdout ?? '' }
    }
    const check = checkBtSynergyRef({ root: btSynergyRoot(here), ref, exists: existsSync, git })
    if (check.state === 'not-git') console.warn(check.message)
    expect(check.state === 'contains' || check.state === 'not-git', check.message).toBe(true)
  })
})
