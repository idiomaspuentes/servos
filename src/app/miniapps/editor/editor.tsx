/**
 * Editor: write the verse in the language of the project, a line to a field as the text translated from sets it
 * (`LineFields`), a verse at a time or a section at a time, as the person chooses. The boxes and each text to read
 * are panes side by side, one in sight: a finger slides to the bridge texts, the original or the helps and back, and
 * the keyboard stays up all the while. A word touched in a text brings its notes and translation words under its
 * verse (`TouchWords`). In the prototype a draft is kept in this browser only; wired, every change goes to the
 * journal (design, section 6).
 *
 * From 1280 px each verse is a row: the texts on, then its box, as desktop translation tools have it (philosophy,
 * principle 13). The box is the same in both shapes (`boxOf`); only where it stands changes.
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import { Panes, type Pane, useWide, useWider, useWidest } from '../../frame/Panes'
import { rowsOf } from '../../frame/parallel'
import { SideBySide } from '../../frame/SideBySide'
import { glossedPlaces, useWordHelps, type GlossaryTarget } from '../../frame/TouchWords'
import { readGlossaryFor, saveGlossaryEntry } from '../../projects/glossary'
import { GlossarySheet } from './GlossarySheet'
import type { MiniApp, MiniAppCenterProps } from '../contract'
import {
  authorOf,
  chooseVersion,
  joinedVerses,
  joinStartOf,
  joinWithNext,
  otherVersion,
  readDraft,
  separateJoined,
  textOf,
  versionsAt,
  writeDraft,
  type OtherVersion,
  chooseStructure,
  structureConflictAt,
} from '../../projects/work'
import { ChapterLines } from '../../frame/ChapterLines'
import { TwoShapes, TwoVersions } from '../../frame/TwoVersions'
import { VerseObservations } from '../revisor/revisor'
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

/** Verses said together (joined) are written in one box, kept on the first: the verses open, as those boxes. */
function unitsOf(book: string, chapter: number, verses: number[]): number[][] {
  return rowsOf(verses, (v) => joinedVerses(book, chapter, v))
}
const unitLabel = (unit: number[]) => (unit.length > 1 ? `${unit[0]}–${unit[unit.length - 1]}` : String(unit[0]))

