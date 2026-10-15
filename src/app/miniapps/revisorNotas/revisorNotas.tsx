/**
 * Checking with the notes: for each verse, the person's translation beside the bridge text, the notes underneath,
 * and a decision, as translationCore 4's checking (`src/views/Check.jsx`, CheckDetail): it is right, it needs
 * changes, or it is pending. Deciding does not move on by itself; the filled button does. In the prototype the
 * decisions stay in this browser.
 */

import { useEffect, useState } from 'react'
import { VerseText } from '../../frame/VerseText'
import type { MiniApp, MiniAppCenterProps } from '../contract'

type Decision = 'bien' | 'cambiar' | 'pendiente'

const key = (book: string, chapter: number, verse: number) => `servos.prototipo.revision.notas.${book}.${chapter}.${verse}`
const draftKey = (book: string, chapter: number, verse: number) => `servos.prototipo.borrador.${book}.${chapter}.${verse}`

function read(k: string): string {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

function Center({ context }: MiniAppCenterProps) {
  const { position, verseText, marked, t, textAbbreviation } = context
  const k = key(position.book, position.chapter, position.verse)
  const [decision, setDecision] = useState<Decision | ''>(() => read(k) as Decision | '')
  useEffect(() => setDecision(read(k) as Decision | ''), [k])
  const translation = read(draftKey(position.book, position.chapter, position.verse))

  const decide = (d: Decision) => {
    setDecision(d)
    try {
      localStorage.setItem(k, d)
    } catch {
      /* stays on screen */
    }
  }

  return (
    <section className="center" aria-label={t('revisorNotas.nombre')}>
      <p className="center-label">{t('revisorNotas.suTraduccion')}</p>
      {translation ? (
        <p className="verse verse-small translation">{translation}</p>
      ) : (
        <p className="notice">{t('revisorNotas.sinTraducir')}</p>
      )}
      <p className="center-label">{t('revisorNotas.textoPuente', { texto: textAbbreviation })}</p>
      <VerseText verse={position.verse} text={verseText(position.verse)} marked={marked} size="small" />
      <p className="center-label">{t('revisorNotas.pregunta')}</p>
      <div className="decisions" role="group" aria-label={t('revisorNotas.pregunta')}>
        {(['bien', 'cambiar', 'pendiente'] as const).map((d) => (
          <button key={d} type="button" className={decision === d ? `decision is-${d}` : 'decision'} aria-pressed={decision === d} onClick={() => decide(d)}>
            {t(`revisorNotas.${d}`)}
          </button>
        ))}
      </div>
    </section>
  )
}

export const revisorNotas: MiniApp = {
  id: 'revisorNotas',
  phase: 'revision',
  checks: 'revisorNotas.queRevisa',
  needs: ['text', 'notes'],
  unit: 'verse',
  helps: true,
  writes: true,
  Center,
  primary: {
    label: 'revisorNotas.siguiente',
    run: (c) => c.frame.next(),
  },
  more: [{ label: 'revisorNotas.leerCapitulo', description: 'revisorNotas.leerCapituloAyuda', run: (c) => c.frame.showChapter() }],
  texts: {
    es: {
      nombre: 'Revisar con las notas',
      descripcion: 'Comparar cada versículo traducido con lo que dicen las notas',
      queRevisa: 'Notas',
      suTraduccion: 'La traducción',
      sinTraducir: 'Este versículo todavía no está traducido.',
      textoPuente: 'Texto puente: {texto}',
      pregunta: '¿La traducción dice lo que explican las notas?',
      bien: 'Está bien',
      cambiar: 'Hay que cambiarla',
      pendiente: 'Lo veo después',
      siguiente: 'Siguiente versículo',
      leerCapitulo: 'Leer el capítulo entero',
      leerCapituloAyuda: 'Todo el capítulo seguido, sin ayudas',
    },
    pt: {
      nombre: 'Revisar com as notas',
      descripcion: 'Comparar cada versículo traduzido com o que as notas dizem',
      queRevisa: 'Notas',
      suTraduccion: 'A tradução',
      sinTraducir: 'Este versículo ainda não foi traduzido.',
      textoPuente: 'Texto ponte: {texto}',
      pregunta: 'A tradução diz o que as notas explicam?',
      bien: 'Está bem',
      cambiar: 'Precisa mudar',
      pendiente: 'Vejo depois',
      siguiente: 'Próximo versículo',
      leerCapitulo: 'Ler o capítulo inteiro',
      leerCapituloAyuda: 'Todo o capítulo seguido, sem ajudas',
    },
    en: {
      nombre: 'Check with the notes',
      descripcion: 'Compare each translated verse with what the notes say',
      queRevisa: 'Notes',
      suTraduccion: 'The translation',
      sinTraducir: 'This verse is not translated yet.',
      textoPuente: 'Bridge text: {texto}',
      pregunta: 'Does the translation say what the notes explain?',
      bien: 'It is right',
      cambiar: 'It needs changes',
      pendiente: 'Later',
      siguiente: 'Next verse',
      leerCapitulo: 'Read the whole chapter',
      leerCapituloAyuda: 'The whole chapter in a row, without helps',
    },
  },
}

/** How many verses of the chapter have a decision, for the book screen. */
export function notesCheckedCount(book: string, chapter: number, verses: number[]): number {
  return verses.filter((v) => read(key(book, chapter, v))).length
}
