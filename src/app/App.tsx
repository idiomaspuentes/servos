/**
 * The prototype: projects and their books (as translationCore 4 makes them), each book's steps, the mini apps in
 * their frame, receiving a pack, and the interface translator.
 */

import { useEffect, useRef, useState } from 'react'
import { chapterOf, chaptersOf } from '../prototype/data'
import { MiniAppScreen } from './frame/MiniAppScreen'
import { useT } from './i18n/i18n'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type Position } from './miniapps/contract'
import { miniApp } from './miniapps/registry'
import { bookName, loadProjects, saveProjects, type Phase, type Project } from './projects/model'
import { placeLabel, stepPercent } from './projects/progress'
import { keepLastApp, keepPlace, lastAppOf, placeOf } from './projects/work'
import { AddBookSheet } from './screens/AddBook'
import { BookScreen } from './screens/BookScreen'
import { GlossaryScreen } from './screens/GlossaryScreen'
import { Home, type Resume } from './screens/Home'
import { Language } from './screens/Language'
import { AddProjectSheet, NewProject } from './screens/NewProject'
import { PEOPLE, PersonMenu } from './screens/PersonMenu'
import { ProjectSettings } from './screens/ProjectSettings'
import { ReceivePack } from './screens/ReceivePack'
import { TranslateUi } from './screens/TranslateUi'

type Screen =
  | { kind: 'home' }
  | { kind: 'newProject' }
  | { kind: 'book'; projectId: string; book: string }
  | { kind: 'app'; projectId: string; book: string; id: string; back?: Screen }
  | { kind: 'settings'; projectId: string }
  | { kind: 'glossary'; projectId: string; back: Screen }
  | { kind: 'receive'; back: Screen }
  | { kind: 'translate' }

/** The chapters of a book whose texts and helps the prototype has (every chapter of Titus and Jonah). */
const chaptersFor = (book: string) => chaptersOf(book).map((c) => chapterOf(book, c)!)

const RESUME_KEY = 'servos.prototipo.seguir'
function loadResume(): Resume | null {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null') ?? { projectId: 'biblia-kichwa', book: 'tit' }
  } catch {
    return { projectId: 'biblia-kichwa', book: 'tit' }
  }
}

