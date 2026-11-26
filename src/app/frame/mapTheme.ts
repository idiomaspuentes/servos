/**
 * The colours of a map from the app's theme. `drawMap` writes literal colours into its SVG, so the tokens (`--map-sea`,
 * `--map-land`... in styles.css, one value per theme) are read from the computed style, and the map is drawn again when
 * the theme changes (`PlaceMap`).
 */
import { LIGHT_REFERENCE, LIGHT_THEME, type Theme } from '@bt-synergy/language-pack-client'

/** The `Theme` field of each token: `--map-point-hollow` is `pointHollow`. */
const TOKENS: [keyof Theme, string][] = [
  ['sea', '--map-sea'],
  ['land', '--map-land'],
  ['coast', '--map-coast'],
  ['lake', '--map-lake'],
  ['river', '--map-river'],
  ['route', '--map-route'],
  ['point', '--map-point'],
  ['pointHollow', '--map-point-hollow'],
  ['label', '--map-label'],
  ['halo', '--map-halo'],
  ['cluster', '--map-cluster'],
  ['clusterText', '--map-cluster-text'],
  ['reference', '--map-reference'],
  ['referenceLabel', '--map-reference-label'],
]

const FALLBACK: Theme = { ...LIGHT_THEME, ...LIGHT_REFERENCE }

/** The theme the page shows now; a variable it does not have takes the light theme's value. */
export function mapTheme(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>): Theme {
  const out = { ...FALLBACK }
  for (const [field, token] of TOKENS) {
    const value = style.getPropertyValue(token).trim()
    if (value) out[field] = value
  }
  return out
}

/** The map's theme for the document as it is now. */
export const currentMapTheme = (): Theme => mapTheme(getComputedStyle(document.documentElement))

/**
 * The width of a label in the app's own letters, for `drawMap` to keep names apart. Without a canvas (a test, an old
 * WebView) it is undefined, and `drawMap` estimates.
 */
export function measureText(fontSize: number): ((text: string) => number) | undefined {
  if (typeof document === 'undefined') return undefined
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return undefined
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  context.font = `${fontSize}px ${family}`
  return (text) => context.measureText(text).width
}
