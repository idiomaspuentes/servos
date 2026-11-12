/**
 * Estudio: read the book before translating it. It begins with the book's introduction, then each chapter's, then
 * its sections (or verses, as the person chooses), the way translationCore 4's study goes.
 *
 * A section is read alone, its words to touch: a word brings its helps under its verse (the other bridge text's words,
 * the notes, the translation words), so there is no separate list of helps to go through. Under each verse wait,
 * folded, only what no word leads to: the notes on the whole verse and the comprehension questions. The texts and
 * the team's note on the section are panes side by side, the tabs at the foot on a phone; one button leads from
 * reading to the note (the keyboard up), and from the note to the next section. On a wide screen the text stays on
 * the left and the note on the right.
 */

import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChapterLines } from '../../frame/ChapterLines'
import { Markdown, type ArticleLinks } from '../../frame/Markdown'
import { Panes, useWide, useWider, type Pane } from '../../frame/Panes'
import { passageOf } from '../../frame/PlacePicker'
import { SideBySide, type SideText } from '../../frame/SideBySide'
import { glossedPlaces, helpedPlaces, useWordHelps } from '../../frame/TouchWords'
import { readGlossaryFor } from '../../projects/glossary'
import { BOOK_NOTE_CHAPTER, introNoteOn, issuesReadIn, joinStartOf, markIssueRead, markStudied, studiedIn, studyNoteOn, studyNotesAbout, textOf, writeIntroNote, writeStudyNote } from '../../projects/work'
import { BOOK_INTRO, BOOK_ISSUES, CHAPTER_INTRO, type MiniApp, type MiniAppCenterProps } from '../contract'
import { StudyNotes, withLine } from './StudyNotes'
import { VerseExtras } from './VerseExtras'
import { ArticleSheet, articleIn, type InBook, type OpenArticle } from '../../frame/ArticleSheet'
import { issuesOfSection, type BookIssue } from '../../projects/bookIssues'
import { readArticle } from '../../projects/library'
import { BookIssues } from './BookIssues'
import { SectionIssues } from './SectionIssues'

/** How long a section stays on screen before moving on past it counts as having read it. */
export const READ_SECONDS = 5

