/**
 * The prototype: projects and their books (as translationCore 4 makes them), each book's steps, the mini apps in
 * their frame, receiving a pack, and the interface translator.
 */

import { useState } from 'react'
import { TITO_1 } from '../prototype/data'
import { MiniAppScreen } from './frame/MiniAppScreen'
import type { Position } from './miniapps/contract'
import { miniApp } from './miniapps/registry'
import { loadProjects, saveProjects, type Phase, type Project } from './projects/model'
import { AddBookSheet } from './screens/AddBook'
import { BookScreen } from './screens/BookScreen'
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
  | { kind: 'app'; projectId: string; book: string; id: string }
  | { kind: 'settings'; projectId: string }
  | { kind: 'receive'; back: Screen }
  | { kind: 'translate' }

/** The prototype has the texts and helps of Titus 1 only. */
const dataFor = (book: string) => (book === TITO_1.book.id ? TITO_1 : null)

const RESUME_KEY = 'servos.prototipo.seguir'
function loadResume(): Resume | null {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null') ?? { projectId: 'biblia-kichwa', book: 'tit' }
  } catch {
    return { projectId: 'biblia-kichwa', book: 'tit' }
  }
}

export function App() {
  const [projects, setProjectsState] = useState<Project[]>(loadProjects)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [resume, setResumeState] = useState<Resume | null>(loadResume)
  const [person, setPerson] = useState(PEOPLE[0])
  const [personMenu, setPersonMenu] = useState(false)
  const [language, setLanguage] = useState(false)
  const [addProject, setAddProject] = useState(false)
  const [addBookFor, setAddBookFor] = useState<string | null>(null)
  const [position, setPosition] = useState<Position>({ book: TITO_1.book.id, chapter: TITO_1.chapter, verse: 1 })
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
  const bookScreen = screen.kind === 'book' ? screen : null
  const appScreen = screen.kind === 'app' ? screen : null

  return (
    <>
      {screen.kind === 'home' && (
        <Home
          projects={projects}
          person={person}
          resume={resume}
          onResume={(r) => openBook(r.projectId, r.book)}
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
          data={dataFor(bookScreen.book)}
          onBack={home}
          onOpen={(app) => setScreen({ kind: 'app', projectId: bookScreen.projectId, book: bookScreen.book, id: app.id })}
          onPhase={(phase) => setPhase(bookScreen.projectId, bookScreen.book, phase)}
          onReceive={() => setScreen({ kind: 'receive', back: bookScreen })}
        />
      )}

      {appScreen && miniApp(appScreen.id) && dataFor(appScreen.book) && (
        <MiniAppScreen
          app={miniApp(appScreen.id)!}
          data={dataFor(appScreen.book)!}
          person={person}
          position={position}
          onPosition={setPosition}
          textAbbreviation={text}
          onTextAbbreviation={setText}
          onBack={() => setScreen({ kind: 'book', projectId: appScreen.projectId, book: appScreen.book })}
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
