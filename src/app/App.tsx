/**
 * The prototype: projects and their books (as translationCore 4 makes them), each book's steps, the mini apps in
 * their frame, receiving a pack, and the interface translator.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { chapterOf, chaptersOf } from '../prototype/data'
import { usePrimaryKey } from './frame/keys'
import { MiniAppScreen } from './frame/MiniAppScreen'
import { useT } from './i18n/i18n'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type Position } from './miniapps/contract'
import { miniApp } from './miniapps/registry'
import { EXAMPLE_PROJECT_ID, PHASES, exampleProject, loadProjects, saveProjects, titleOf, type Phase, type Project } from './projects/model'
import { inProject, setProject } from './projects/scope'
import { bookState, languageOf, libraryVersion, loadBook, setProjects as setLibraryProjects, subscribeLibrary } from './projects/library'
import { firstUndone, placeLabel, stepPercent } from './projects/progress'
import { keepLastApp, keepPlace, lastAppOf, placeOf } from './projects/work'
import { AddBookSheet } from './screens/AddBook'
import { BookScreen } from './screens/BookScreen'
import { GatherScreen } from './screens/GatherScreen'
import { TeamWorkScreen } from './screens/TeamWorkScreen'
import { keepCopying } from './frame/copies'
import { keepCopyingToDoor43 } from './frame/door43Copy'
import { accountOf, forgetAccount } from './projects/door43'
import { CopiesSheet } from './screens/CopiesSheet'
import { closeTopSheet, onSheets } from './frame/Sheet'
import { GlossaryScreen } from './screens/GlossaryScreen'
import { Home, type Resume } from './screens/Home'
import { Language, TestModeBar } from './screens/Language'
import { AddProjectSheet, NewProject } from './screens/NewProject'
import { PersonMenu } from './screens/PersonMenu'
import { AboutSheet } from './screens/AboutSheet'
import { Door43AccountSheet } from './screens/Door43Account'
import { Welcome } from './screens/Welcome'
import { EXAMPLE_PEOPLE, addPerson, loadPeople, savePeople, type People } from './projects/people'
import { ProjectSettings } from './screens/ProjectSettings'
import { ReceivePack } from './screens/ReceivePack'
import { ReceiveScreen } from './screens/ReceiveScreen'
import { exampleShared } from './screens/exampleWork'
import { TranslateUi } from './screens/TranslateUi'
import { WaitingSheet } from './screens/WaitingSheet'
import { isOnline, useWaiting, whenNotTyping } from './frame/online'
import { switchToNewVersion, useNewVersion } from './frame/appUpdate'
import { onArrived, useDroppedFiles } from './frame/arriving'
import { waiting } from './projects/outbox'

type Screen =
  | { kind: 'home' }
  | { kind: 'newProject' }
  /** `step`: a step of the book open on its own screen (on a phone; a wide window shows one beside the steps). */
  | { kind: 'book'; projectId: string; book: string; step?: Phase }
  | { kind: 'app'; projectId: string; book: string; id: string; back?: Screen }
  | { kind: 'settings'; projectId: string }
  | { kind: 'glossary'; projectId: string; back: Screen; entry?: string }
  | { kind: 'receive'; back: Screen }
  /** `opened`: a file opened on the computer or dropped on the window, read at once (`n` tells one from the next). */
  | { kind: 'recibir'; back: Screen; projectId?: string; book?: string; opened?: { text: string; n: number } }
  | { kind: 'translate' }
  | { kind: 'elegir'; projectId: string; book: string; back: Screen }
  /** `bring`: opened to bring in the team's work at once (asked without internet, and said yes to when it came). */
  | { kind: 'equipo'; projectId: string; book: string; back: Screen; bring?: boolean; password?: boolean }

/** The chapters of a book whose texts and helps the prototype has (every chapter of Titus and Jonah). */
const chaptersFor = (book: string) => chaptersOf(book).map((c) => chapterOf(book, c)!)