export function App() {
  const t = useT()
  const [projects, setProjectsState] = useState<Project[]>(loadProjects)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [resume, setResumeState] = useState<Resume | null>(loadResume)
  const [person, setPerson] = useState(PEOPLE[0])
  const [personMenu, setPersonMenu] = useState(false)
  const [language, setLanguage] = useState(false)
  const [addProject, setAddProject] = useState(false)
  const [addBookFor, setAddBookFor] = useState<string | null>(null)
  const [position, setPositionState] = useState<Position>({ book: 'tit', chapter: 1, verse: 1 })
  // Each person's place in each book is kept for each mini app (reading and translating go at their own pace):
  // opening it again, on this computer, goes back there.
  const setPosition = (p: Position, app = screen.kind === 'app' ? screen.id : '') => {
    setPositionState(p)
    keepPlace(person, p.book, app, { chapter: p.chapter, verse: p.verse })
  }
  // Where a mini app opens: at a chapter's start when one is chosen, else where the person left it, else at the book's
  // start. A start is the introduction for a mini app that reads them.
  const openAt = (book: string, app: MiniApp, chapter?: number) => {
    const chapters = chaptersOf(book)
    if (!chapters.length) return
    const startOf = (c: number) => {
      const data = chapterOf(book, c)
      if (app.intros && data?.bookIntro && chapter === undefined) return BOOK_INTRO
      if (app.intros && data?.intro) return CHAPTER_INTRO
      return data?.verses[0]?.verse ?? 1
    }
    const kept = placeOf(person, book, app.id)
    const place =
      chapter !== undefined
        ? { chapter, verse: startOf(chapter) }
        : kept && chapterOf(book, kept.chapter)
          ? kept
          : { chapter: chapters[0], verse: startOf(chapters[0]) }
    setPosition({ book, ...place }, app.id)
  }
  const [text, setText] = useState('TPL')

  const setProjects = (next: Project[]) => {
    setProjectsState(next)
    saveProjects(next)
  }
  const setResume = (r: Resume) => {
    setResumeState(r)
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify(r))
    } catch {
      /* fine for this visit */
    }
  }
  const project = (id: string) => projects.find((p) => p.id === id)
  const openBook = (projectId: string, book: string) => {
    setResume({ projectId, book })
    setScreen({ kind: 'book', projectId, book })
  }
  const setPhase = (projectId: string, book: string, phase: Phase) =>
    setProjects(projects.map((p) => (p.id !== projectId ? p : { ...p, books: p.books.map((b) => (b.code === book ? { ...b, phase } : b)) })))

  const home = () => setScreen({ kind: 'home' })
  // Where home's «Continue» goes: into the mini app last worked in, at its place, in the book last opened; or else the book.
  const resumeApp = resume ? miniApp(lastAppOf(person, resume.book) ?? '') : undefined
  const resumePlace = resume && resumeApp ? placeOf(person, resume.book, resumeApp.id) : null
  const bookScreen = screen.kind === 'book' ? screen : null
  const appScreen = screen.kind === 'app' ? screen : null
  // Back from a mini app: to the one it was opened from, at the place it was left, or else to its book.
  const leaveApp = () => {
    if (!appScreen) return
    const back = appScreen.back
    if (back?.kind === 'app') {
      const place = placeOf(person, back.book, back.id)
      if (place) setPosition({ book: back.book, ...place }, back.id)
    }
    setScreen(back ?? { kind: 'book', projectId: appScreen.projectId, book: appScreen.book })
  }

  // The phone's back button does what the screen's back arrow does, rather than leave the app. The screens are not
  // history of their own: away from home one entry is kept in the browser's history, and when the button takes it
  // the screen goes back and, if still away from home, sets another.
  const goBack = useRef(home)
  goBack.current =
    screen.kind === 'app' ? leaveApp : screen.kind === 'glossary' || screen.kind === 'receive' ? () => setScreen(screen.back) : home
  const armed = useRef(false)
  const skip = useRef(false)
  useEffect(() => {
    const onPop = () => {
      if (skip.current) {
        skip.current = false
        return
      }
      armed.current = false
      goBack.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    try {
      if (screen.kind !== 'home' && !armed.current) {
        history.pushState({ servos: true }, '')
        armed.current = true
      } else if (screen.kind === 'home' && armed.current) {
        // Home by its own arrow: the entry kept is taken back, so the next press of the button leaves as it should.
        armed.current = false
        skip.current = true
        history.back()
      }
    } catch {
      /* a frame that refuses history: the arrows still work */
    }
  }, [screen])

  return (
    <>
      {screen.kind === 'home' && (
        <Home
          projects={projects}
          person={person}
          resume={resume}
          resumeAt={
            resume && resumeApp
              ? `${t(`${resumeApp.id}.nombre`)} · ${resumePlace ? placeLabel(t, bookName(resume.book), resumePlace) : bookName(resume.book)}`
              : null
          }
          progressOf={(p, code) => {
            const b = p.books.find((x) => x.code === code)
            return b ? stepPercent(p, code, b.phase) : null
          }}
          onResume={(r) => {
            if (!resumeApp || !project(r.projectId)) return openBook(r.projectId, r.book)
            openAt(r.book, resumeApp)
            setScreen({ kind: 'app', projectId: r.projectId, book: r.book, id: resumeApp.id })
          }}
          onAddProject={() => setAddProject(true)}
          onBook={openBook}
          onAddBook={setAddBookFor}
          onSettings={(projectId) => setScreen({ kind: 'settings', projectId })}
          onPersonMenu={() => setPersonMenu(true)}
        />
      )}

      {screen.kind === 'newProject' && (
        <NewProject
          existing={projects}
          onCancel={home}
          onCreate={(p) => {
            setProjects([...projects, p])
            home()
            setAddBookFor(p.id)
          }}
        />
      )}

      {bookScreen && project(bookScreen.projectId) && (
        <BookScreen
          project={project(bookScreen.projectId)!}
          book={project(bookScreen.projectId)!.books.find((b) => b.code === bookScreen.book)!}
          chapters={chaptersFor(bookScreen.book)}
          onBack={home}
          lastApp={lastAppOf(person, bookScreen.book)}
          placeFor={(app) => placeOf(person, bookScreen.book, app)}
          onOpen={(app, chapter) => {
            keepLastApp(person, bookScreen.book, app.id)
            openAt(bookScreen.book, app, chapter)
            setScreen({ kind: 'app', projectId: bookScreen.projectId, book: bookScreen.book, id: app.id })
          }}
          onPhase={(phase) => setPhase(bookScreen.projectId, bookScreen.book, phase)}
          onReceive={() => setScreen({ kind: 'receive', back: bookScreen })}
          onGlossary={() => setScreen({ kind: 'glossary', projectId: bookScreen.projectId, back: bookScreen })}
        />
      )}

      {screen.kind === 'glossary' && project(screen.projectId) && (
        <GlossaryScreen project={project(screen.projectId)!} onBack={() => setScreen(screen.back)} />
      )}

      {appScreen && miniApp(appScreen.id) && position.book === appScreen.book && chapterOf(appScreen.book, position.chapter) && (
        <MiniAppScreen
          app={miniApp(appScreen.id)!}
          data={chapterOf(appScreen.book, position.chapter)!}
          chapters={chaptersOf(appScreen.book)}
          dataOf={(chapter) => chapterOf(appScreen.book, chapter)}
          person={person}
          project={project(appScreen.projectId)!}
          position={position}
          onPosition={setPosition}
          textAbbreviation={text}
          onTextAbbreviation={setText}
          onBack={leaveApp}
          backLabel={appScreen.back?.kind === 'app' && miniApp(appScreen.back.id) ? t('marco.volverA', { app: t(`${appScreen.back.id}.nombre`) }) : undefined}
          onOpenApp={(id, at) => {
            setPosition(at, id)
            setScreen({ kind: 'app', projectId: appScreen.projectId, book: appScreen.book, id, back: appScreen })
          }}
        />
      )}

      {screen.kind === 'settings' && project(screen.projectId) && (
        <ProjectSettings
          project={project(screen.projectId)!}
          onBack={home}
          onSave={(p) => {
            setProjects(projects.map((x) => (x.id === p.id ? p : x)))
            home()
          }}
        />
      )}

      {screen.kind === 'receive' && <ReceivePack onBack={() => setScreen(screen.back)} onStudy={() => setScreen(screen.back)} />}
      {screen.kind === 'translate' && <TranslateUi onBack={home} />}

      {addProject && (
        <AddProjectSheet
          onClose={() => setAddProject(false)}
          onBible={() => {
            setAddProject(false)
            setScreen({ kind: 'newProject' })
          }}
          onReceive={() => {
            setAddProject(false)
            setScreen({ kind: 'receive', back: { kind: 'home' } })
          }}
        />
      )}

      {addBookFor && project(addBookFor) && (
        <AddBookSheet
          project={project(addBookFor)!}
          onClose={() => setAddBookFor(null)}
          onCreate={(code) => {
            const id = addBookFor
            setProjects(projects.map((p) => (p.id === id ? { ...p, books: [...p.books, { code, phase: 'estudio' }] } : p)))
            setAddBookFor(null)
            openBook(id, code)
          }}
        />
      )}

      {personMenu && (
        <PersonMenu
          person={person}
          onClose={() => setPersonMenu(false)}
          onPerson={(name) => {
            setPerson(name)
            setPersonMenu(false)
          }}
          onReceive={() => {
            setPersonMenu(false)
            setScreen({ kind: 'receive', back: { kind: 'home' } })
          }}
          onLanguage={() => {
            setPersonMenu(false)
            setLanguage(true)
          }}
          onTranslate={() => {
            setPersonMenu(false)
            setScreen({ kind: 'translate' })
          }}
        />
      )}
      {language && <Language onClose={() => setLanguage(false)} />}
    </>
  )
}
