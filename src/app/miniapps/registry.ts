/**
 * The one registry of mini apps. Registering one also registers its texts, so the interface translator lists them
 * under its name. A project chooses, for each step, which of them it uses (`Project.miniApps`).
 */

import { registerTexts } from '../i18n/i18n'
import type { Phase } from '../projects/model'
import type { MiniApp } from './contract'
import { editor } from './editor/editor'
import { estudio } from './estudio/estudio'
import { revisor } from './revisor/revisor'
import { revisorNotas } from './revisorNotas/revisorNotas'
import { revisorPalabras } from './revisorPalabras/revisorPalabras'
import { comunitaria, editorVoz, publicar, revisorAlineacion } from './soon'

const apps: MiniApp[] = []

export function registerMiniApp(app: MiniApp) {
  if (apps.some((a) => a.id === app.id)) throw new Error(`Ya hay una mini app «${app.id}»`)
  registerTexts(app.id, app.texts)
  apps.push(app)
}

export function miniApps(): readonly MiniApp[] {
  return apps
}

export function miniApp(id: string): MiniApp | undefined {
  return apps.find((a) => a.id === id)
}

/** Every mini app that can serve a step, for the project's settings. */
export function miniAppsFor(phase: Phase): MiniApp[] {
  return apps.filter((a) => a.phase === phase)
}

for (const app of [estudio, editor, editorVoz, revisorNotas, revisorPalabras, revisorAlineacion, revisor, comunitaria, publicar]) {
  registerMiniApp(app)
}
