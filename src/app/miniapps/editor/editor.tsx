/**
 * Editor: write the verse in the language of the project. The bridge text stays glued to the box (philosophy,
 * principle 2), with the words of the open help marked, and the helps under it. In the prototype a draft is kept in
 * this browser only; wired, every change goes to the journal (design, section 6).
 */

import { useEffect, useState } from 'react'
import { VerseText } from '../../frame/VerseText'
import type { MiniApp, MiniAppCenterProps } from '../contract'

const draftKey = (book: string, chapter: number, verse: number) => `servos.prototipo.borrador.${book}.${chapter}.${verse}`

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function Center({ context }: MiniAppCenterProps) {
  const { position, verseText, marked, t, textAbbreviation } = context
  const key = draftKey(position.book, position.chapter, position.verse)
  const [text, setText] = useState(() => readDraft(key))
  useEffect(() => setText(readDraft(key)), [key])

  return (
    <section className="center" aria-label={t('editor.nombre')}>
      <p className="center-label">{t('editor.textoPuente', { texto: textAbbreviation })}</p>
      <VerseText verse={position.verse} text={verseText(position.verse)} marked={marked} size="small" />
      <label className="field">
        <span className="field-label">{t('editor.suVersiculo', { v: position.verse })}</span>
        <textarea
          value={text}
          rows={4}
          onChange={(e) => {
            setText(e.target.value)
            try {
              localStorage.setItem(key, e.target.value)
            } catch {
              /* the draft stays on screen */
            }
          }}
          placeholder={t('editor.cajaVacia')}
        />
      </label>
    </section>
  )
}

export const editor: MiniApp = {
  id: 'editor',
  needs: ['text', 'notes', 'words'],
  phase: 'traduccion',
  unit: 'verse',
  helps: true,
  writes: true,
  Center,
  primary: {
    label: 'editor.guardarSeguir',
    run: (c) => c.goTo({ ...c.position, verse: Math.min(c.position.verse + 1, c.data.verses[c.data.verses.length - 1]?.verse ?? c.position.verse) }),
  },
  more: [
    { label: 'editor.unir', description: 'editor.unirAyuda', run: () => {} },
    { label: 'editor.deshacer', description: 'editor.deshacerAyuda', run: () => {} },
    { label: 'editor.grabar', description: 'editor.grabarAyuda', run: () => {} },
  ],
  texts: {
    es: {
      nombre: 'Editor',
      descripcion: 'Escribir el versículo en su idioma, con el texto puente al lado',
      textoPuente: 'Texto puente: {texto}',
      suVersiculo: 'Su traducción del versículo {v}',
      cajaVacia: 'Escriba aquí',
      guardarSeguir: 'Guardar y seguir',
      unir: 'Unir con el siguiente versículo',
      unirAyuda: 'Cuando su idioma dice los dos versículos en una sola frase',
      deshacer: 'Deshacer',
      deshacerAyuda: 'Volver a como estaba antes del último cambio',
      grabar: 'Grabar en voz',
      grabarAyuda: 'Decir el versículo en lugar de escribirlo (pronto)',
    },
    pt: {
      nombre: 'Editor',
      descripcion: 'Escrever o versículo no seu idioma, com o texto ponte ao lado',
      textoPuente: 'Texto ponte: {texto}',
      suVersiculo: 'Sua tradução do versículo {v}',
      cajaVacia: 'Escreva aqui',
      guardarSeguir: 'Salvar e seguir',
      unir: 'Juntar com o próximo versículo',
      unirAyuda: 'Quando seu idioma diz os dois versículos numa só frase',
      deshacer: 'Desfazer',
      deshacerAyuda: 'Voltar a como estava antes da última mudança',
      grabar: 'Gravar em voz',
      grabarAyuda: 'Dizer o versículo em vez de escrevê-lo (em breve)',
    },
    en: {
      nombre: 'Editor',
      descripcion: 'Write the verse in your language, with the bridge text beside it',
      textoPuente: 'Bridge text: {texto}',
      suVersiculo: 'Your translation of verse {v}',
      cajaVacia: 'Write here',
      guardarSeguir: 'Save and continue',
      unir: 'Join with the next verse',
      unirAyuda: 'When your language says both verses in one sentence',
      deshacer: 'Undo',
      deshacerAyuda: 'Go back to how it was before the last change',
      grabar: 'Record by voice',
      grabarAyuda: 'Say the verse instead of writing it (coming soon)',
    },
  },
}