function Center({ context }: MiniAppCenterProps) {
  const { position, marked, t, data, textAbbreviation, frame, goTo } = context
  // The verses open, with those joined to them: a verse joined to the one before opens their box.
  const units = unitsOf(position.book, position.chapter, context.shown)
  const shown = units.flat()
  const starts = units.map((u) => u[0])
  // What is open: the verse, or the verses of its section. Within a section the position follows the verse being
  // written (so the helps are that verse's), and nothing else changes.
  const openKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  const [drafts, setDrafts] = useState(() => readDrafts(position.book, position.chapter, starts))
  const [others, setOthers] = useState(() => readOthers(position.book, position.chapter, starts))
  const [shownKey, setShownKey] = useState(openKey)
  // The line the cursor is in, by its field's id (`editor-v2`, `editor-v2-l3`): the texts show the same line apart.
  const [writingLine, setWritingLine] = useState<{ verse: number; line: number } | null>(null)
  if (shownKey !== openKey) {
    setShownKey(openKey)
    setDrafts(readDrafts(position.book, position.chapter, starts))
    setOthers(readOthers(position.book, position.chapter, starts))
  }

  // Going on to another verse or section while writing: the cursor goes to its first line, and the keyboard stays up.
  // A click on a row not open (from 1280 px) asks for the box of that row.
  const writing = useRef(false)
  const stopWriting = useRef<number>()
  const asked = useRef<number | null>(null)
  const fieldsId = (verse: number) => `editor-v${verse}`
  useLayoutEffect(() => {
    const verse = asked.current
    asked.current = null
    if (verse === null && !writing.current) return
    const box = document.getElementById(lineFieldId(fieldsId(verse ?? shown[0]), 0)) as HTMLTextAreaElement | null
    box?.focus()
    box?.setSelectionRange(box.value.length, box.value.length)
  }, [openKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The line the cursor is in, for the texts to light it; and that the person is writing, so going on keeps it there.
  const onBoxFocus = (event: FocusEvent) => {
    window.clearTimeout(stopWriting.current)
    writing.current = true
    const id = event.target.id.match(/^editor-v(\d+)(?:-l(\d+))?$/)
    if (id) setWritingLine({ verse: Number(id[1]), line: id[2] ? Number(id[2]) - 1 : 0 })
  }
  const onBoxBlur = () => {
    // Later, not now: moving to another verse takes the focused field away for a moment.
    stopWriting.current = window.setTimeout(() => {
      writing.current = document.activeElement instanceof HTMLTextAreaElement
    }, 0)
  }

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
  const wide = useWide()

  const write = (verse: number, value: string) => {
    setDrafts((now) => ({ ...now, [verse]: value }))
    frame.setSaved('guardado')
    writeDraft(position.book, position.chapter, verse, value, context.person.name)
  }
  const choose = (verse: number, keepOther: boolean) => {
    chooseVersion(position.book, position.chapter, verse, keepOther, context.person.name)
    setDrafts((now) => ({ ...now, [verse]: readDraft(position.book, position.chapter, verse) }))
    setOthers((now) => ({ ...now, [verse]: null }))
    frame.setSaved('guardado')
  }

  // ↑ and ↓ past a box's first or last line: the box of the verse before or after, among the verses open.
  const edge = (unit: number[], toward: 'previous' | 'next') => {
    const i = units.findIndex((u) => u[0] === unit[0])
    const to = units[toward === 'next' ? i + 1 : i - 1]
    const first = to ? document.getElementById(lineFieldId(fieldsId(to[0]), 0)) : null
    const fields = first?.closest('.line-fields')?.querySelectorAll<HTMLTextAreaElement>('textarea.line-field')
    const box = fields && (toward === 'next' ? fields[0] : fields[fields.length - 1])
    if (!box) return false
    box.focus()
    const at = toward === 'next' ? 0 : box.value.length
    box.setSelectionRange(at, at)
    return true
  }

  // The box of a verse, or of the verses said together: the same in a column of boxes and in the rows of a wide window.
  // In a section the position follows the verse being written in, so the helps are that verse's.
  const boxOf = (unit: number[]) => {
    const v = unit[0]
    const markers = unit.flatMap(markersOf)
    const poem = markers.some(isPoemLine)
    const conflict = structureConflictAt(position.book, position.chapter, v)
    return (
      <div
        className="edit-verse-body"
        onFocus={(event) => {
          onBoxFocus(event)
          if (!unit.includes(position.verse)) goTo({ ...position, verse: v })
        }}
        onBlur={onBoxBlur}
      >
        {conflict ? (
          <TwoShapes
            book={position.book}
            conflict={conflict}
            onChoose={(keepReceived) => {
              chooseStructure(position.book, position.chapter, conflict.from, keepReceived, context.person.name)
              setDrafts(readDrafts(position.book, position.chapter, context.shown))
              setOthers(readOthers(position.book, position.chapter, context.shown))
              frame.setSaved('guardado')
            }}
          />
        ) : others[v] ? (
          // Received from another computer while this one had its own text: both stay until someone chooses,
          // and the choice comes before writing (the one kept can be corrected then).
          <TwoVersions
            here={{ text: drafts[v] ?? '', by: authorOf(position.book, position.chapter, v) ?? '' }}
            received={others[v]!}
            onChoose={(keepReceived) => choose(v, keepReceived)}
          />
        ) : (
          <LineFields
            key={fieldsId(v)}
            id={fieldsId(v)}
            text={drafts[v] ?? ''}
            markers={markers}
            poem={poem}
            label={t('editor.suVersiculo', { v: unitLabel(unit) })}
            placeholder={(line) => (poem ? t('editor.renglon', { n: line }) : t('editor.cajaVersiculo', { v: unitLabel(unit), idioma: context.project.languageName }))}
            addLabel={t('editor.otroRenglon')}
            onChange={(value) => write(v, value)}
            onEdge={(toward) => edge(unit, toward)}
          />
        )}
        {/* What a passage review saw to improve here, until someone marks it improved. */}
        <VerseObservations book={position.book} chapter={position.chapter} verse={v} person={context.person.name} />
      </div>
    )
  }
  const joinedNote = (unit: number[]) => <p className="edit-joined">{t('editor.unidos', { versiculos: unitLabel(unit) })}</p>

  // Only the boxes: the texts to translate from are panes of their own, a swipe away. Both in one pane left each a
  // sliver once the keyboard was up, and the person could not tell the text being written from the one being read.
  const own = (
    <div className="edit-pane">
      {/* While the section has nothing written, what to write and where the text to translate is (on a phone it is
          another pane, a swipe away). It goes as soon as something is written. */}
      {!wide && units.every((u) => !(drafts[u[0]] ?? '').trim()) && (
        <p className="edit-where">{t('editor.comoEmpezar', { idioma: context.project.languageName, texto: bridge.abbreviation })}</p>
      )}
      <div className="edit-fields">
        {units.map((unit) => (
          // In a section each verse keeps its own fields, its number before them: the text is still kept verse by
          // verse, so a section and a verse at a time read and write the same drafts.
          <div key={unit[0]} className={units.length > 1 ? 'edit-verse in-section' : 'edit-verse'}>
            {units.length > 1 && <span className="edit-verse-number" aria-hidden="true">{unitLabel(unit)}</span>}
            {units.length === 1 && unit.length > 1 && joinedNote(unit)}
            {boxOf(unit)}
          </div>
        ))}
        {anyPoem && <p className="edit-hint">{t('editor.comoRenglones')}</p>}
      </div>
    </div>
  )

  // From 1280 px the helps are a column of their own, in sight beside the text (principle 13): the note read there lights
  // its words in the text, as once the helps pane is opened on a narrower screen.
  const wider = useWider()
  useEffect(() => {
    if (wider) helpsOpened()
  }, [wider, openKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const widest = useWidest()
  const labelOf = (x: (typeof data.texts)[number]) => (x.original ? t(`editor.lengua.${x.lang ?? 'original'}`) : x.abbreviation)
  const texts: Pane[] = data.texts.map((x) => ({
    id: x.abbreviation,
    label: labelOf(x),
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
  }))
  // From 1280 px each verse is a row (principle 13): the texts on, their names switches, two at a time, three from
  // 1600 px, and the verse's box at the end of its row; the helps keep their column. Always rows, with one text on
  // too, so the box being written in stays where it is when another text is put beside.
  const rows: Pane = {
    id: 'textos',
    label: t('marco.lado.textos'),
    content: (
      <SideBySide
        app="editor"
        texts={data.texts.map((x) => ({ id: x.abbreviation, label: labelOf(x), text: x }))}
        max={widest ? 3 : 2}
        initial={textAbbreviation}
        open={shown}
        at={position.verse}
        line={writingLine?.verse === position.verse ? writingLine.line : null}
        lit={lit}
        glossed={glossed}
        onWord={(id, verse, place) => touch(id, verse, place)}
        under={(ids, verse) => {
          const cards = ids.map((id) => [id, card(id, verse)] as const).filter(([, c]) => c)
          return cards.length ? cards.map(([id, c]) => <Fragment key={id}>{c}</Fragment>) : null
        }}
        writing={{
          label: t('editor.panelSuyo'),
          unitOf: (v) => joinedVerses(position.book, position.chapter, v),
          box: (unit) => (
            <>
              {unit.length > 1 && joinedNote(unit)}
              {boxOf(unit)}
            </>
          ),
          written: (unit) => textOf(position.book, position.chapter, unit[0]),
          goLabel: (unit) => t('editor.escribirAqui', { v: unitLabel(unit) }),
          go: (unit) => {
            asked.current = unit[0]
            goTo({ ...position, verse: unit[0] })
          },
          hint: anyPoem ? <p className="side-hint">{t('editor.comoRenglones')}</p> : undefined,
        }}
      />
    ),
  }
  const helps: Pane = { id: 'ayudas', label: t('editor.panelAyudas'), content: frame.helps(undefined, { glossary }) }
  const panes: Pane[] = wider ? [rows, helps] : [{ id: 'suyo', label: t('editor.panelSuyo'), content: own }, ...texts, helps]

  return (
    <>
      <Panes
        panes={panes}
        label={t('editor.paneles')}
        fixed={wider ? 'textos' : 'suyo'}
        side="ayudas"
        onPane={(id) => {
          if (id === 'ayudas') helpsOpened()
        }}
      />
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
  // A section at a time until the person chooses: a verse reads best written with those around it.
  unit: 'section',
  sections: true,
  // A verse joined to the one before is translated with it.
  // Written, and not waiting to be brought together with other versions of it: until then the verse is not settled.
  done: (at) => Boolean(textOf(at.book, at.chapter, at.verse).trim()) && !versionsAt(at.book, at.chapter, joinStartOf(at.book, at.chapter, at.verse)).length,
  helps: false,
  fills: true,
  writes: true,
  Center,
  more: [
    {
      label: 'editor.unir',
      description: 'editor.unirAyuda',
      // Which verses: in a section there are several on screen.
      values: (c) => {
        const unit = joinedVerses(c.position.book, c.position.chapter, c.position.verse)
        const last = unit[unit.length - 1]
        return { v: unit.length > 1 ? `${unit[0]}–${last}` : unit[0], siguiente: last + 1 }
      },
      // Not past the chapter's last verse.
      when: (c) => {
        const unit = joinedVerses(c.position.book, c.position.chapter, c.position.verse)
        return c.position.verse > 0 && c.data.verses.some((v) => v.verse === unit[unit.length - 1] + 1)
      },
      run: (c) => joinWithNext(c.position.book, c.position.chapter, c.position.verse, c.person.name),
    },
    {
      label: 'editor.separar',
      description: 'editor.separarAyuda',
      values: (c) => {
        const unit = joinedVerses(c.position.book, c.position.chapter, c.position.verse)
        return { v: `${unit[0]}–${unit[unit.length - 1]}` }
      },
      when: (c) => joinedVerses(c.position.book, c.position.chapter, c.position.verse).length > 1,
      run: (c) => separateJoined(c.position.book, c.position.chapter, c.position.verse, c.person.name),
    },
  ],
  primary: {
    nextOnly: true,
    label: 'editor.guardarSeguir',
    returning: 'editor.guardarVolver',
    run: (c) => c.frame.next(),
  },
  texts: {
    es: {
      unir: 'Unir el {v} con el {siguiente}',
      unirAyuda: 'Cuando su idioma dice este versículo y el siguiente en una sola frase: se escriben juntos, como 1–2',
      separar: 'Separar los versículos {v}',
      separarAyuda: 'El texto queda en el primero; luego reparta lo que dice cada uno',
      unidos: 'Versículos {versiculos}, unidos: se escriben juntos.',
      nombre: 'Traducir por escrito',
      descripcion: 'Escribir cada pasaje en su idioma, con el texto puente al lado',
      textoPuente: 'Texto puente: {texto}',
      comoEmpezar: 'Escriba cada versículo en {idioma}. Lo que va a traducir está en el {texto}: deslice a la izquierda o toque «{texto}» arriba.',
      cajaVersiculo: 'Versículo {v} en {idioma}',
      escribirAqui: 'Escribir el {v}',
      glosario: 'Glosario',
      glosarioSinOriginal: '«{palabra}» no está alineada con el original: no se sabe de qué palabra es.',
      comoSeTraduce: 'Cómo se traduce',
      comoSeTraduceEjemplo: 'La forma que usa el equipo',
      deSuTraduccion: 'De lo que escribió en este versículo:',
      otrasFormas: 'Otras formas (separadas por comas)',
      otrasFormasAyuda: 'Si según el contexto se dice de otra manera',
      notaGlosario: 'Nota (opcional)',
      guardarGlosario: 'Guardar en el glosario',
      suVersiculo: 'Su traducción del versículo {v}',
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
      guardarSeguir: 'Siguiente →',
      guardarVolver: 'Listo: volver',
    },
    pt: {
      unir: 'Juntar o {v} com o {siguiente}',
      unirAyuda: 'Quando sua língua diz este versículo e o próximo numa só frase: escrevem-se juntos, como 1–2',
      separar: 'Separar os versículos {v}',
      separarAyuda: 'O texto fica no primeiro; depois reparta o que diz cada um',
      unidos: 'Versículos {versiculos}, juntados: escrevem-se juntos.',
      nombre: 'Traduzir por escrito',
      descripcion: 'Escrever cada passagem no seu idioma, com o texto ponte ao lado',
      textoPuente: 'Texto ponte: {texto}',
      comoEmpezar: 'Escreva cada versículo em {idioma}. O que vai traduzir está no {texto}: deslize para a esquerda ou toque «{texto}» acima.',
      cajaVersiculo: 'Versículo {v} em {idioma}',
      escribirAqui: 'Escrever o {v}',
      glosario: 'Glossário',
      glosarioSinOriginal: '«{palabra}» não está alinhada com o original: não se sabe de que palavra é.',
      comoSeTraduce: 'Como se traduz',
      comoSeTraduceEjemplo: 'A forma que a equipe usa',
      deSuTraduccion: 'Do que você escreveu neste versículo:',
      otrasFormas: 'Outras formas (separadas por vírgulas)',
      otrasFormasAyuda: 'Se conforme o contexto se diz de outro jeito',
      notaGlosario: 'Nota (opcional)',
      guardarGlosario: 'Salvar no glossário',
      suVersiculo: 'Sua tradução do versículo {v}',
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
      guardarSeguir: 'Próximo →',
      guardarVolver: 'Pronto: voltar',
    },
    en: {
      unir: 'Join {v} with {siguiente}',
      unirAyuda: 'When your language says this verse and the next in one sentence: they are written together, as 1–2',
      separar: 'Separate verses {v}',
      separarAyuda: 'The text stays in the first; then share out what each says',
      unidos: 'Verses {versiculos}, joined: they are written together.',
      nombre: 'Translate in writing',
      descripcion: 'Write each passage in your language, with the bridge text beside it',
      textoPuente: 'Bridge text: {texto}',
      comoEmpezar: 'Write each verse in {idioma}. What you will translate is in the {texto}: swipe left or touch «{texto}» above.',
      cajaVersiculo: 'Verse {v} in {idioma}',
      escribirAqui: 'Write verse {v}',
      glosario: 'Glossary',
      glosarioSinOriginal: '«{palabra}» is not aligned to the original: which word it stands for is unknown.',
      comoSeTraduce: 'How it is translated',
      comoSeTraduceEjemplo: 'The form the team uses',
      deSuTraduccion: 'From what you wrote in this verse:',
      otrasFormas: 'Other forms (separated by commas)',
      otrasFormasAyuda: 'If in some contexts it is said another way',
      notaGlosario: 'Note (optional)',
      guardarGlosario: 'Save in the glossary',
      suVersiculo: 'Your translation of verse {v}',
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
      guardarSeguir: 'Next →',
      guardarVolver: 'Done: go back',
    },
  },
}
