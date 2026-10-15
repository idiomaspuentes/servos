/**
 * Estudio: read the passage with its helps before translating. The open verse fills the center; its helps sit right
 * under it (the frame's panel), and the words a help is about are marked in the verse.
 */

import { VerseText } from '../../frame/VerseText'
import type { MiniApp, MiniAppCenterProps } from '../contract'

function Center({ context }: MiniAppCenterProps) {
  const { position, verseText, marked, t, textAbbreviation } = context
  return (
    <section className="center" aria-label={t('estudio.nombre')}>
      <p className="center-label">{t('estudio.textoPuente', { texto: textAbbreviation })}</p>
      <VerseText verse={position.verse} text={verseText(position.verse)} marked={marked} />
    </section>
  )
}

const lastVerse = (c: Parameters<NonNullable<MiniApp['primary']>['run']>[0]) =>
  c.data.verses[c.data.verses.length - 1]?.verse ?? c.position.verse

export const estudio: MiniApp = {
  id: 'estudio',
  needs: ['text', 'notes', 'questions', 'words', 'academy'],
  unit: 'verse',
  helps: true,
  writes: false,
  Center,
  primary: {
    label: 'estudio.siguiente',
    run: (c) => c.goTo({ ...c.position, verse: Math.min(c.position.verse + 1, lastVerse(c)) }),
  },
  more: [
    { label: 'estudio.cambiarTexto', description: 'estudio.cambiarTextoAyuda', run: (c) => c.frame.switchText() },
    { label: 'estudio.leerCapitulo', description: 'estudio.leerCapituloAyuda', run: (c) => c.frame.showChapter() },
  ],
  texts: {
    es: {
      nombre: 'Estudio',
      descripcion: 'Leer el pasaje con sus notas, preguntas y palabras clave antes de traducir',
      siguiente: 'Siguiente versículo',
      textoPuente: 'Texto puente: {texto}',
      cambiarTexto: 'Cambiar el texto puente',
      cambiarTextoAyuda: 'Ver el versículo en el otro texto puente',
      leerCapitulo: 'Leer el capítulo entero',
      leerCapituloAyuda: 'Todo el capítulo seguido, sin ayudas',
    },
    pt: {
      nombre: 'Estudo',
      descripcion: 'Ler a passagem com suas notas, perguntas e palavras-chave antes de traduzir',
      siguiente: 'Próximo versículo',
      textoPuente: 'Texto ponte: {texto}',
      cambiarTexto: 'Trocar o texto ponte',
      cambiarTextoAyuda: 'Ver o versículo no outro texto ponte',
      leerCapitulo: 'Ler o capítulo inteiro',
      leerCapituloAyuda: 'Todo o capítulo seguido, sem ajudas',
    },
    en: {
      nombre: 'Study',
      descripcion: 'Read the passage with its notes, questions, and key words before translating',
      siguiente: 'Next verse',
      textoPuente: 'Bridge text: {texto}',
      cambiarTexto: 'Change the bridge text',
      cambiarTextoAyuda: 'See the verse in the other bridge text',
      leerCapitulo: 'Read the whole chapter',
      leerCapituloAyuda: 'The whole chapter in a row, without helps',
    },
  },
}
