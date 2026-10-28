import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { keepAppOffline } from './frame/appUpdate'
import { KeepGoing, LastResort } from './frame/Crashed'
import { keepBrowserMenuToText, receiveOpenedFiles } from './frame/desktop'
import { followTheme, keepBackButton, receiveArrivingFiles } from './frame/phone'
import { applyTheme, themeOf } from './frame/theme'
import { moveAlignmentsIn, moveBooksToProjects, openBooks } from './projects/bookText'
import { openLibrary } from './projects/library'
import { openPacksInside } from './projects/packsInside'
import { loadProjects } from './projects/model'
import { moveWorkToProjects } from './projects/scope'
import { I18nProvider } from './i18n/i18n'
import { startOnline } from '../resources/online/onlineResources'
import { watchOnline } from '../resources/online/watchOnline'
import './miniapps/registry'
// The app's letters, inside it so they are there without internet: Onest for the interface, Charis SIL for the scripture.
import './fonts.css'
import './styles.css'
// What a wide window changes (principle 13), after the phone's sheet so it wins where they meet.
import './wide.css'

// Before the first paint: a person who chose light or dark does not see the other one flash.
applyTheme(themeOf())

// Installed, the app opens without internet: all of it is kept on the phone at the first visit.
keepAppOffline()

// In the app for computers: a file opened on the computer goes to be received, and the browser's menu stays away.
receiveOpenedFiles()
keepBrowserMenuToText()
// In the app for phones: a file opened with Servos or shared to it goes to be received, and the back button goes back.
receiveArrivingFiles()
keepBackButton()
// …and the phone's bars write in the colour the app's ground wants, whatever theme the person chose.
followTheme()

// The books kept on this device are opened (and the prototype's verse-by-verse text moved in) before anything shows.
void openBooks()
  .then(() => {
    // Work kept by the book alone (before each project kept its own) goes to each project that has the book, once.
    const projects = loadProjects()
    moveBooksToProjects(projects)
    moveWorkToProjects(projects)
    // Alignments kept verse by verse go into their book's alignment layer, once.
    moveAlignmentsIn()
    // What the language packs left on this device; the projects' books are then read from it in the background.
    // …and, in the apps for phones and computers, the texts and helps they bring are opened the first time.
    // Then Servos online (spec §4), after those packs, so it plans from what they left: B's heal and a check, and a
    // check again whenever the app comes back into view or the connection comes back. The projects are read again
    // then: the person may have changed them while the packs opened.
    return openLibrary(projects).then(() => {
      const online = () => {
        void startOnline(loadProjects())
        watchOnline()
      }
      void openPacksInside().then(online, online)
    })
  })
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <LastResort>
          <I18nProvider>
            <KeepGoing>
              <App />
            </KeepGoing>
          </I18nProvider>
        </LastResort>
      </StrictMode>
    )
  )
