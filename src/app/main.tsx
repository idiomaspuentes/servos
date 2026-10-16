import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyTheme, themeOf } from './frame/theme'
import { openBooks } from './projects/bookText'
import { I18nProvider } from './i18n/i18n'
import './miniapps/registry'
import './styles.css'

// Before the first paint: a person who chose light or dark does not see the other one flash.
applyTheme(themeOf())

// The books kept on this device are opened (and the prototype's verse-by-verse text moved in) before anything shows.
void openBooks().finally(() =>
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
)
)
