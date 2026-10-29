import { describe, expect, it } from 'vitest'
import { problemOf } from '../projects/door43'
import { NotDoor43, isPinned } from './door43Pins'

describe("Door43's certificate, checked in the app for phones", () => {
  it('is checked for Door43 and its sub-domains over https, and for nothing else', () => {
    expect(isPinned('https://git.door43.org/api/v1/user')).toBe(true)
    expect(isPinned('https://qa.door43.org/attachments/x')).toBe(true)
    expect(isPinned('https://door43.org/')).toBe(true)
    expect(isPinned('http://localhost:8787/api/v1/user')).toBe(false)
    expect(isPinned('https://door43.org.example.com/')).toBe(false)
    expect(isPinned('https://notdoor43.org/')).toBe(false)
  })

  it('says, when another certificate was presented, that nothing went: not that there was no internet', () => {
    expect(problemOf(new NotDoor43('git.door43.org'))).toBe('pin')
    expect(problemOf(new TypeError('Failed to fetch'))).toBe('offline')
  })
})
