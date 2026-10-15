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
import { glossedPlaces, useWordHelps, type GlossaryTarget } from '../../frame/TouchWords'
import { readGlossaryFor, saveGlossaryEntry } from '../../projects/glossary'
import { GlossarySheet } from './GlossarySheet'
import type { MiniApp, MiniAppCenterProps } from '../contract'
import { authorOf, chooseVersion, otherVersion, readDraft, writeDraft, type OtherVersion } from '../../projects/work'
import { ChapterLines } from '../../frame/ChapterLines'
import { LineFields, lineFieldId } from './LineFields'

/** Lines of a poem (`\q`, `\q1`, `\q2`…), not the poem's headings or notes (`\qa`, `\qd`…). */
const isPoemLine = (marker: string) => /^q\d?$|^qm\d?$/.test(marker)

/** What is written of each verse open, read when the verse or section opens. */
function readDrafts(book: string, chapter: number, verses: number[]): Record<number, string> {
  return Object.fromEntries(verses.map((v) => [v, readDraft(book, chapter, v)]))
}

/** The other versions waiting for a choice among the verses open (received from another computer). */
function readOthers(book: string, chapter: number, verses: number[]): Record<number, OtherVersion | null> {
  return Object.fromEntries(verses.map((v) => [v, otherVersion(book, chapter, v)]))
}

