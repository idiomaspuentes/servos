/**
 * The project's glossary: the team's decisions on how words of the original are translated, to look up and to share.
 * Every translator adds to it from the editor, on their own computer; here it is shared without internet (a file to
 * pass on, or its text to copy into a message) and gathered from another computer, nothing lost (two renderings of a
 * word stay, one as an alternative, until the team agrees). What is shared is, by default, what changed since the
 * last time: the glossary may grow to thousands of words. A glossary from Taller (its TSV) is received too. Publishing
 * to Door43 puts it in the language's `<lang>_tg` repository, one file a word. Sharing and receiving, used now and then,
 * are in a sheet from «Share» in the header: the list fills the screen.
 */

import { useRef, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useProjectFont } from '../frame/fonts'
import { saveFile } from '../frame/saveFile'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import type { Project } from '../projects/model'
import {
  gatherGlossary,
  glossaryBundle,
  lastShared,
  markShared,
  readBundle,
  readGlossary,
  saveGlossaryEntry,
  type Gathered,
} from '../projects/glossary'
import type { GlossaryUse } from '../projects/glossaryUses'
import { GlossaryEntrySheet } from './GlossaryEntrySheet'

export function GlossaryScreen({
  project,
  books,
  person,
  backLabel,
  openEntry,
  onBack,
  onOpenVerse,
}: {
  project: Project
  /** The project's books whose texts are on this phone: where each word is looked for. */
  books: Array<{ code: string; chapters: PrototypeData[] }>
  person: string
  /** Where «‹» goes back to, named. */
  backLabel: string
  /** The entry open when coming back from a verse opened from it. */
  openEntry?: string
  onBack(): void
  /** Opens a verse in the editor, from an entry; `entry` is reopened on coming back. */
  onOpenVerse(use: GlossaryUse, entry: string): void
}) {
  const t = useT()
  const [entries, setEntries] = useState(() => readGlossary(project.id))
  const [search, setSearch] = useState('')
  const [said, setSaid] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [open, setOpen] = useState<string | null>(openEntry ?? null)
  const opened = entries.find((e) => e.id === open)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const fileName = `${project.languageCode || 'proyecto'}_tg.json`
  const [since, setSince] = useState(() => lastShared(project.id))
  const fresh = since ? entries.filter((e) => (e.changed ?? '') > since).length : entries.length

  const wanted = search.trim().toLocaleLowerCase()
  const shown = entries
    .filter((e) => !wanted || [e.rendering, e.lemma, ...e.alternatives, e.note].some((s) => s.toLocaleLowerCase().includes(wanted)))
    .sort((a, b) => a.rendering.localeCompare(b.rendering))

  const gather = (text: string) => {
    const theirs = readBundle(text)
    if (!theirs.length) return setSaid(t('glosario.nadaRecibido'))
    const { gathered, changed } = gatherGlossary(entries, theirs)
    for (const entry of changed) saveGlossaryEntry(project.id, entry)
    setEntries(readGlossary(project.id))
    setSaid(describe(gathered))
  }
  const describe = (g: Gathered) => t('glosario.juntado', { nuevas: g.added, iguales: g.same, otras: g.joined })

  // What travels: by default only what changed since this computer last shared.
  const [all, setAll] = useState(false)
  const toShare = () => glossaryBundle(entries, all ? undefined : since)
  const shared = () => {
    markShared(project.id)
    setSince(lastShared(project.id))
  }
  const save = async () => {
    // A file to pass on (a memory stick, a message). Only a file saved counts as shared.
    const saved = await saveFile(fileName, toShare())
    if (saved.state !== 'saved') return setSaid(saved.state === 'declined' ? null : t('compartir.noGuardado'))
    shared()
    setSaid(t('glosario.guardado', { archivo: saved.name }))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toShare())
      shared()
      setSaid(t('glosario.copiado'))
    } catch {
      setSaid(t('glosario.noCopiado'))
    }
  }

  useProjectFont(project.font)

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {backLabel}
        </button>
        <div className="header-title">
          <span className="header-app">{t('glosario.titulo')}</span>
          <span className="header-person">{project.name}</span>
        </div>
        <button type="button" className="button-quiet header-more" onClick={() => setSharing(true)}>
          {t('glosario.compartirCorto')}
        </button>
      </header>
      <main className="main">
        <p className="quiet">{t('glosario.ayuda')}</p>
        <label className="field">
          <span className="field-label">{t('glosario.buscar')}</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('glosario.buscarAyuda')} />
        </label>

        {entries.length === 0 && <p className="quiet">{t('glosario.vacio')}</p>}
        <ul className="glossary-list">
          {shown.map((e) => (
            <li key={e.id}>
              {/* Touched, the entry opens: its decision, a way to change it, and where its word is. */}
              <button type="button" className="glossary-entry" onClick={() => setOpen(e.id)}>
                <span className="glossary-entry-head">
                  <strong className="glossary-rendering">{e.rendering}</strong>
                  <span className={e.status === 'agreed' ? 'badge badge-done' : 'badge'}>{t(e.status === 'agreed' ? 'ayudas.acordada' : 'ayudas.propuesta')}</span>
                </span>
                <span className="help-original">{e.lemma}</span>
                {e.alternatives.length > 0 && <span className="quiet">{t('ayudas.tambien', { formas: e.alternatives.join(', ') })}</span>}
                {e.note && <span className="study-other-text">{e.note}</span>}
              </button>
            </li>
          ))}
        </ul>

        {said && !sharing && (
          <p className="status" role="status">
            {said}
          </p>
        )}
      </main>
      {opened && (
        <GlossaryEntrySheet
          entry={opened}
          books={books}
          person={person}
          dir={books[0]?.chapters[0]?.texts.find((x) => x.original)?.dir}
          onSave={(entry) => {
            saveGlossaryEntry(project.id, entry)
            setEntries(readGlossary(project.id))
          }}
          onOpenVerse={(use) => onOpenVerse(use, opened.id)}
          onClose={() => setOpen(null)}
        />
      )}
      {sharing && (
        <Sheet title={t('glosario.compartirTitulo')} onClose={() => setSharing(false)}>
          <div className="glossary-share">
            <h3>{t('glosario.compartir')}</h3>
            <p className="quiet">{t('glosario.compartirAyuda')}</p>
            <div className="unit-switch" role="radiogroup" aria-label={t('glosario.queCompartir')}>
              <button type="button" role="radio" aria-checked={!all} className="unit-switch-option" onClick={() => setAll(false)}>
                {t('glosario.loNuevo', { n: fresh })}
              </button>
              <button type="button" role="radio" aria-checked={all} className="unit-switch-option" onClick={() => setAll(true)}>
                {t('glosario.todo', { n: entries.length })}
              </button>
            </div>
            <div className="glossary-actions">
              <button type="button" className="button-secondary" disabled={!(all ? entries.length : fresh)} onClick={save}>
                {t('glosario.guardarArchivo')}
              </button>
              <button type="button" className="button-secondary" disabled={!(all ? entries.length : fresh)} onClick={copy}>
                {t('glosario.copiar')}
              </button>
            </div>

            <h3>{t('glosario.recibir')}</h3>
            <p className="quiet">{t('glosario.recibirAyuda')}</p>
            <div className="glossary-actions">
              <button type="button" className="button-secondary" onClick={() => file.current?.click()}>
                {t('glosario.abrirArchivo')}
              </button>
              <button type="button" className="button-secondary" onClick={() => setPasting((p) => !p)}>
                {t('glosario.pegar')}
              </button>
              <input
                ref={file}
                type="file"
                accept=".tsv,.txt,text/tab-separated-values,text/plain"
                hidden
                onChange={async (e) => {
                  const chosen = e.target.files?.[0]
                  if (chosen) gather(await chosen.text())
                  e.target.value = ''
                }}
              />
            </div>
            {pasting && (
              <div className="glossary-paste">
                <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t('glosario.pegarAyuda')} />
                <button
                  type="button"
                  className="button-primary"
                  disabled={!pasted.trim()}
                  onClick={() => {
                    gather(pasted)
                    setPasted('')
                    setPasting(false)
                  }}
                >
                  {t('glosario.juntar')}
                </button>
              </div>
            )}

            {/* Not two buttons that never work: said, until it does. */}
            <p className="quiet">{t('glosario.door43Pronto', { repo: `${project.languageCode || '…'}_tg` })}</p>
            {said && (
              <p className="status" role="status">
                {said}
              </p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  )
}
