/**
 * Mini apps listed so the steps show how they will look, but not openable yet. Each is plain data through the same
 * contract, which is the point: a step can have several, and a project can swap one for another.
 */

import type { BaseLanguage, Texts } from '../i18n/i18n'
import type { Phase } from '../projects/model'
import type { MiniApp, ResourceNeed } from './contract'

function soon(
  id: string,
  phase: Phase,
  needs: ResourceNeed[],
  texts: Record<BaseLanguage, Texts & { nombre: string; descripcion: string }>,
  checks?: string
): MiniApp {
  return { id, phase, needs, unit: 'verse', helps: true, writes: false, comingSoon: true, Center: () => null, texts, ...(checks ? { checks } : {}) }
}

export const editorVoz = soon('editorVoz', 'traduccion', ['text'], {
  es: { nombre: 'Traducir de viva voz', descripcion: 'Decir cada versículo en su idioma y grabarlo, en lugar de escribirlo' },
  pt: { nombre: 'Traduzir em voz alta', descripcion: 'Dizer cada versículo no seu idioma e gravá-lo, em vez de escrevê-lo' },
  en: { nombre: 'Translate by voice', descripcion: 'Say each verse in your language and record it, instead of writing it' },
})

export const revisorPalabras = soon(
  'revisorPalabras',
  'revision',
  ['text', 'words'],
  {
    es: { nombre: 'Revisar las palabras clave', descripcion: 'Ver cómo se tradujo cada palabra clave, en todo el libro', queRevisa: 'Palabras clave' },
    pt: { nombre: 'Revisar as palavras-chave', descripcion: 'Ver como cada palavra-chave foi traduzida, em todo o livro', queRevisa: 'Palavras-chave' },
    en: { nombre: 'Check the key words', descripcion: 'See how each key word was translated, across the book', queRevisa: 'Key words' },
  },
  'revisorPalabras.queRevisa'
)

export const revisorAlineacion = soon(
  'revisorAlineacion',
  'revision',
  ['text'],
  {
    es: { nombre: 'Alinear con el original', descripcion: 'Unir cada palabra de la traducción con la del griego o el hebreo', queRevisa: 'Alineación' },
    pt: { nombre: 'Alinhar com o original', descripcion: 'Ligar cada palavra da tradução à do grego ou do hebraico', queRevisa: 'Alinhamento' },
    en: { nombre: 'Align with the original', descripcion: 'Link each word of the translation to the Greek or Hebrew', queRevisa: 'Alignment' },
  },
  'revisorAlineacion.queRevisa'
)

export const comunitaria = soon('comunitaria', 'comunitaria', ['text'], {
  es: { nombre: 'Lectura con la comunidad', descripcion: 'Leer el libro en voz alta con otras personas y anotar lo que no se entiende' },
  pt: { nombre: 'Leitura com a comunidade', descripcion: 'Ler o livro em voz alta com outras pessoas e anotar o que não se entende' },
  en: { nombre: 'Reading with the community', descripcion: 'Read the book aloud with others and note what is not understood' },
})

export const publicar = soon('publicar', 'publicacion', ['text'], {
  es: { nombre: 'Publicar en Door43', descripcion: 'Revisar que el libro esté completo y subirlo' },
  pt: { nombre: 'Publicar no Door43', descripcion: 'Verificar se o livro está completo e enviá-lo' },
  en: { nombre: 'Publish on Door43', descripcion: 'Check that the book is complete and upload it' },
})
