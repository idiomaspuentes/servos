/**
 * Editor: write the verse in the language of the project, a line to a field as the text translated from sets it
 * (`LineFields`), a verse at a time or a section at a time, as the person chooses. The boxes and each text to read
 * are panes side by side, one in sight: a finger slides to the bridge texts, the original or the helps and back, and
 * the keyboard stays up all the while. A word touched in a text brings its notes and translation words under its
 * verse (`TouchWords`). In the prototype a draft is kept in this browser only; wired, every change goes to the
 * journal (design, section 6).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Panes, type Pane } from '../../frame/Panes'
import { helpsOfWord, litPlaces, WordHelpCard, type Touched } from '../../frame/TouchWords'
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

/** What is written of each verse open, read when the verse or section opens. */
function readDrafts(book: string, chapter: number, verses: number[]): Record<number, string> {
  return Object.fromEntries(verses.map((v) => [v, readDraft(draftKey(book, chapter, v))]))
}

function Center({ context }: MiniAppCenterProps) {
  const { position, marked, t, data, textAbbreviation, frame, unit, shown, goTo } = context
  // What is open: the verse, or the verses of its section. Within a section the position follows the verse being
  // written (so the helps are that verse's), and nothing else changes.
  const openKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const [drafts, setDrafts] = useState(() => readDrafts(position.book, position.chapter, shown))
  const [shownKey, setShownKey] = useState(openKey)
  const [touched, setTouched] = useState<Touched | null>(null)
  // The line the cursor is in, by its field's id (`editor-v2`, `editor-v2-l3`): the texts show the same line apart.
  const [writingLine, setWritingLine] = useState<{ verse: number; line: number } | null>(null)
  // Whether the person opened the helps pane here: only then does the note open there light its words.
  const [helpsRead, setHelpsRead] = useState(false)
  if (shownKey !== openKey) {
    setShownKey(openKey)
    setDrafts(readDrafts(position.book, position.chapter, shown))
    setTouched(null)
    setHelpsRead(false)
  }

  // Going on to another verse or section while writing: the cursor goes to its first line, and the keyboard stays up.
  const writing = useRef(false)
  const stopWriting = useRef<number>()
  const fieldsId = (verse: number) => `editor-v${verse}`
  useLayoutEffect(() => {
    if (!writing.current) return
    const box = document.getElementById(lineFieldId(fieldsId(shown[0]), 0)) as HTMLTextAreaElement | null
    box?.focus()
    box?.setSelectionRange(box.value.length, box.value.length)
  }, [openKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the keyboard comes up the box area shrinks under the line being written: it is brought back into sight there.
  useEffect(() => {
    const view = window.visualViewport
    if (!view) return
    const show = () => {
      const box = document.activeElement
      const around = box instanceof HTMLTextAreaElement ? box.closest<HTMLElement>('.edit-fields') : null
      if (!box || !around) return
      const c = around.getBoundingClientRect()
      const r = box.getBoundingClientRect()
      if (r.bottom > c.bottom) around.scrollTop += r.bottom - c.bottom + 4
      else if (r.top < c.top) around.scrollTop -= c.top - r.top + 4
    }
    // After the frame has laid the screen out at its new height.
    let later = 0
    const soon = () => {
      window.clearTimeout(later)
      later = window.setTimeout(show, 80)
    }
    view.addEventListener('resize', soon)
    return () => {
      window.clearTimeout(later)
      view.removeEventListener('resize', soon)
    }
  }, [])

  const bridge = data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts[0]
  const markersOf = (verse: number) => (bridge.lines[verse] ?? []).map((l) => l.marker)
  const anyPoem = shown.some((v) => markersOf(v).some(isPoemLine))

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

  const write = (verse: number, value: string) => {
    setDrafts((now) => ({ ...now, [verse]: value }))
    frame.setSaved('guardado')
    try {
      localStorage.setItem(draftKey(position.book, position.chapter, verse), value)
    } catch {
      /* the draft stays on screen */
    }
  }

  const unitSwitch = (
    <div className="edit-unit" role="radiogroup" aria-label={t('editor.trabajarPor')}>
      {(['verse', 'section'] as const).map((u) => (
        <button key={u} type="button" role="radio" aria-checked={unit === u} className="edit-unit-option" onClick={() => frame.setUnit(u)}>
          {t(u === 'verse' ? 'editor.unVersiculo' : 'editor.unaSeccion')}
        </button>
      ))}
    </div>
  )

  // Only the boxes: the texts to translate from are panes of their own, a swipe away. Both in one pane left each a
  // sliver once the keyboard was up, and the person could not tell the text being written from the one being read.
  const own = (
    <div className="edit-pane">
      {unitSwitch}
      <p className="edit-where">{t('editor.dondeFuente', { texto: bridge.abbreviation })}</p>
      <div
        className="edit-fields"
        onFocus={(event) => {
          window.clearTimeout(stopWriting.current)
          writing.current = true
          const id = event.target.id.match(/^editor-v(\d+)(?:-l(\d+))?$/)
          if (id) setWritingLine({ verse: Number(id[1]), line: id[2] ? Number(id[2]) - 1 : 0 })
        }}
        onBlur={() => {
          // Later, not now: moving to another verse takes the focused field away for a moment.
          stopWriting.current = window.setTimeout(() => {
            writing.current = document.activeElement instanceof HTMLTextAreaElement
          }, 0)
        }}
      >
        {shown.map((v) => {
          const markers = markersOf(v)
          const poem = markers.some(isPoemLine)
          return (
            // In a section each verse keeps its own fields, its number before them: the text is still kept verse by
            // verse, so a section and a verse at a time read and write the same drafts.
            <div
              key={v}
              className={shown.length > 1 ? 'edit-verse in-section' : 'edit-verse'}
              onFocus={() => v !== position.verse && goTo({ ...position, verse: v })}
            >
              {shown.length > 1 && <span className="edit-verse-number" aria-hidden="true">{v}</span>}
              <LineFields
                key={fieldsId(v)}
                id={fieldsId(v)}
                text={drafts[v] ?? ''}
                markers={markers}
                poem={poem}
                label={t('editor.suVersiculo', { v })}
                placeholder={(line) => (poem ? t('editor.renglon', { n: line }) : t('editor.cajaVacia'))}
                addLabel={t('editor.otroRenglon')}
                onChange={(value) => write(v, value)}
              />
            </div>
          )
        })}
        {anyPoem && <p className="edit-hint">{t('editor.comoRenglones')}</p>}
      </div>
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
          shown={shown}
          at={position.verse}
          line={writingLine?.verse === position.verse ? writingLine.line : null}
          lit={lit(x.abbreviation)}
          hint={hint}
          onWord={(verse, place) => touch(x.abbreviation, verse, place)}
          under={(verse) => card(x.abbreviation, verse)}
        />
      ),
    })),
    { id: 'ayudas', label: t('editor.panelAyudas'), content: frame.helps() },
  ]

  return <Panes panes={panes} label={t('editor.paneles')} fixed="suyo" onPane={(id) => id === 'ayudas' && setHelpsRead(true)} />
}

