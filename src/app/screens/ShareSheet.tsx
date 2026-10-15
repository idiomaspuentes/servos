/**
 * «Share» (design, section 7): books of a project in one file to pass to another computer without internet, on a
 * memory card, a USB stick or Bluetooth. Everything goes, without asking layer by layer; only which books, when it is
 * the project that is shared (all, at first). The file can also be copied as text, to send in a message.
 */

import { useState } from 'react'
import { saveFile } from '../frame/saveFile'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { titleOf, type Project } from '../projects/model'
import { shareFileName, shareProject } from '../projects/share'

export function ShareSheet({ project, books, person, onClose }: { project: Project; books: string[]; person: string; onClose(): void }) {
  const t = useT()
  const [chosen, setChosen] = useState<string[]>(books)
  const [said, setSaid] = useState<string | null>(null)
  const file = () => shareProject(project, chosen, person)
  const save = async () => {
    const shared = file()
    const name = shareFileName(shared, chosen.map((c) => titleOf(project, c)))
    const saved = await saveFile(name, JSON.stringify(shared))
    // Said only when it was saved: a file refused or not possible here is not reported as done.
    setSaid(saved.state === 'saved' ? t('compartir.guardado', { archivo: saved.name }) : saved.state === 'declined' ? null : t('compartir.noGuardado'))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(file()))
      setSaid(t('compartir.copiado'))
    } catch {
      setSaid(t('compartir.noCopiado'))
    }
  }

  return (
    <Sheet title={t(books.length === 1 ? 'compartir.libroTitulo' : 'compartir.proyectoTitulo', { libro: titleOf(project, books[0] ?? ''), proyecto: project.name })} onClose={onClose}>
      <div className="share">
        {books.length > 1 && (
          <fieldset className="field">
            <legend className="field-label">{t('compartir.queLibros')}</legend>
            {books.map((code) => (
              <label key={code} className="check">
                <input
                  type="checkbox"
                  checked={chosen.includes(code)}
                  onChange={() => setChosen((now) => (now.includes(code) ? now.filter((c) => c !== code) : [...now, code]))}
                />
                {titleOf(project, code)}
              </label>
            ))}
          </fieldset>
        )}
        <p className="quiet">{t('compartir.vaTodo')}</p>
        <button type="button" className="button-primary" disabled={!chosen.length} onClick={save}>
          {t('compartir.guardar')}
        </button>
        <button type="button" className="button-secondary" disabled={!chosen.length} onClick={copy}>
          {t('compartir.copiar')}
        </button>
        <p className="quiet">{t('compartir.como')}</p>
        {said && (
          <p className="status" role="status">
            {said}
          </p>
        )}
      </div>
    </Sheet>
  )
}
