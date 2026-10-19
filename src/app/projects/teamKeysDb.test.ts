import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { lock } from './lockedCopy'
import { chooseTeamPassword, forgetTeamKeys, openWithTeamKeys, teamKey } from './teamKeys'

describe("the team's keys in the device's database", () => {
  it('keeps a key that cannot be read out, and opens with it', async () => {
    const own = await chooseTeamPassword('kichwa', 'maíz y frijol', 1000)
    const kept = await teamKey('kichwa')
    expect(kept?.key.extractable).toBe(false)
    expect(await openWithTeamKeys(await lock('obra', own, 'compartido'))).toBe('obra')
    await forgetTeamKeys('kichwa')
    expect(await teamKey('kichwa')).toBeNull()
  })
})
