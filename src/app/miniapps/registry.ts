/**
 * The one registry of mini apps. Registering one also registers its texts, so the interface translator lists them
 * under its name. The order here is the catalog's order.
 */

import { registerTexts } from '../i18n/i18n'
import type { MiniApp } from './contract'
import { editor } from './editor/editor'
import { estudio } from './estudio/estudio'
import { revisor } from './revisor/revisor'

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

for (const app of [estudio, editor, revisor]) registerMiniApp(app)
