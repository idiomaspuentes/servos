import { describe, expect, it } from 'vitest'
import { articleOf, rcLinksIn } from '../../resources/articleLinks'
import { withoutArticleLinks } from './Markdown'

const JONAH = 'Cuenta cómo los ninivitas clamaron a Jehová. (Ver: [[rc://*/tw/dict/bible/kt/grace]], [[rc://*/tw/dict/bible/kt/mercy]], [[rc://*/tw/dict/bible/kt/repent]])'

describe('los enlaces a artículos de un texto', () => {
  it('dice a qué artículo apunta cada uno', () => {
    expect(articleOf('rc://*/tw/dict/bible/kt/grace')).toEqual({ kind: 'tw', path: 'bible/kt/grace' })
    expect(articleOf('rc://*/ta/man/translate/translate-names')).toEqual({ kind: 'ta', path: 'translate/translate-names' })
    expect(articleOf('rc://*/tn/help/jon/01/03')).toBeNull()
    expect(rcLinksIn(JONAH)).toHaveLength(3)
  })

  it('sin quien los ofrezca, «(Ver: …)» se va entero, también con varios (antes quedaba «(Ver: , , )»)', () => {
    expect(withoutArticleLinks(JONAH)).toBe('Cuenta cómo los ninivitas clamaron a Jehová.')
  })

  it('se quedan los que hay en el aparato y se va el resto', () => {
    const here = (rc: string) => !rc.endsWith('/repent')
    expect(withoutArticleLinks(JONAH, here)).toBe(
      'Cuenta cómo los ninivitas clamaron a Jehová. (Ver: [[rc://*/tw/dict/bible/kt/grace]], [[rc://*/tw/dict/bible/kt/mercy]])'
    )
  })

  it('una nota con un solo artículo queda como antes', () => {
    expect(withoutArticleLinks('Es una metáfora. (Ver: [[rc://*/ta/man/translate/figs-metaphor]])')).toBe('Es una metáfora.')
  })
})
