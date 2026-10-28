import { describe, expect, it } from 'vitest'
import { asOnlineRun, whileOnlineIdle } from './onlineLock'

const opened = () => {
  let open!: () => void
  const gate = new Promise<void>((resolve) => (open = resolve))
  return { gate, open }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('a pack opening and an online run never overlap', () => {
  it('a run in flight delays the opening until it ends', async () => {
    const log: string[] = []
    const apply = opened()
    const run = asOnlineRun(async () => {
      log.push('run starts')
      await apply.gate
      log.push('run ends')
    })
    const pack = whileOnlineIdle(async () => void log.push('pack'))
    await tick()
    expect(log).toEqual(['run starts'])
    apply.open()
    await Promise.all([run, pack])
    expect(log).toEqual(['run starts', 'run ends', 'pack'])
  })

  it('a run started during the opening waits for it, and the opening gives back what fn gives', async () => {
    const log: string[] = []
    const importing = opened()
    const pack = whileOnlineIdle(async () => {
      log.push('pack starts')
      await importing.gate
      log.push('pack ends')
      return 'result'
    })
    await tick()
    const run = asOnlineRun(async () => void log.push('run'))
    await tick()
    expect(log).toEqual(['pack starts'])
    importing.open()
    expect(await pack).toBe('result')
    await run
    expect(log).toEqual(['pack starts', 'pack ends', 'run'])
  })

  it('openings go one after another; a run waiting meanwhile is not starved into a deadlock', async () => {
    const log: string[] = []
    const first = opened()
    const a = whileOnlineIdle(async () => {
      log.push('a')
      await first.gate
    })
    await tick()
    const run = asOnlineRun(async () => void log.push('run'))
    const b = whileOnlineIdle(async () => void log.push('b'))
    await tick()
    expect(log).toEqual(['a'])
    first.open()
    await Promise.all([a, b, run])
    expect(log.slice(0, 1)).toEqual(['a'])
    expect(log.sort()).toEqual(['a', 'b', 'run'])
  })

  it('an opening that throws lets the runs in, and so does a run that throws', async () => {
    await expect(whileOnlineIdle(async () => Promise.reject(new Error('not a pack')))).rejects.toThrow('not a pack')
    await expect(asOnlineRun(async () => 'in')).resolves.toBe('in')
    await expect(asOnlineRun(async () => Promise.reject(new Error('failed')))).rejects.toThrow('failed')
    await expect(whileOnlineIdle(async () => 'opened')).resolves.toBe('opened')
  })
})
