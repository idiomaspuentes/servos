/**
 * «Share» (design, section 7): books of a project in one file to pass to another computer without internet, on a
 * memory card, a USB stick or Bluetooth. Everything goes, without asking layer by layer; only which books, when it is
 * the project that is shared (all, at first). The file can also be copied as text, to send in a message.
 *
 * A project kept to its team (`Privacy`, philosophy principle 9) is shared sealed with the team's password and under a
 * name that says nothing (`copia-18-10.servos`), so whoever finds the file learns nothing. The password is chosen here
 * the first time and kept on the device (`projects/teamKeys.ts`); the line under the button says who can open the file.
 */

import { useEffect, useState } from 'react'
import { saveFile } from '../frame/saveFile'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { lock, type CopyKey } from '../projects/lockedCopy'
import { privacyOf, titleOf, type Project } from '../projects/model'
import { sealedFileName, shareFileName, shareProject, withSounds } from '../projects/share'
import { chooseTeamPassword, teamKey } from '../projects/teamKeys'

/** The shortest team password, as for the copies on a memory card. */
const SHORTEST = 8

export function ShareSheet({ project, books, person, onClose }: { project: Project; books: string[]; person: string; onClose(): void }) {
  const t = useT()
  const [chosen, setChosen] = useState<string[]>(books)
  const [said, setSaid] = useState<string | null>(null)
  const team = privacyOf(project) === 'equipo'
  // The team's key on this device: undefined while it is looked for, null when the password is still to be chosen.
  const [key, setKey] = useState<CopyKey | null | undefined>(team ? undefined : null)
  const [changing, setChanging] = useState(false)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [working, setWorking] = useState(false)
  useEffect(() => {
    if (team) void teamKey(project.id).then(setKey)
  }, [team, project.id])

  const choosing = team && (key === null || changing)
  const short = choosing && password.length > 0 && password.length < SHORTEST
  const differ = choosing && again.length > 0 && again !== password
  const ready = chosen.length > 0 && (!team || (choosing ? password.length >= SHORTEST && again === password : key !== undefined))

  // The key to seal with: the one kept, or one drawn now from the password just chosen (and kept for the next time).
  const sealingKey = async (): Promise<CopyKey | null> => {
    if (!team) return null
    if (!choosing && key) return key
    const made = await chooseTeamPassword(project.id, password)
    setKey(made)
    setChanging(false)
    setPassword('')
    setAgain('')
    return made
  }
  // With the recordings' sound, read from where it is kept; sealed when the project is kept to its team.
  const file = async () => {
    const shared = await withSounds(shareProject(project, chosen, person))
    const sealWith = await sealingKey()
    return sealWith
      ? { text: await lock(JSON.stringify(shared), sealWith, 'compartido'), name: sealedFileName(), type: 'application/octet-stream' }
      : { text: JSON.stringify(shared), name: shareFileName(shared, chosen.map((c) => titleOf(project, c))), type: 'application/json' }
  }
  const save = async () => {
    setWorking(true)
    const made = await file()
    const saved = await saveFile(made.name, made.text, made.type, t('compartir.guardarEnTelefono'))
    setWorking(false)
    // Said only when it was saved: a file refused or not possible here is not reported as done, and one shared from a
    // phone went where the person chose, which the phone does not say.
    setSaid(saved.state === 'saved' ? t('compartir.guardado', { archivo: saved.name }) : saved.state === 'failed' ? t('compartir.noGuardado') : null)
  }
  const copy = async () => {
    try {
      setWorking(true)
      await navigator.clipboard.writeText((await file()).text)
      setSaid(t('compartir.copiado'))
    } catch {
      setSaid(t('compartir.noCopiado'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Sheet title={t(books.length === 1 ? 'compartir.libroTitulo' : 'compartir.proyectoTitulo', { libro: titleOf(project, books[0] ?? ''), proyecto: project.name })} onClose={onClose} dirty={password !== ''}>
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
        {choosing && (
          <>
            <label className="field">
              <span className="field-label">{t('compartir.contrasenaEquipo')}</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {short && <span className="field-problem">{t('copias.corta', { n: SHORTEST })}</span>}
            </label>
            <label className="field">
              <span className="field-label">{t('copias.otraVez')}</span>
              <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
              {differ && <span className="field-problem">{t('copias.noIguales')}</span>}
            </label>
            <p className="quiet">{t('compartir.contrasenaAyuda')}</p>
          </>
        )}
        <button type="button" className="button-primary" disabled={!ready || working} onClick={save}>
          {t('compartir.guardar')}
        </button>
        <button type="button" className="button-secondary" disabled={!ready || working} onClick={copy}>
          {t('compartir.copiar')}
        </button>
        <p className="quiet">{t(team ? 'compartir.soloEquipo' : 'compartir.cualquiera')}</p>
        {team && key && !changing && (
          <div className="chip-row">
            <button type="button" className="chip" onClick={() => setChanging(true)}>
              ✎ {t('compartir.cambiarContrasena')}
            </button>
          </div>
        )}
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
