import { describe, expect, it } from 'vitest'
import en from './en.json'
import es from './es.json'
import pt from './pt.json'

describe("the app's wording about who can see the work", () => {
  // Philosophy, principle 9: some teams need their work kept to themselves, most do not. The app speaks of it only as
  // who can see the work, never of risk or danger or of the Bible being banned, which would frighten the many who do
  // not need it, and would say on the screen of the few what is better left unsaid.
  it('never speaks of risk, danger or a ban, in any language', () => {
    const words = /riesgo|peligr|prohib|arriesg|risco|perig|proib|\brisk|danger|\bban(ned)?\b|forbid/i
    for (const [lang, texts] of Object.entries({ es, pt, en })) {
      const said = Object.entries(texts as Record<string, string>).filter(([, text]) => words.test(text))
      expect(said, lang).toEqual([])
    }
  })
})