const RESUME_KEY = 'servos.prototipo.seguir'
function loadResume(): Resume | null {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function App() {
  const t = useT()
  // Ctrl+Enter does what the filled button of what is on top does, on every screen (principle 13).
  usePrimaryKey()
  const [projects, setProjectsState] = useState<Project[]>(loadProjects)
  // The books read from this device (projects/library.ts): a book read, or a pack opened, draws the screens again.
  const read = useSyncExternalStore(subscribeLibrary, libraryVersion)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  // The project the screen belongs to is the one whose work is read and written (scope.ts); home belongs to none.
  setProject('projectId' in screen ? (screen.projectId ?? null) : null)
  const [resume, setResumeState] = useState<Resume | null>(loadResume)
  // Who uses this phone, and who is working now: kept, since every change carries the name. Null the first time.
  const [people, setPeopleState] = useState<People | null>(loadPeople)
  const setPeople = (next: People) => {
    setPeopleState(next)
    savePeople(next)
  }
  const person = people?.current ?? EXAMPLE_PEOPLE[0]
  const setPerson = (name: string) => people && setPeople({ ...people, current: name })
  const [personMenu, setPersonMenu] = useState(false)
  const [about, setAbout] = useState(false)
  const [copiesSheet, setCopiesSheet] = useState(false)
  // A copy on the memory card, while someone works (frame/copies.ts): who is working is read when it is made.
  const working = useRef<string | null>(null)
  working.current = people ? person : null
  useEffect(() => keepCopying(() => working.current), [])
  // A copy on Door43 too, when there is internet and the person chose it (frame/door43Copy.ts).
  useEffect(() => keepCopyingToDoor43(() => working.current), [])
  // What waited for internet (design 6.11): shown when internet comes, or when the app opens with it, before anything
  // goes; not while something is being typed. «Not now» holds until internet comes again.
  const waits = useWaiting(person)
  // A new version of the app, kept and waiting: said on home, used when the person says so.
  const newVersion = useNewVersion()
  const [asking, setAsking] = useState(false)
  const declined = useRef(false)
  useEffect(() => {
    declined.current = false
    let cancel = () => {}
    const check = () => {
      cancel()
      if (!isOnline() || declined.current || !waiting(person).length) return
      cancel = whenNotTyping(() => setAsking(true))
    }
    const online = () => {
      declined.current = false
      check()
    }
    window.addEventListener('online', online)
    check()
    return () => {
      window.removeEventListener('online', online)
      cancel()
    }
  }, [person])
  const [door43, setDoor43] = useState(false)
  // Linking again (the key kept no longer works): on the Door43 it was on.
  const [relinkHost, setRelinkHost] = useState<string | undefined>(undefined)
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
    setLibraryProjects(next)
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
    // The book opened is read before the others still waiting.
    void loadBook(book, languageOf(projectId))
  }
  // A mini app whose book is not read (still being read, or read anew after a pack was opened): its book, which says
  // how it stands, instead of an empty screen.
  useEffect(() => {
    if (screen.kind === 'app' && !inProject(screen.projectId, () => chaptersOf(screen.book).length)) {
      setScreen({ kind: 'book', projectId: screen.projectId, book: screen.book })
    }
  }, [screen, read])

  const home = () => setScreen({ kind: 'home' })
  // Where home's «Continue» goes: into the mini app last worked in, at its place, in the book last opened; or else the book.
  const resumeApp = resume ? miniApp(inProject(resume.projectId, () => lastAppOf(person, resume.book)) ?? '') : undefined
  const resumePlace =
    resume && resumeApp && resumeApp.positionLine !== false ? inProject(resume.projectId, () => placeOf(person, resume.book, resumeApp.id)) : null
  // Left with «Done» at the book's end: «Continue» goes to what is left of that mini app, or once it is all done, to
  // the project's first mini app with work left (in the steps' order: offered, not imposed; the book opens any).
  const resumeNext = (() => {
    if (!resume || !resumeApp || !resumePlace?.finished) return null
    const p = project(resume.projectId)
    if (!p) return null
    return inProject(resume.projectId, () => {
      const left = firstUndone(resumeApp, resume.book)
      if (left) return { app: resumeApp, place: left }
      const next = PHASES.flatMap((phase) => p.miniApps[phase])
        .map((id) => miniApp(id))
        .find((a): a is MiniApp => Boolean(a && !a.comingSoon && a !== resumeApp && !(a.done && !firstUndone(a, resume.book))))
      return next ? { app: next, place: null } : null
    })
  })()
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
    // A step open on a phone goes back to its book's steps; in a wide window the steps are beside it, so the book goes home.
    screen.kind === 'book' && screen.step && !window.matchMedia('(min-width: 900px)').matches
      ? () => setScreen({ kind: 'book', projectId: screen.projectId, book: screen.book })
      : screen.kind === 'app' ? leaveApp : screen.kind === 'glossary' || screen.kind === 'receive' || screen.kind === 'recibir' || screen.kind === 'elegir' || screen.kind === 'equipo' ? () => setScreen(screen.back) : home
  const armed = useRef(false)
  // An entry kept for a sheet open on home (home keeps none of its own).
  const sheetEntry = useRef(false)
  const away = useRef(false)
  away.current = screen.kind !== 'home'
  const skip = useRef(false)
  useEffect(() => {
    const onPop = () => {
      if (skip.current) {
        skip.current = false
        return
      }
      // A sheet open (a menu, a list, an article) is what the button closes first, as on any phone: the screen stays,
      // and its entry is set again for the next press.
      const sheet = closeTopSheet()
      if (sheet === 'asked') {
        // It asked before closing, and stays: its entry is set again for the next press.
        history.pushState({ servos: true }, '')
        armed.current = true
        return
      }
      if (sheet === 'closed') {
        if (away.current) {
          history.pushState({ servos: true }, '')
          armed.current = true
        } else {
          // Home's entry for the sheet was the one taken: nothing to take back when it closes.
          armed.current = false
          sheetEntry.current = false
        }
        return
      }
      armed.current = false
      goBack.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // On home, a sheet opened keeps an entry, so the back button closes it instead of leaving the app; closed by its own
  // button, the entry is taken back. Away from home the screen's entry serves.
  useEffect(
    () =>
      onSheets((count) => {
        try {
          if (away.current) {
            sheetEntry.current = false
          } else if (count > 0 && !armed.current) {
            history.pushState({ servos: true }, '')
            armed.current = true
            sheetEntry.current = true
          } else if (count === 0 && sheetEntry.current) {
            sheetEntry.current = false
            armed.current = false
            skip.current = true
            history.back()
          }
        } catch {
          /* a frame that refuses history: the sheet still closes by its button */
        }
      }),
    []
  )
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

  // A file opened on the computer, or dropped on the window (frame/arriving.ts): «Receive» opens with it, read, over
  // whatever was on screen, which is where its back arrow returns. It waits while nobody has said who they are.
  const [arrived, setArrived] = useState<{ text: string; n: number } | null>(null)
  const arrivals = useRef(0)
  useEffect(() => onArrived((file) => setArrived({ text: file.text, n: ++arrivals.current })), [])
  const dropping = useDroppedFiles()
  useEffect(() => {
    if (!arrived || !people) return
    // What was open on top goes: what arrived is what the person is doing now.
    setPersonMenu(false)
    setAddProject(false)
    setAddBookFor(null)
    setDoor43(false)
    setLanguage(false)
    setScreen((now) => ({ kind: 'recibir', back: now.kind === 'recibir' ? now.back : now, opened: arrived }))
    setArrived(null)
  }, [arrived, people])

  if (!people) {
    return (
      <>
        <TestModeBar />
        <Welcome
          onStart={(name, example) => {
            if (example) {
              // The example's team, its project, and Titus to go on with.
              setPeople({ names: EXAMPLE_PEOPLE, current: name })
              if (!projects.some((p) => p.id === EXAMPLE_PROJECT_ID)) setProjects([...projects, exampleProject()])
              setResume({ projectId: EXAMPLE_PROJECT_ID, book: 'tit' })
            } else {
              setPeople(addPerson(null, name))
              // Kept as they are (none, the first time), so that the example does not come back with the next visit.
              setProjects(projects)
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      <TestModeBar />
      {screen.kind === 'home' && (
        <Home
          projects={projects}
          person={person}
          resume={resume}
          resumeAt={
            resumeNext
              ? resumeNext.place
                ? `${t(`${resumeNext.app.id}.nombre`)} · ${placeLabel(t, titleOf(project(resume!.projectId), resume!.book), resumeNext.place)}`
                : null
              : resume && resumeApp
                ? `${t(`${resumeApp.id}.nombre`)} · ${resumePlace ? placeLabel(t, titleOf(project(resume.projectId), resume.book), resumePlace) : titleOf(project(resume.projectId), resume.book)}`
                : null
          }
          finished={resumeNext && !resumeNext.place && resumeApp ? { done: t(`${resumeApp.id}.nombre`), next: t(`${resumeNext.app.id}.nombre`) } : null}
          workOn={(p, code) =>
            // The person's own: the step of the mini app they last worked in on the book, and how far it has gone.
            inProject(p.id, () => {
              const app = miniApp(lastAppOf(person, code) ?? '')
              const step = app?.phase ?? PHASES[0]
              return { step, pct: stepPercent(p, code, step), begun: Boolean(app) }
            })
          }
          onResume={(r) => {
            const app = resumeNext?.app ?? resumeApp
            if (!app || !project(r.projectId) || !inProject(r.projectId, () => chaptersOf(r.book).length)) return openBook(r.projectId, r.book)
            inProject(r.projectId, () => {
              keepLastApp(person, r.book, app.id)
              if (resumeNext?.place) setPosition({ book: r.book, ...resumeNext.place }, app.id)
              else openAt(r.book, app)
            })
            setScreen({ kind: 'app', projectId: r.projectId, book: r.book, id: app.id })
          }}
          onAddProject={() => setAddProject(true)}
          onBook={openBook}
          onAddBook={setAddBookFor}
          onSettings={(projectId) => setScreen({ kind: 'settings', projectId })}
          onPersonMenu={() => setPersonMenu(true)}
          onCopies={() => setCopiesSheet(true)}
          onDoor43={(relink) => {
            const account = accountOf(person)
            if (relink && account) {
              forgetAccount(person)
              setRelinkHost(account.host)
            }
            setDoor43(true)
          }}
          waiting={waits}
          onSendWaiting={() => setAsking(true)}
        />
      )}

      {screen.kind === 'home' && newVersion && (
        <div className="status app-update" role="status">
          <span>{t('marco.nuevaVersion')}</span>
          <button type="button" className="chip" onClick={switchToNewVersion}>
            {t('marco.usarAhora')}
          </button>
        </div>
      )}

      {dropping && (
        <div className="drop-here" role="status">
          {t('recibir.soltar')}
        </div>
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
          state={bookState(bookScreen.book)}
          onBack={home}
          lastApp={lastAppOf(person, bookScreen.book)}
          placeFor={(app) => placeOf(person, bookScreen.book, app)}
          onOpen={(app, chapter) => {
            keepLastApp(person, bookScreen.book, app.id)
            openAt(bookScreen.book, app, chapter)
            // Back from it to where it was opened: the book, or the step's screen.
            setScreen({ kind: 'app', projectId: bookScreen.projectId, book: bookScreen.book, id: app.id, back: bookScreen })
          }}
          step={bookScreen.step}
          onStep={(step) => setScreen({ kind: 'book', projectId: bookScreen.projectId, book: bookScreen.book, ...(step ? { step } : {}) })}
          onTogether={(on) =>
            setProjects(
              projects.map((p) =>
                p.id !== bookScreen.projectId
                  ? p
                  : {
                      ...p,
                      books: p.books.map((b) => {
                        if (b.code !== bookScreen.book) return b
                        const { together: _was, ...rest } = b
                        return on ? { ...rest, together: true } : rest
                      }),
                    }
              )
            )
          }
          onName={(name) =>
            setProjects(
              projects.map((p) =>
                p.id !== bookScreen.projectId ? p : { ...p, books: p.books.map((b) => (b.code === bookScreen.book ? { ...b, name: name.trim() || undefined } : b)) }
              )
            )
          }
          onReceive={() => setScreen({ kind: 'receive', back: bookScreen })}
          onGlossary={() => setScreen({ kind: 'glossary', projectId: bookScreen.projectId, back: bookScreen })}
          onReceiveWork={() => setScreen({ kind: 'recibir', back: bookScreen, projectId: bookScreen.projectId, book: bookScreen.book })}
          onChooseVersions={() => setScreen({ kind: 'elegir', projectId: bookScreen.projectId, book: bookScreen.book, back: bookScreen })}
          onTeamWork={() => setScreen({ kind: 'equipo', projectId: bookScreen.projectId, book: bookScreen.book, back: bookScreen })}
          person={person}
        />
      )}

      {screen.kind === 'glossary' && project(screen.projectId) && (
        <GlossaryScreen
          project={project(screen.projectId)!}
          books={project(screen.projectId)!.books.map((b) => ({ code: b.code, name: titleOf(project(screen.projectId), b.code), chapters: chaptersFor(b.code) }))}
          person={person}
          backLabel={screen.back.kind === 'book' ? titleOf(project(screen.projectId), screen.back.book) : t('marco.volver')}
          openEntry={screen.entry}
          onBack={() => setScreen(screen.back)}
          onOpenVerse={(use, entry) => {
            // The verse opens in the editor; back from it comes to this word of the glossary, still open.
            setPosition({ book: use.book, chapter: use.chapter, verse: use.verse }, 'editor')
            setScreen({ kind: 'app', projectId: screen.projectId, book: use.book, id: 'editor', back: { ...screen, entry } })
          }}
        />
      )}

      {appScreen && miniApp(appScreen.id) && position.book === appScreen.book && chapterOf(appScreen.book, position.chapter) && (
        <MiniAppScreen
          app={miniApp(appScreen.id)!}
          data={chapterOf(appScreen.book, position.chapter)!}
          chapters={chaptersOf(appScreen.book)}
          dataOf={(chapter) => chapterOf(appScreen.book, chapter)}
          person={person}
          project={project(appScreen.projectId)!}
          bookTitle={titleOf(project(appScreen.projectId), appScreen.book)}
          position={position}
          onPosition={setPosition}
          textAbbreviation={text}
          onTextAbbreviation={setText}
          onBack={leaveApp}
          onFinished={() => keepPlace(person, position.book, appScreen.id, { chapter: position.chapter, verse: position.verse, finished: true })}
          backLabel={
            appScreen.back?.kind === 'app' && miniApp(appScreen.back.id)
              ? t('marco.volverA', { app: t(`${appScreen.back.id}.nombre`) })
              : appScreen.back?.kind === 'glossary'
                ? t('glosario.titulo')
                : undefined
          }
          onOpenApp={(id, at) => {
            setPosition(at, id)
            setScreen({ kind: 'app', projectId: appScreen.projectId, book: appScreen.book, id, back: appScreen })
          }}
        />
      )}

      {screen.kind === 'settings' && project(screen.projectId) && (
        <ProjectSettings
          project={project(screen.projectId)!}
          person={person}
          onBack={home}
          onSave={(p) => {
            setProjects(projects.map((x) => (x.id === p.id ? p : x)))
            home()
          }}
        />
      )}

      {screen.kind === 'receive' && (
        <ReceivePack
          onBack={() => setScreen(screen.back)}
          onStudy={() => setScreen(screen.back)}
          onOpenVerse={(projectId, book, chapter, verse) => {
            // A verse whose helps the pack changed opens in the editor; back from it is its book.
            setResume({ projectId, book })
            // The place is kept as the project's: the receiving screen belongs to none.
            inProject(projectId, () => setPosition({ book, chapter, verse }, 'editor'))
            setScreen({ kind: 'app', projectId, book, id: 'editor' })
            void loadBook(book, languageOf(projectId))
          }}
        />
      )}
      {screen.kind === 'recibir' && (
        <ReceiveScreen
          key={screen.opened?.n ?? 0}
          projects={projects}
          person={person}
          preset={screen.projectId}
          opened={screen.opened?.text}
          // Work «to try» from the example's people: only in the example.
          examples={screen.projectId === EXAMPLE_PROJECT_ID && screen.book && project(screen.projectId) ? exampleShared(project(screen.projectId)!, chaptersFor(screen.book)) : []}
          onBack={() => setScreen(screen.back)}
          onReceived={setProjects}
          onGo={(projectId, book) => (book ? openBook(projectId, book) : home())}
          onChoose={(projectId, book) => {
            setResume({ projectId, book })
            setScreen({ kind: 'elegir', projectId, book, back: { kind: 'book', projectId, book } })
          }}
        />
      )}
      {screen.kind === 'translate' && <TranslateUi onBack={home} />}
      {screen.kind === 'equipo' && project(screen.projectId) && (
        <TeamWorkScreen
          key={`${screen.projectId}.${screen.book}.${screen.bring ? 'traer' : ''}${screen.password ? 'contrasena' : ''}`}
          project={project(screen.projectId)!}
          projects={projects}
          book={screen.book}
          title={titleOf(project(screen.projectId), screen.book)}
          person={person}
          bringNow={screen.bring}
          askPassword={screen.password}
          onBack={() => setScreen(screen.back)}
          onReceived={setProjects}
          onGather={() => setScreen({ kind: 'elegir', projectId: screen.projectId, book: screen.book, back: { kind: 'book', projectId: screen.projectId, book: screen.book } })}
        />
      )}
      {screen.kind === 'elegir' && project(screen.projectId) && (
        <GatherScreen
          project={project(screen.projectId)!}
          book={screen.book}
          title={titleOf(project(screen.projectId), screen.book)}
          chapters={chaptersFor(screen.book)}
          textAbbreviation={text}
          person={person}
          onBack={() => setScreen(screen.back)}
        />
      )}

      {addProject && (
        <AddProjectSheet
          onClose={() => setAddProject(false)}
          onBible={() => {
            setAddProject(false)
            setScreen({ kind: 'newProject' })
          }}
          onReceive={() => {
            setAddProject(false)
            setScreen({ kind: 'recibir', back: { kind: 'home' } })
          }}
        />
      )}

      {addBookFor && project(addBookFor) && (
        <AddBookSheet
          project={project(addBookFor)!}
          person={person}
          onClose={() => setAddBookFor(null)}
          onReceive={() => {
            const id = addBookFor
            setAddBookFor(null)
            setScreen({ kind: 'recibir', back: { kind: 'home' }, projectId: id })
          }}
          onCreate={(code, phase = 'estudio') => {
            const id = addBookFor
            // A book already in the project (a USFM file gathered into it) is not added twice.
            setProjects(projects.map((p) => (p.id === id && !p.books.some((b) => b.code === code) ? { ...p, books: [...p.books, { code, phase }] } : p)))
            setAddBookFor(null)
            openBook(id, code)
          }}
        />
      )}

      {personMenu && (
        <PersonMenu
          person={person}
          people={people.names}
          onClose={() => setPersonMenu(false)}
          onPerson={(name) => {
            setPerson(name)
            setPersonMenu(false)
          }}
          onAdd={(name) => {
            setPeople(addPerson(people, name))
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
          onDoor43={() => {
            setPersonMenu(false)
            setDoor43(true)
          }}
          onCopies={() => {
            setPersonMenu(false)
            setCopiesSheet(true)
          }}
          onAbout={() => {
            setPersonMenu(false)
            setAbout(true)
          }}
        />
      )}
      {about && <AboutSheet onClose={() => setAbout(false)} />}
      {copiesSheet && <CopiesSheet person={person} onClose={() => setCopiesSheet(false)} />}
      {door43 && (
        <Door43AccountSheet
          person={person}
          host={relinkHost}
          onClose={() => {
            setDoor43(false)
            setRelinkHost(undefined)
          }}
        />
      )}
      {asking && (
        <WaitingSheet
          errands={waits}
          projects={projects}
          person={person}
          onClose={() => {
            declined.current = true
            setAsking(false)
          }}
          onBring={(projectId, book) => {
            setAsking(false)
            setScreen({ kind: 'equipo', projectId, book, back: { kind: 'book', projectId, book }, bring: true })
          }}
          onTeamPassword={(projectId, book) => {
            setAsking(false)
            setScreen({ kind: 'equipo', projectId, book, back: { kind: 'book', projectId, book }, password: true })
          }}
        />
      )}
      {language && <Language onClose={() => setLanguage(false)} />}
    </>
  )
}
