/**
 * The project's font (its settings: Charis SIL, Andika, Gentium Plus, Noto Sans), loaded when a project uses it. In
 * the prototype from Google Fonts, one family a request so one missing does not keep the others away; without
 * internet the system's font is used. Wired, the fonts come inside the app, to work offline.
 */

import { useEffect } from 'react'

const asked = new Set<string>()

export function loadFont(font: string | undefined) {
  if (!font || asked.has(font) || typeof document === 'undefined') return
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
