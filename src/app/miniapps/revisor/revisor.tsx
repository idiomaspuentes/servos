/** Revisor de desafíos: listed so the catalog shows how a mini app that is not ready yet looks. */

import type { MiniApp } from '../contract'

export const revisor: MiniApp = {
  id: 'revisor',
  needs: ['text', 'notes'],
  unit: 'verse',
  helps: true,
  writes: false,
  comingSoon: true,
  Center: () => null,
  texts: {
    es: { nombre: 'Revisor de desafíos', descripcion: 'Revisar si la traducción es fiel, clara, natural y precisa' },
    pt: { nombre: 'Revisor de desafios', descripcion: 'Revisar se a tradução é fiel, clara, natural e precisa' },
    en: { nombre: 'Challenge checker', descripcion: 'Check that the translation is faithful, clear, natural, and accurate' },
  },
}