export const editor: MiniApp = {
  id: 'editor',
  needs: ['text', 'notes', 'words'],
  phase: 'traduccion',
  unit: 'verse',
  sections: true,
  helps: false,
  fills: true,
  writes: true,
  Center,
  primary: {
    label: 'editor.guardarSeguir',
    run: (c) => c.frame.next(),
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
      dondeFuente: 'Para leer el {texto}, deslice a la izquierda o toque «{texto}» arriba.',
      suVersiculo: 'Su traducción del versículo {v}',
      cajaVacia: 'Escriba aquí',
      renglon: 'Renglón {n}',
      otroRenglon: 'Otro renglón',
      comoRenglones: 'Cada renglón como en el texto puente. Enter empieza otro; borrar al comienzo lo une con el de arriba.',
      paneles: 'Lo que se ve',
      panelSuyo: 'Su traducción',
      panelAyudas: 'Ayudas',
      trabajarPor: 'Trabajar por',
      unVersiculo: 'Un versículo',
      unaSeccion: 'Una sección',
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
      dondeFuente: 'Para ler o {texto}, deslize para a esquerda ou toque «{texto}» acima.',
      suVersiculo: 'Sua tradução do versículo {v}',
      cajaVacia: 'Escreva aqui',
      renglon: 'Linha {n}',
      otroRenglon: 'Outra linha',
      comoRenglones: 'Cada linha como no texto ponte. Enter começa outra; apagar no começo a junta com a de cima.',
      paneles: 'O que se vê',
      panelSuyo: 'Sua tradução',
      panelAyudas: 'Ajudas',
      trabajarPor: 'Trabalhar por',
      unVersiculo: 'Um versículo',
      unaSeccion: 'Uma seção',
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
      dondeFuente: 'To read the {texto}, swipe left or touch «{texto}» above.',
      suVersiculo: 'Your translation of verse {v}',
      cajaVacia: 'Write here',
      renglon: 'Line {n}',
      otroRenglon: 'Another line',
      comoRenglones: 'Each line as in the bridge text. Enter starts another; deleting at the start joins it to the one above.',
      paneles: 'What is shown',
      panelSuyo: 'Your translation',
      panelAyudas: 'Helps',
      trabajarPor: 'Work by',
      unVersiculo: 'One verse',
      unaSeccion: 'One section',
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
