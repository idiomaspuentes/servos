/**
 * The project's glossary: the team's decisions on how words of the original are translated, to look up and to share.
 * Every translator adds to it from the editor, on their own computer; here it is shared without internet (a file to
 * pass on, or its text to copy into a message) and gathered from another computer, nothing lost (two renderings of a
 * word stay, one as an alternative, until the team agrees). What is shared is, by default, what changed since the
 * last time: the glossary may grow to thousands of words. A glossary from Taller (its TSV) is received too. Publishing
 * to Door43 puts it in the language's `<lang>_tg` repository, one file a word.
 */

import { useRef, useState } from 'react'
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

export function GlossaryScreen({ project, onBack }: { project: Project; onBack(): void }) {
  const t = useT()
  const [entries, setEntries] = useState(() => readGlossary(project.id))
  const [search, setSearch] = useState('')
  const [said, setSaid] = useState<string | null>(null)
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
  const save = () => {
    // A file to pass on (a memory stick, a message).
    const blob = new Blob([toShare()], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
    shared()
    setSaid(t('glosario.guardado', { archivo: fileName }))
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

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('glosario.titulo')}</span>
          <span className="header-person">{project.name}</span>
        </div>
        <span />
      </header>
      <main className="main">
        <p className="quiet">{t('glosario.ayuda')}</p>
        <label className="field">
          <span className="field-label">{t('glosario.buscar')}</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('glosario.buscarAyuda')} />
        </label>

        {entries.length === 0 && <p className="notice">{t('glosario.vacio')}</p>}
        <ul className="glossary-list">
          {shown.map((e) => (
            <li key={e.id} className="glossary-entry">
              <div className="glossary-entry-head">
                <strong>{e.rendering}</strong>
                <span className="badge">{t(e.status === 'agreed' ? 'ayudas.acordada' : 'ayudas.propuesta')}</span>
              </div>
              <span className="help-original">{e.lemma}</span>
              {e.alternatives.length > 0 && <span className="quiet">{t('ayudas.tambien', { formas: e.alternatives.join(', ') })}</span>}
              {e.note && <span className="study-other-text">{e.note}</span>}
              {e.by && <span className="quiet">{t('ayudas.glosarioDe', { nombre: e.by })}</span>}
            </li>
          ))}
        </ul>

        <section className="glossary-share" aria-labelledby="compartir">
          <h2 id="compartir">{t('glosario.compartir')}</h2>
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

          <h2>{t('glosario.recibir')}</h2>
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

          <h2>Door43</h2>
          <p className="quiet">{t('glosario.door43Ayuda', { repo: `${project.languageCode || '…'}_tg` })}</p>
          <div className="glossary-actions">
            <button type="button" className="button-secondary" disabled>
              {t('glosario.publicar')}
            </button>
            <button type="button" className="button-secondary" disabled>
              {t('glosario.traer')}
            </button>
          </div>
          {said && (
            <p className="notice" role="status">
              {said}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
