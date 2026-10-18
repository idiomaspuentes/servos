/**
 * Light, dark or sun, as the person chooses on this phone, or as the phone has it (the default). The styles already
 * read `data-theme` on the root; choosing sets it, and «as the phone» leaves the root as it was, so a page that sets
 * the theme from outside (the prototype shared inside Claude) keeps its own. Sun is for reading outdoors in bright
 * light: more contrast and heavier letters (styles.css).
 */

export type Theme = 'sistema' | 'claro' | 'oscuro' | 'sol'

const KEY = 'servos.prototipo.apariencia'
/** Marks a data-theme this app set, so it removes only its own. */
const MINE = 'data-servos-theme'
const ATTRIBUTE: Record<Exclude<Theme, 'sistema'>, string> = { claro: 'light', oscuro: 'dark', sol: 'sun' }

export function themeOf(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'claro' || v === 'oscuro' || v === 'sol' ? v : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'sistema') {
    if (root.hasAttribute(MINE)) {
      root.removeAttribute('data-theme')
      root.removeAttribute(MINE)
    }
    return
  }
  root.setAttribute('data-theme', ATTRIBUTE[theme])
  root.setAttribute(MINE, '')
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'sistema') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    /* chosen for this visit */
  }
  applyTheme(theme)
}