function Center({ context }: MiniAppCenterProps) {
  const { position, data, t, marked, textAbbreviation, shown, person } = context
  const wide = useWide()
  // From 1280 px the texts can be read side by side, up to three, the team's own among them (principle 13).
  const wider = useWider()
  const unitKey = `${position.book}.${position.chapter}.${shown.join(',')}`
  // What is hard in the book is read with the book's note: its hint already asks what will be hard to translate.
  const issuesStop = position.verse === BOOK_ISSUES
  // An introduction has its note too: the chapter's, or the book's (`introNoteOn`).
  const introOf = position.verse === BOOK_INTRO || issuesStop ? 'libro' : position.verse === CHAPTER_INTRO ? 'capitulo' : null
  const introChapter = introOf === 'libro' ? BOOK_NOTE_CHAPTER : position.chapter
  const read = () => (introOf ? introNoteOn(position.book, introChapter) : studyNoteOn(position.book, position.chapter, shown))
  const [key, setKey] = useState(unitKey)
  const [note, setNote] = useState(() => ({ text: read()?.text ?? '', by: read()?.by ?? null }))
  const [, setPane] = useState('')
  const [open, setOpen] = useState<{ id: string } | undefined>(undefined)
  const [article, setArticle] = useState<OpenArticle | null>(null)
  // One of the book's issues opened (from its stop, or a section's fold): its article, with its notes in this book.
  const [issue, setIssue] = useState<{ article: OpenArticle; here?: InBook['here'] } | null>(null)
  const openIssue = async (found: BookIssue, here?: InBook['here']) => {
    markIssueRead(position.book, found.path)
    const ref = { kind: 'ta' as const, path: found.path }
    const where = found.notes[0] ? context.chapterData(found.notes[0].chapter) : null
    const shownArticle =
      articleIn(data, ref) ??
      (where && articleIn(where, ref)) ??
      (await readArticle(ref).then((a) => (a ? { ref, ...a } : null)).catch(() => null)) ?? { ref, title: found.title, markdown: t('ayudas.articuloNoEsta') }
    setIssue({ article: shownArticle, here })
  }
  const inBook = (here?: InBook['here']): InBook => ({
    name: context.bookTitle,
    issues: context.bookIssues,
    here,
    onGo: (chapter, verse) => context.goTo({ book: position.book, chapter, verse }),
  })
  const issueSheet = issue && <ArticleSheet data={data} article={issue.article} inBook={inBook(issue.here)} onClose={() => setIssue(null)} />
  if (key !== unitKey) {
    setKey(unitKey)
    setNote({ text: read()?.text ?? '', by: read()?.by ?? null })
    // Each section starts at its reading.
    setOpen({ id: data.texts.find((x) => x.abbreviation === textAbbreviation)?.abbreviation ?? data.texts[0].abbreviation })
  }
  const box = useRef<HTMLTextAreaElement>(null)
  // A new section or introduction is read from its beginning: what was scrolled to the end of the last one (its
  // text, its note, the introduction before it) goes back to the top. After the texts have placed their verse.
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('.study-intro, .pane').forEach((el) => (el.scrollTop = 0))
  }, [unitKey])
  const write = (text: string) => {
    if (introOf) writeIntroNote(position.book, introChapter, text, person.name)
    else writeStudyNote(position.book, position.chapter, shown, text, person.name)
    setNote({ text, by: text.trim() ? person.name : null })
  }
  // To the note, the keyboard up: at once, so the box takes the focus while the touch lasts (a phone opens its
  // keyboard only then).
  const toNote = (text?: string) => {
    flushSync(() => {
      if (text !== undefined) write(text)
      setOpen({ id: 'nota' })
    })
    const el = box.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }
  // A word that will be hard to translate goes into the note when it is found, on a line of its own.
  const noteWord = (word: string) => toNote(withLine(note.text, `«${word}»: `))
  // The glossary is looked up while studying too: how the team already decided to translate a word.
  const glossary = readGlossaryFor(
    context.project.id,
    (data.texts.find((x) => x.original)?.words ?? []).map((w) => w.strong)
  )
  const glossed = glossedPlaces(data, glossary)
  // Where touching a word brings a note or a key word: marked lightly in the texts.
  const helped = helpedPlaces(data)
  // On a computer a touched word's card is in the column beside the texts, over the note, not under its verse: the
  // text does not move when a word is touched.
  const { lit, touch, card, cardAside } = useWordHelps({
    data,
    resetKey: unitKey,
    marked,
    bridge: textAbbreviation,
    verses: shown,
    onNote: noteWord,
    glossary,
    aside: wide,
  })

  const intro = introOf === 'libro' ? data.bookIntro : introOf === 'capitulo' ? data.intro : undefined
  if (introOf && (intro !== undefined || issuesStop)) {
    // An introduction is read whole, across its pane: it is about the book or the chapter, not about words in it. Its
    // note keeps what the team decides for all of it (the title, the names that come back), read again while
    // translating any verse of it.
    const label = t(introOf === 'libro' ? 'marco.introLibro' : 'marco.introCapitulo')
    // The articles it points to («Ver: gracia, misericordia»), to open by their titles.
    const articleAt = (ref: { kind: 'tw' | 'ta'; path: string }) => (ref.kind === 'tw' ? data.words[ref.path] : data.academy[ref.path])
    const links: ArticleLinks = {
      // A word's article is named by its first form («gracia, amable»): commas would run several links together.
      titleOf: (ref) => (articleAt(ref)?.markdown ? (ref.kind === 'tw' ? articleAt(ref)!.title.split(',')[0].trim() : articleAt(ref)!.title) : null),
      open: (ref) => setArticle(articleIn(data, ref)),
    }
    const writeButton = !wide && !note.text.trim() && (
      <button type="button" className="button-secondary study-write" onClick={() => toNote()}>
        ✎ {t('estudio.escribirNota')}
      </button>
    )
    const panes: Pane[] = [
      issuesStop
        ? {
            id: 'asuntos',
            label: t('marco.loDificil'),
            content: (
              <>
                <BookIssues issues={context.bookIssues} bookName={context.bookTitle} read={issuesReadIn(position.book)} onOpen={(i) => void openIssue(i)} />
                {writeButton}
              </>
            ),
          }
        : {
            id: 'introduccion',
            label,
            content: (
              <>
                <article className="study-intro" aria-label={label}>
                  <Markdown text={intro ?? ''} links={links} />
                </article>
                {writeButton}
              </>
            ),
          },
      {
        id: 'nota',
        label: t('estudio.miNota'),
        content: (
          <StudyNotes
            ref={box}
            passage={introOf === 'libro' ? context.bookTitle : `${context.bookTitle} ${position.chapter}`}
            text={note.text}
            by={note.by}
            others={[]}
            about={t(introOf === 'libro' ? 'estudio.paraQueLibro' : 'estudio.paraQueCapitulo')}
            hint={t(introOf === 'libro' ? 'estudio.pistaLibro' : 'estudio.pistaCapitulo')}
            onChange={write}
          />
        ),
      },
    ]
    return (
      <div className="study" ref={root}>
        <Panes panes={panes} label={t('estudio.paneles')} fixed="nota" open={open} onPane={setPane} holdFocus={false} />
        {article && <ArticleSheet data={data} article={article} onClose={() => setArticle(null)} />}
        {issueSheet}
      </div>
    )
  }

  // What no word leads to waits folded under its verse: the notes on a whole verse, which quote no words (and any
  // whose words were not found in this text, with its quote), and the comprehension questions.
  const general = (verse: number, abbreviation: string) => {
    const at = data.verses.find((v) => v.verse === verse)
    return <VerseExtras notes={at?.notes.filter((n) => !n.places[abbreviation]?.length) ?? []} questions={at?.questions ?? []} />
  }
  const hint = t('estudio.toquePalabra')
  const others = studyNotesAbout(position.book, position.chapter, shown).filter((n) => n.verses.join(',') !== shown.join(','))
  const texts: Pane[] = data.texts.map(
    (x): Pane => ({
      id: x.abbreviation,
      label: x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation,
      content: (
        <>
        <ChapterLines
          text={x}
          shown={shown}
          at={shown[0]}
          line={null}
          only
          glossed={glossed[x.abbreviation]}
          helped={helped[x.abbreviation]}
          lit={lit(x.abbreviation)}
          hint={hint}
          onWord={(verse, place) => touch(x.abbreviation, verse, place)}
          under={(verse) => (
            <>
              {card(x.abbreviation, verse)}
              {!x.original && general(verse, x.abbreviation)}
            </>
          )}
        />
        {/* The note on the section, offered where the reading ends (principle 5): not the one thing to do. */}
        {!x.original && !wide && !note.text.trim() && (
          <button type="button" className="button-secondary study-write" onClick={() => toNote()}>
            ✎ {t('estudio.escribirNota')}
          </button>
        )}
        </>
      ),
    })
  )
  // The team's own text is one more to read beside the others, where some of it is written already.
  const book = position.book
  const chapter = position.chapter
  const ownWritten = shown.some((v) => textOf(book, chapter, v).trim())
  const sideTexts: SideText[] = [
    ...data.texts.map((x, i) => ({ id: x.abbreviation, label: texts[i].label, text: x })),
    ...(ownWritten ? [{ id: 'suyo', label: t('marco.lado.suyo'), own: { textOf: (v: number) => textOf(book, chapter, v), startOf: (v: number) => joinStartOf(book, chapter, v) } }] : []),
  ]
  const together: Pane = {
    id: 'textos',
    label: t('marco.lado.textos'),
    content: (
      <SideBySide
        app="estudio"
        texts={sideTexts}
        max={3}
        initial={textAbbreviation}
        single={(id) => texts.find((p) => p.id === id)?.content ?? null}
        verses={shown}
        open={shown}
        at={shown[0]}
        line={null}
        lit={lit}
        glossed={glossed}
        helped={helped}
        onWord={(id, verse, place) => touch(id, verse, place)}
        under={(ids, verse) => {
          const cards = ids.map((id) => [id, card(id, verse)] as const).filter(([, c]) => c).map(([id, c]) => <Fragment key={id}>{c}</Fragment>)
          // What no word leads to, once, from the first bridge text shown.
          const bridge = ids.find((id) => data.texts.some((x) => x.abbreviation === id && !x.original))
          const notes = bridge ? general(verse, bridge) : null
          return cards.length || notes ? (
            <>
              {cards}
              {notes}
            </>
          ) : null
        }}
      />
    ),
  }
  // The book's issues in this section: an index above its text on a phone; on a computer in the column beside it, over
  // the note, where a touched word's card goes, so it is not stretched across the window.
  const here = { chapter: position.chapter, verses: shown }
  const sectionIssues = (
    <SectionIssues rows={issuesOfSection(context.bookIssues, position.chapter, shown)} chapter={position.chapter} bookName={context.bookTitle} onOpen={(i) => void openIssue(i, here)} />
  )
  const panes: Pane[] = [
    ...(wider ? [together] : texts),
    {
      id: 'nota',
      label: t('estudio.miNota'),
      content: (
        <>
          {wide && sectionIssues}
          {cardAside()}
          <StudyNotes
            ref={box}
            passage={passageOf(context.bookTitle, position.chapter, shown, t)}
            text={note.text}
            by={note.by}
            others={others}
            onChange={write}
          />
        </>
      ),
    },
  ]

  return (
    <div className="study" ref={root}>
      {!wide && sectionIssues}
      <Panes panes={panes} label={t('estudio.paneles')} fixed="nota" open={open} onPane={setPane} holdFocus={false} />
      {issueSheet}
    </div>
  )
}

