import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { keepAppOffline } from './frame/appUpdate'
import { KeepGoing, LastResort } from './frame/Crashed'
import { applyTheme, themeOf } from './frame/theme'
import { moveAlignmentsIn, moveBooksToProjects, openBooks } from './projects/bookText'
import { loadProjects } from './projects/model'
import { moveWorkToProjects } from './projects/scope'
import { I18nProvider } from './i18n/i18n'
import './miniapps/registry'
// The app's own letters, inside the app so they are there without internet (Latin and its extensions; others fall
// back to the system's).
import '@fontsource-variable/figtree/wght.css'
import '@fontsource-variable/figtree/wght-italic.css'
import './styles.css'

// Before the first paint: a person who chose light or dark does not see the other one flash.
applyTheme(themeOf())

// Installed, the app opens without internet: all of it is kept on the phone at the first visit.
keepAppOffline()

// The books kept on this device are opened (and the prototype's verse-by-verse text moved in) before anything shows.
void openBooks()
  .then(() => {
    // Work kept by the book alone (before each project kept its own) goes to each project that has the book, once.
    const projects = loadProjects()
    moveBooksToProjects(projects)
    moveWorkToProjects(projects)
    // Alignments kept verse by verse go into their book's alignment layer, once.
    moveAlignmentsIn()
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
