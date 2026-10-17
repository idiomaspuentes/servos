/**
 * The project's font (its settings: Charis SIL, Andika, Gentium Plus, Noto Sans), loaded when a project uses it.
 * Charis SIL, the default, comes inside the app (fonts.css), so it is there without internet. The others still come
 * from Google Fonts, one family a request so one missing does not keep the others away; without internet the system's
 * font is used until they are bundled too.
 */

import { useEffect } from 'react'

/** Families inside the app: never asked of Google. */
const BUNDLED = new Set(['Charis SIL'])
const asked = new Set<string>()

export function loadFont(font: string | undefined) {
  if (!font || BUNDLED.has(font) || asked.has(font) || typeof document === 'undefined') return
  asked.add(font)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400&display=swap`
  document.head.appendChild(link)
}

/**
 * What the team writes is shown in the project's font, the rest in the app's: set on the whole page (`--project-font`),
 * so the sheets, drawn outside the screen, have it too.
 */
export function useProjectFont(font: string | undefined) {
  useEffect(() => {
    loadFont(font)
    const root = document.documentElement.style
    if (font) root.setProperty('--project-font', `'${font}', var(--font)`)
    else root.removeProperty('--project-font')
  }, [font])
}
