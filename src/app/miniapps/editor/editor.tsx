/**
 * Editor: write the verse in the language of the project, a line to a field as the text translated from sets it
 * (`LineFields`). On a phone the box and the texts to read are panes side by side: a finger slides to the bridge
 * texts, the original or the helps and back, and the keyboard stays up all the while. A word touched in any of them
 * brings its notes and translation words under its verse (`TouchWords`). In the prototype a draft is
 * kept in this browser only; wired, every change goes to the journal (design, section 6).
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { Panes, type Pane } from '../../frame/Panes'
import { helpsOfWord, litPlaces, WordHelpCard, WordLines, type Touched } from '../../frame/TouchWords'
import type { MiniApp, MiniAppCenterProps } from '../contract'
import { ChapterLines } from './ChapterLines'
import { LineFields, lineFieldId } from './LineFields'

const draftKey = (book: string, chapter: number, verse: number) => `servos.prototipo.borrador.${book}.${chapter}.${verse}`

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

/** Lines of a poem (`\q`, `\q1`, `\q2`…), not the poem's headings or notes (`\qa`, `\qd`…). */
const isPoemLine = (marker: string) => /^q\d?$|^qm\d?$/.test(marker)

function Center({ context }: MiniAppCenterProps) {
  const { position, marked, t, data, textAbbreviation, frame } = context
  const key = draftKey(position.book, position.chapter, position.verse)
  const [text, setText] = useState(() => readDraft(key))
  const [shownKey, setShownKey] = useState(key)
  const [touched, setTouched] = useState<Touched | null>(null)
  // Whether the person opened the helps pane in this verse: only then does the note open there light its words.
  const [helpsRead, setHelpsRead] = useState(false)
  if (shownKey !== key) {
    setShownKey(key)
    setText(readDraft(key))
    setTouched(null)
    setHelpsRead(false)
  }

  // Going to another verse while writing: the cursor goes to its first line, and the keyboard stays up.
  const writing = useRef(false)
  const stopWriting = useRef<number>()
  const fieldsId = `editor-v${position.verse}`
  useLayoutEffect(() => {
    if (!writing.current) return
    const box = document.getElementById(lineFieldId(fieldsId, 0)) as HTMLTextAreaElement | null
    box?.focus()
    box?.setSelectionRange(box.value.length, box.value.length)
  }, [fieldsId])

  const bridge = data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts[0]
  const source = bridge.lines[position.verse] ?? []
  const markers = source.map((l) => l.marker)
  const poem = markers.some(isPoemLine)

  // Without a touched word, the note read in the helps pane lights its words (`marked` is its quote in the bridge text).
  const openNote = marked && helpsRead ? data.verses.find((v) => v.verse === position.verse)?.notes.find((n) => (bridge.abbreviation === 'TPS' ? n.gst : n.glt) === marked) : undefined
  const lit = (abbreviation: string) => (touched ? litPlaces(touched, abbreviation) : new Set(openNote?.places[abbreviation] ?? []))
  const touch = (abbreviation: string, verse: number, place: number) =>
    setTouched((now) =>
      now && now.abbreviation === abbreviation && now.place === place ? null : { abbreviation, verse, place, helps: helpsOfWord(data, abbreviation, place), index: 0 }
    )
  const card = (abbreviation: string, verse: number) =>
    touched && touched.abbreviation === abbreviation && touched.verse === verse ? (
      <WordHelpCard data={data} touched={touched} onIndex={(index) => setTouched({ ...touched, index })} onClose={() => setTouched(null)} />
    ) : null
  const hint = t('editor.toquePalabra')

  const write = (value: string) => {
    setText(value)
    frame.setSaved('guardado')
    try {
      localStorage.setItem(key, value)
    } catch {
      /* the draft stays on screen */
    }
  }

  const own = (
    <div className="edit-pane">
      <div className="edit-source" aria-label={t('editor.textoPuente', { texto: bridge.abbreviation })}>
        <span className="edit-source-label">
          {bridge.abbreviation} · {hint}
        </span>
        <WordLines lines={source} verse={position.verse} lit={lit(bridge.abbreviation)} onWord={(place) => touch(bridge.abbreviation, position.verse, place)} />
      </div>
      {card(bridge.abbreviation, position.verse)}
      <div
        onFocus={() => {
          window.clearTimeout(stopWriting.current)
          writing.current = true
        }}
        onBlur={() => {
          // Later, not now: moving to another verse takes the focused field away for a moment.
          stopWriting.current = window.setTimeout(() => {
            writing.current = document.activeElement instanceof HTMLTextAreaElement
          }, 0)
        }}
      >
        <LineFields
          key={fieldsId}
          id={fieldsId}
          text={text}
          markers={markers}
          poem={poem}
          label={t('editor.suVersiculo', { v: position.verse })}
          placeholder={(line) => (poem ? t('editor.renglon', { n: line }) : t('editor.cajaVacia'))}
          addLabel={t('editor.otroRenglon')}
          onChange={write}
        />
      </div>
      {poem && <p className="edit-hint">{t('editor.comoRenglones')}</p>}
    </div>
  )

  const panes: Pane[] = [
    { id: 'suyo', label: t('editor.panelSuyo'), content: own },
    ...data.texts.map((x) => ({
      id: x.abbreviation,
      label: x.original ? t(`editor.lengua.${x.lang ?? 'original'}`) : x.abbreviation,
      content: (
        <ChapterLines
          text={x}
          verse={position.verse}
          lit={lit(x.abbreviation)}
          hint={hint}
          onWord={(verse, place) => touch(x.abbreviation, verse, place)}
          under={(verse) => card(x.abbreviation, verse)}
        />
      ),
    })),
    { id: 'ayudas', label: t('editor.panelAyudas'), content: frame.helps() },
  ]

  return <Panes panes={panes} label={t('editor.paneles')} onPane={(id) => id === 'ayudas' && setHelpsRead(true)} />
}

export const editor: MiniApp = {
  id: 'editor',
  needs: ['text', 'notes', 'words'],
  phase: 'traduccion',
  unit: 'verse',
  helps: false,
  fills: true,
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
      renglon: 'Renglón {n}',
      otroRenglon: 'Otro renglón',
      comoRenglones: 'Cada renglón como en el texto puente. Enter empieza otro; borrar al comienzo lo une con el de arriba.',
      paneles: 'Lo que se ve',
      panelSuyo: 'Su traducción',
      panelAyudas: 'Ayudas',
      toquePalabra: 'toque una palabra para ver sus notas',
      'lengua.hbo': 'Hebreo',
      'lengua.grc': 'Griego',
      'lengua.original': 'Original',
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
      renglon: 'Linha {n}',
      otroRenglon: 'Outra linha',
      comoRenglones: 'Cada linha como no texto ponte. Enter começa outra; apagar no começo a junta com a de cima.',
      paneles: 'O que se vê',
      panelSuyo: 'Sua tradução',
      panelAyudas: 'Ajudas',
      toquePalabra: 'toque uma palavra para ver suas notas',
      'lengua.hbo': 'Hebraico',
      'lengua.grc': 'Grego',
      'lengua.original': 'Original',
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
      renglon: 'Line {n}',
      otroRenglon: 'Another line',
      comoRenglones: 'Each line as in the bridge text. Enter starts another; deleting at the start joins it to the one above.',
      paneles: 'What is shown',
      panelSuyo: 'Your translation',
      panelAyudas: 'Helps',
      toquePalabra: 'touch a word to see its notes',
      'lengua.hbo': 'Hebrew',
      'lengua.grc': 'Greek',
      'lengua.original': 'Original',
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
