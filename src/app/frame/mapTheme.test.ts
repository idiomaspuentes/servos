import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIGHT_REFERENCE, LIGHT_THEME } from '@bt-synergy/language-pack-client'
import { mapTheme } from './mapTheme'

const style = (vars: Record<string, string>) => ({ getPropertyValue: (name: string) => vars[name] ?? '' })

describe('mapTheme', () => {
  it('reads each colour from its variable, trimmed', () => {
    const theme = mapTheme(
      style({
        '--map-sea': ' #10222c ',
        '--map-point-hollow': '#f1ece0',
        '--map-cluster-text': '#0c1316',
        '--map-reference-label': '#b5bcc0',
        '--map-halo': '#0c1316',
      }),
    )
    expect(theme.sea).toBe('#10222c')
    expect(theme.pointHollow).toBe('#f1ece0')
    expect(theme.clusterText).toBe('#0c1316')
    expect(theme.referenceLabel).toBe('#b5bcc0')
    expect(theme.halo).toBe('#0c1316')
  })

  it('takes the light theme for a variable the page lacks', () => {
    expect(mapTheme(style({}))).toEqual({ ...LIGHT_THEME, ...LIGHT_REFERENCE })
    expect(mapTheme(style({ '--map-land': '#fff' })).sea).toBe(LIGHT_THEME.sea)
  })
})

describe('styles.css', () => {
  it('gives every map colour a value in the light, the system dark, the dark and the sun theme', () => {
    const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8')
    for (const token of Object.keys(mapTheme(style({}))).map((k) => `--map-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`)) {
      expect(css.split(`${token}:`).length - 1, token).toBe(4)
    }
  })
})