function Center({ context }: MiniAppCenterProps) {
  const { position, marked, t, data, textAbbreviation, frame, shown, goTo } = context
  // What is open: the verse, or the verses of its section. Within a section the position follows the verse being
  // written (so the helps are that verse's), and nothing else changes.
  const openKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const [drafts, setDrafts] = useState(() => readDrafts(position.book, position.chapter, shown))
  const [others, setOthers] = useState(() => readOthers(position.book, position.chapter, shown))
  const [shownKey, setShownKey] = useState(openKey)
  // The line the cursor is in, by its field's id (`editor-v2`, `editor-v2-l3`): the texts show the same line apart.
  const [writingLine, setWritingLine] = useState<{ verse: number; line: number } | null>(null)
  if (shownKey !== openKey) {
    setShownKey(openKey)
    setDrafts(readDrafts(position.book, position.chapter, shown))
    setOthers(readOthers(position.book, position.chapter, shown))
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

  // The project's glossary: a touched word shows the team's decision first, and the translator can add one.
  // Only the entries of this chapter's words are read: one file a word, however big the glossary grows.
  const chapterStrongs = (data.texts.find((x) => x.original)?.words ?? []).map((w) => w.strong)
  const readChapterGlossary = () => readGlossaryFor(context.project.id, chapterStrongs)
  const [glossary, setGlossary] = useState(readChapterGlossary)
  const [glossaryOf, setGlossaryOf] = useState(`${position.book}.${position.chapter}`)
  if (glossaryOf !== `${position.book}.${position.chapter}`) {
    setGlossaryOf(`${position.book}.${position.chapter}`)
    setGlossary(readChapterGlossary())
  }
  const [adding, setAdding] = useState<GlossaryTarget | null>(null)
  const glossed = glossedPlaces(data, glossary)
  const { lit, touch, card, helpsOpened } = useWordHelps({
    data,
    resetKey: openKey,
    marked,
    bridge: bridge.abbreviation,
    verses: [position.verse],
    glossary,
    onGlossary: setAdding,
  })
  const hint = t('editor.toquePalabra')

  const write = (verse: number, value: string) => {
    setDrafts((now) => ({ ...now, [verse]: value }))
    frame.setSaved('guardado')
    writeDraft(position.book, position.chapter, verse, value, context.person.name)
  }
  const choose = (verse: number, keepOther: boolean) => {
    chooseVersion(position.book, position.chapter, verse, keepOther)
    setDrafts((now) => ({ ...now, [verse]: readDraft(position.book, position.chapter, verse) }))
    setOthers((now) => ({ ...now, [verse]: null }))
    frame.setSaved('guardado')
  }

  // Only the boxes: the texts to translate from are panes of their own, a swipe away. Both in one pane left each a
  // sliver once the keyboard was up, and the person could not tell the text being written from the one being read.
  const own = (
    <div className="edit-pane">
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
              <div className="edit-verse-body">
                {others[v] && (
                  // Received from another computer while this one had its own text: both stay until someone chooses.
                  <div className="edit-other" role="note">
                    <p className="edit-other-head">{t('editor.otraVersion', { nombre: others[v]!.by })}</p>
                    <p className="edit-other-text">{others[v]!.text}</p>
                    <div className="edit-other-actions">
                      <button type="button" className="button-quiet" onClick={() => choose(v, true)}>
                        {t('editor.usarOtra', { nombre: others[v]!.by })}
                      </button>
                      <button type="button" className="button-quiet" onClick={() => choose(v, false)}>
                        {t('editor.dejarEsta')}
                      </button>
                    </div>
                  </div>
                )}
                {others[v] && authorOf(position.book, position.chapter, v) && (
                  <p className="edit-mine-head">{t('editor.loQueEsta', { nombre: authorOf(position.book, position.chapter, v)! })}</p>
                )}
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
          glossed={glossed[x.abbreviation]}
          line={writingLine?.verse === position.verse ? writingLine.line : null}
          lit={lit(x.abbreviation)}
          hint={hint}
          onWord={(verse, place) => touch(x.abbreviation, verse, place)}
          under={(verse) => card(x.abbreviation, verse)}
        />
      ),
    })),
    { id: 'ayudas', label: t('editor.panelAyudas'), content: frame.helps(undefined, { glossary }) },
  ]

  return (
    <>
      <Panes panes={panes} label={t('editor.paneles')} fixed="suyo" onPane={(id) => id === 'ayudas' && helpsOpened()} />
      {adding && (
        <GlossarySheet
          data={data}
          target={adding}
          glossary={glossary}
          written={drafts[adding.verse] ?? readDraft(position.book, position.chapter, adding.verse)}
          person={context.person.name}
          onSave={(entry) => {
            saveGlossaryEntry(context.project.id, entry)
            setGlossary(readChapterGlossary())
            setAdding(null)
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  )
}

export const editor: MiniApp = {
  id: 'editor',
  needs: ['text', 'notes', 'words'],
  phase: 'traduccion',
  unit: 'verse',
  sections: true,
  done: (at) => Boolean(readDraft(at.book, at.chapter, at.verse).trim()),
  helps: false,
  fills: true,
  writes: true,
  Center,
  primary: {
    label: 'editor.guardarSeguir',
    returning: 'editor.guardarVolver',
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
      otraVersion: '{nombre} escribió este versículo de otra manera:',
      glosario: 'Glosario',
      glosarioSinOriginal: '«{palabra}» no está alineada con el original: no se sabe de qué palabra es.',
      comoSeTraduce: 'Cómo se traduce',
      comoSeTraduceEjemplo: 'La forma que usa el equipo',
      deSuTraduccion: 'De lo que escribió en este versículo:',
      otrasFormas: 'Otras formas (separadas por comas)',
      otrasFormasAyuda: 'Si según el contexto se dice de otra manera',
      notaGlosario: 'Nota (opcional)',
      guardarGlosario: 'Guardar en el glosario',
      usarOtra: 'Usar la de {nombre}',
      dejarEsta: 'Dejar la que está',
      loQueEsta: 'Lo que está, de {nombre}:',
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
      guardarVolver: 'Guardar y volver',
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
      otraVersion: '{nombre} escreveu este versículo de outro jeito:',
      glosario: 'Glossário',
      glosarioSinOriginal: '«{palabra}» não está alinhada com o original: não se sabe de que palavra é.',
      comoSeTraduce: 'Como se traduz',
      comoSeTraduceEjemplo: 'A forma que a equipe usa',
      deSuTraduccion: 'Do que você escreveu neste versículo:',
      otrasFormas: 'Outras formas (separadas por vírgulas)',
      otrasFormasAyuda: 'Se conforme o contexto se diz de outro jeito',
      notaGlosario: 'Nota (opcional)',
      guardarGlosario: 'Salvar no glossário',
      usarOtra: 'Usar a de {nombre}',
      dejarEsta: 'Deixar a que está',
      loQueEsta: 'O que está, de {nombre}:',
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
      guardarVolver: 'Salvar e voltar',
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
      otraVersion: '{nombre} wrote this verse another way:',
      glosario: 'Glossary',
      glosarioSinOriginal: '«{palabra}» is not aligned to the original: which word it stands for is unknown.',
      comoSeTraduce: 'How it is translated',
      comoSeTraduceEjemplo: 'The form the team uses',
      deSuTraduccion: 'From what you wrote in this verse:',
      otrasFormas: 'Other forms (separated by commas)',
      otrasFormasAyuda: 'If in some contexts it is said another way',
      notaGlosario: 'Note (optional)',
      guardarGlosario: 'Save in the glossary',
      usarOtra: 'Use {nombre}\'s',
      dejarEsta: 'Keep this one',
      loQueEsta: 'What is here, by {nombre}:',
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
      guardarVolver: 'Save and go back',
      unir: 'Join with the next verse',
      unirAyuda: 'When your language says both verses in one sentence',
      deshacer: 'Undo',
      deshacerAyuda: 'Go back to how it was before the last change',
      grabar: 'Record by voice',
      grabarAyuda: 'Say the verse instead of writing it (coming soon)',
    },
  },
}