export const estudio: MiniApp = {
  id: 'estudio',
  needs: ['text', 'notes', 'questions', 'words', 'academy'],
  phase: 'estudio',
  // A passage is understood a section at a time, as translationCore 4's study goes.
  unit: 'section',
  sections: true,
  intros: true,
  // After the book's introduction, what is hard in the book (`BOOK_ISSUES`).
  issues: true,
  // A verse is studied once it was read through (the person moved on past its section), or has a note on it.
  done: (at) => studiedIn(at.book, at.chapter).includes(at.verse) || studyNotesAbout(at.book, at.chapter, [at.verse]).length > 0,
  // Read, not skipped: no section is read in less than a few seconds, and arrows pressed one after another are a
  // person finding their place. A floor, not a measure of the section's length, so a fast reader is never left out.
  passed: (at) => {
    if (at.seconds >= READ_SECONDS) markStudied(at.book, at.chapter, at.verses)
  },
  helps: false,
  fills: true,
  writes: false,
  Center,
  texts: {
    es: {
      nombre: 'Estudio',
      descripcion: 'Leer el libro con sus introducciones, notas, preguntas y palabras clave antes de traducir',
      seguir: 'Seguir leyendo',
      escribirNota: 'Escribir mi nota',
      miNota: 'Mi nota',
      notaVersiculo: 'Nota sobre el versículo',
      notasVersiculo: 'Notas sobre el versículo ({n})',
      preguntaPensar: 'Pregunta para pensar',
      preguntasPensar: 'Preguntas para pensar ({n})',
      verRespuesta: 'Ver la respuesta',
      guardarSeguir: 'Guardar y seguir',
      toquePalabra: 'toque una palabra para ver sus notas',
      'toquePalabra.computadora': 'haga clic en una palabra para ver sus notas',
      loQueEntendi: 'Lo que entendí de {pasaje}',
      paraQue: 'Lo verá su equipo al traducir estos versículos.',
      pista: '¿Qué dice? ¿Quién habla, a quién? ¿Qué será difícil de traducir?',
      paneles: 'Lo que se lee',
      notaGuardada: 'Guardada en este teléfono · la escribió {nombre}.',
      paraQueLibro: 'Lo verá su equipo al traducir cualquier versículo del libro.',
      paraQueCapitulo: 'Lo verá su equipo al traducir cualquier versículo de este capítulo.',
      pistaLibro: '¿De qué trata el libro? ¿Cómo traducirán el título? ¿Qué nombres o palabras se repetirán?',
      pistaCapitulo: '¿Qué pasa en este capítulo? ¿Qué será difícil de traducir?',
      'notaGuardada.computadora': 'Guardada en esta computadora · la escribió {nombre}.',
      otrasNotas: 'Otras notas sobre estos versículos',
      notaSobre: 'Versículos {versiculos} · {nombre}',
      loDificil: 'Lo difícil de este libro',
      loDificilPara: 'Las notas de {libro} explican estos asuntos. Léalos antes de traducir; los volverá a encontrar en cada sección.',
      asuntoCuenta: '{n} notas · en {c} capítulos',
      asuntoCuentaUna: '1 nota · en 1 capítulo',
      asuntoCuentaUnCapitulo: '{n} notas · en 1 capítulo',
      leido: 'Leído',
      otrosAsuntos: 'Ver los otros {n} asuntos',
      asuntosAqui: 'Asuntos de traducción aquí ({n})',
      enTodoLibro: '{n} en todo {libro}',
      'lengua.hbo': 'Hebreo',
      'lengua.grc': 'Griego',
      'lengua.original': 'Original',
    },
    pt: {
      nombre: 'Estudo',
      descripcion: 'Ler o livro com suas introduções, notas, perguntas e palavras-chave antes de traduzir',
      seguir: 'Continuar lendo',
      escribirNota: 'Escrever minha nota',
      miNota: 'Minha nota',
      notaVersiculo: 'Nota sobre o versículo',
      notasVersiculo: 'Notas sobre o versículo ({n})',
      preguntaPensar: 'Pergunta para pensar',
      preguntasPensar: 'Perguntas para pensar ({n})',
      verRespuesta: 'Ver a resposta',
      guardarSeguir: 'Salvar e seguir',
      toquePalabra: 'toque uma palavra para ver suas notas',
      'toquePalabra.computadora': 'clique numa palavra para ver suas notas',
      loQueEntendi: 'O que entendi de {pasaje}',
      paraQue: 'Sua equipe verá isto ao traduzir estes versículos.',
      pista: 'O que diz? Quem fala, a quem? O que será difícil de traduzir?',
      paneles: 'O que se lê',
      notaGuardada: 'Salva neste telefone · escrita por {nombre}.',
      paraQueLibro: 'Sua equipe verá isto ao traduzir qualquer versículo do livro.',
      paraQueCapitulo: 'Sua equipe verá isto ao traduzir qualquer versículo deste capítulo.',
      pistaLibro: 'Do que trata o livro? Como vão traduzir o título? Que nomes ou palavras vão se repetir?',
      pistaCapitulo: 'O que acontece neste capítulo? O que será difícil de traduzir?',
      'notaGuardada.computadora': 'Salva neste computador · escrita por {nombre}.',
      otrasNotas: 'Outras notas sobre estes versículos',
      notaSobre: 'Versículos {versiculos} · {nombre}',
      loDificil: 'O difícil deste livro',
      loDificilPara: 'As notas de {libro} explicam estes assuntos. Leia-os antes de traduzir; vai encontrá-los de novo em cada seção.',
      asuntoCuenta: '{n} notas · em {c} capítulos',
      asuntoCuentaUna: '1 nota · em 1 capítulo',
      asuntoCuentaUnCapitulo: '{n} notas · em 1 capítulo',
      leido: 'Lido',
      otrosAsuntos: 'Ver os outros {n} assuntos',
      asuntosAqui: 'Assuntos de tradução aqui ({n})',
      enTodoLibro: '{n} em todo {libro}',
      'lengua.hbo': 'Hebraico',
      'lengua.grc': 'Grego',
      'lengua.original': 'Original',
    },
    en: {
      nombre: 'Study',
      descripcion: 'Read the book with its introductions, notes, questions, and key words before translating',
      seguir: 'Keep reading',
      escribirNota: 'Write my note',
      miNota: 'My note',
      notaVersiculo: 'Note on the verse',
      notasVersiculo: 'Notes on the verse ({n})',
      preguntaPensar: 'Question to think on',
      preguntasPensar: 'Questions to think on ({n})',
      verRespuesta: 'See the answer',
      guardarSeguir: 'Save and continue',
      toquePalabra: 'touch a word to see its notes',
      'toquePalabra.computadora': 'click a word to see its notes',
      loQueEntendi: 'What I understood of {pasaje}',
      paraQue: 'Your team will see it when translating these verses.',
      pista: 'What does it say? Who speaks, to whom? What will be hard to translate?',
      paneles: 'What is read',
      notaGuardada: 'Saved on this phone · written by {nombre}.',
      paraQueLibro: 'Your team will see it when translating any verse of the book.',
      paraQueCapitulo: 'Your team will see it when translating any verse of this chapter.',
      pistaLibro: 'What is the book about? How will you translate its title? What names or words will come back?',
      pistaCapitulo: 'What happens in this chapter? What will be hard to translate?',
      'notaGuardada.computadora': 'Saved on this computer · written by {nombre}.',
      otrasNotas: 'Other notes on these verses',
      notaSobre: 'Verses {versiculos} · {nombre}',
      loDificil: 'What is hard in this book',
      loDificilPara: 'The notes on {libro} explain these issues. Read them before translating; you will meet them again in each section.',
      asuntoCuenta: '{n} notes · in {c} chapters',
      asuntoCuentaUna: '1 note · in 1 chapter',
      asuntoCuentaUnCapitulo: '{n} notes · in 1 chapter',
      leido: 'Read',
      otrosAsuntos: 'See the other {n} issues',
      asuntosAqui: 'Translation issues here ({n})',
      enTodoLibro: '{n} in all of {libro}',
      'lengua.hbo': 'Hebrew',
      'lengua.grc': 'Greek',
      'lengua.original': 'Original',
    },
  },
}
