/**
 * Traducir de viva voz (design, section 10): a section (by default) or a verse said aloud in the team's language and
 * recorded, instead of written: a passage is said best in one breath, and its take counts for each of its verses. What is to be said is at the top (the bridge text, the other a touch away); under it, one big button to
 * record, and once recorded, the recording to hear, «record again», and the way on. No take is thrown away: the last
 * one counts, and an earlier one can be chosen. Whatever was written of the verse is shown too, with the way to the
 * editor, since a team may say it first and write it after.
 */

import { useEffect, useRef, useState } from 'react'
import { WordLines } from '../../frame/TouchWords'
import { addTake, chooseTake, chosenTake, clock, keepSound, recorderOptions, soundOf, takeCovering, takesOf, takesToChoose, type Take } from '../../projects/recordings'
import { joinStartOf, joinedVerses, textOf } from '../../projects/work'
import type { MiniApp, MiniAppCenterProps } from '../contract'

/** A take to hear: its sound read from where it is kept, as a link the audio element can play. */
function TakePlayer({ take }: { take: Take }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    let live = true
    soundOf(take.id).then((blob) => {
      if (!live || !blob) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [take.id])
  return url ? <audio className="voice-audio" controls src={url} preload="metadata" /> : null
}

function Center({ context }: MiniAppCenterProps) {
  const { t, position, data, person, frame, textAbbreviation, shown } = context
  const { book, chapter } = position
  // What is said in one take: the section open, or the verse (a join is said once, by its first verse).
  const place = joinStartOf(book, chapter, shown[0] ?? position.verse)
  const verses = shown.length > 1 ? shown : joinedVerses(book, chapter, place)
  const last = verses[verses.length - 1]
  const [source, setSource] = useState(textAbbreviation)
  const bridge = data.texts.find((x) => x.abbreviation === source) ?? data.texts.find((x) => !x.original)
  const [, redraw] = useState(0)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [others, setOthers] = useState(false)
  const rec = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; started: number; timer: number } | null>(null)
  const take = chosenTake(book, chapter, place)
  const takes = takesOf(book, chapter, place)
  // Another device chose another take apart: which one counts is chosen first, as two versions of a verse are.
  const choices = takesToChoose(book, chapter, place)
  const [pick, setPick] = useState<string | null>(null)
  const written = [...new Set(verses.map((v) => joinStartOf(book, chapter, v)))]
    .map((v) => textOf(book, chapter, v).trim())
    .filter(Boolean)
    .join(' ')
  // Who said a take, how long, and, when it is not just what is open, which verses it says.
  const said = (x: Take) =>
    t('editorVoz.grabadoPor', { nombre: x.by, duracion: clock(x.ms) }) + ((x.to ?? place) !== last ? ` · ${t('editorVoz.versiculos', { de: place, a: x.to ?? place })}` : '')
  // The prototype shared as a page inside Claude may not use the microphone: said before trying.
  const canRecord = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && !('claude' in window)

  // Going to another verse while recording keeps what was said, as a take of the verse it was said for.
  useEffect(() => () => stop(), [place]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setProblem(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, recorderOptions())
      const chunks: Blob[] = []
      const started = Date.now()
      const at = { book, chapter, verse: place, to: last }
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const ms = Date.now() - started
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) return
        const made = addTake(at.book, at.chapter, at.verse, { by: person.name, at: new Date().toISOString(), ms, mime: blob.type, ...(at.to !== at.verse ? { to: at.to } : {}) })
        await keepSound(made.id, blob)
        frame.setSaved('guardado')
        redraw((n) => n + 1)
      }
      recorder.start()
      const timer = window.setInterval(() => setElapsed(Date.now() - started), 250)
      rec.current = { recorder, stream, chunks, started, timer }
      setElapsed(0)
      setRecording(true)
    } catch (e) {
      setProblem(t((e as { name?: string }).name === 'NotAllowedError' ? 'editorVoz.sinPermiso' : 'editorVoz.noSePuede'))
    }
  }
  function stop() {
    const r = rec.current
    if (!r) return
    window.clearInterval(r.timer)
    if (r.recorder.state !== 'inactive') r.recorder.stop()
    rec.current = null
    setRecording(false)
  }

  return (
    <div className="review voice">
      <div className="review-scroll">
        {/* What is to be said: the bridge text of the verse, the other a touch away. */}
        <section className="voice-source" aria-label={t('editorVoz.queDecir')}>
          <div className="review-quote-switch" role="radiogroup" aria-label={t('editorVoz.queDecir')}>
            {data.texts
              .filter((x) => !x.original)
              .map((x) => (
                <button key={x.abbreviation} type="button" role="radio" aria-checked={bridge?.abbreviation === x.abbreviation} onClick={() => setSource(x.abbreviation)}>
                  {x.abbreviation}
                </button>
              ))}
          </div>
          {bridge && verses.map((v) => <WordLines key={v} lines={bridge.lines[v] ?? []} verse={v} lit={new Set()} onWord={() => {}} />)}
        </section>

        {/* The recording: one big button while there is none; once there is, to hear it and to record again. */}
        <section className="voice-record" aria-label={t('editorVoz.suVoz')}>
          {!canRecord ? (
            <p className="notice">{t('editorVoz.noSePuede')}</p>
          ) : recording ? (
            <button type="button" className="voice-button is-recording" onClick={stop}>
              <span className="voice-dot" aria-hidden="true" />
              {t('editorVoz.detener')} · {clock(elapsed)}
            </button>
          ) : choices.length ? (
            <section className="versions" aria-label={t('editorVoz.elegirTitulo')}>
              <p className="versions-ask">{t('editorVoz.elegirPregunta')}</p>
              {choices.map((x) => (
                <div
                  key={x.id}
                  role="radio"
                  tabIndex={0}
                  aria-checked={pick === x.id}
                  className={pick === x.id ? 'version is-on' : 'version'}
                  onClick={() => setPick(x.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPick(x.id)}
                >
                  <span className="version-who">
                    <span className="version-dot" aria-hidden="true" />
                    {said(x)}
                  </span>
                  <TakePlayer take={x} />
                </div>
              ))}
              <button
                type="button"
                className="button-primary"
                disabled={!pick}
                onClick={() => {
                  if (!pick) return
                  chooseTake(book, chapter, place, pick)
                  setPick(null)
                  redraw((n) => n + 1)
                }}
              >
                {t('editorVoz.quedarseCon')}
              </button>
            </section>
          ) : take ? (
            <>
              <TakePlayer key={take.id} take={take} />
              <p className="quiet">{said(take)}</p>
              <button type="button" className="button-secondary" onClick={() => void start()}>
                ● {t('editorVoz.otraVez')}
              </button>
            </>
          ) : (
            <button type="button" className="voice-button" onClick={() => void start()}>
              <span className="voice-dot" aria-hidden="true" />
              {t('editorVoz.grabar')}
            </button>
          )}
          {problem && (
            <p className="notice" role="alert">
              {problem}
            </p>
          )}
          {takes.length > 1 && !recording && !choices.length && (
            <details className="advanced" open={others} onToggle={(e) => setOthers(e.currentTarget.open)}>
              <summary>{t('editorVoz.otras', { n: takes.length - 1 })}</summary>
              <ul className="voice-takes">
                {takes
                  .filter((x) => x.id !== take?.id)
                  .reverse()
                  .map((x) => (
                    <li key={x.id}>
                      <TakePlayer take={x} />
                      <span className="quiet">{said(x)}</span>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => {
                          chooseTake(book, chapter, place, x.id)
                          redraw((n) => n + 1)
                        }}
                      >
                        {t('editorVoz.usarEsta')}
                      </button>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>

        {/* Said and written may go together: what is written of what is open, and the way to write it. */}
        <section className="voice-written">
          {written ? <p className="voice-written-text">{written}</p> : <p className="quiet">{t('editorVoz.sinEscribir')}</p>}
          <button type="button" className="chip" onClick={() => frame.open('editor', { book, chapter, verse: place })}>
            ✎ {t(written ? 'editorVoz.corregirEscrito' : 'editorVoz.escribirlo')}
          </button>
        </section>
      </div>
    </div>
  )
}

export const editorVoz: MiniApp = {
  id: 'editorVoz',
  phase: 'traduccion',
  needs: ['text'],
  unit: 'section',
  sections: true,
  helps: false,
  fills: true,
  writes: true,
  // Said, and not waiting for a choice between two takes chosen apart.
  done: (at) => {
    const place = joinStartOf(at.book, at.chapter, at.verse)
    return takeCovering(at.book, at.chapter, place) !== null && !takesToChoose(at.book, at.chapter, place).length
  },
  Center,
  texts: {
    es: {
      nombre: 'Traducir de viva voz',
      descripcion: 'Decir cada pasaje en su idioma y grabarlo, en lugar de escribirlo',
      queDecir: 'Lo que va a decir',
      suVoz: 'Su voz',
      grabar: 'Grabar',
      detener: 'Detener',
      otraVez: 'Grabar otra vez',
      grabadoPor: 'Lo grabó {nombre} · {duracion}',
      versiculos: 'versículos {de}–{a}',
      otras: 'Grabaciones anteriores ({n})',
      usarEsta: 'Usar esta',
      sinEscribir: 'Todavía no está escrito.',
      escribirlo: 'Traducirlo por escrito',
      corregirEscrito: 'Corregir lo escrito',
      siguiente: 'Siguiente',
      sinPermiso: 'El teléfono no dio permiso para usar el micrófono. Permítalo en los ajustes del navegador o de la app.',
      'sinPermiso.computadora': 'La computadora no dio permiso para usar el micrófono. Permítalo en los ajustes del navegador o de la app.',
      noSePuede: 'Este aparato, o esta página, no deja grabar.',
      elegirTitulo: 'Dos grabaciones elegidas',
      elegirPregunta: 'En otro aparato se eligió otra grabación. Escúchelas: ¿cuál queda?',
      quedarseCon: 'Quedarse con esta grabación',
    },
    pt: {
      nombre: 'Traduzir em voz alta',
      descripcion: 'Dizer cada passagem no seu idioma e gravá-la, em vez de escrevê-la',
      queDecir: 'O que vai dizer',
      suVoz: 'Sua voz',
      grabar: 'Gravar',
      detener: 'Parar',
      otraVez: 'Gravar de novo',
      grabadoPor: 'Gravado por {nombre} · {duracion}',
      versiculos: 'versículos {de}–{a}',
      otras: 'Gravações anteriores ({n})',
      usarEsta: 'Usar esta',
      sinEscribir: 'Ainda não está escrito.',
      escribirlo: 'Traduzi-lo por escrito',
      corregirEscrito: 'Corrigir o escrito',
      siguiente: 'Próximo',
      sinPermiso: 'O telefone não deu permissão para usar o microfone. Permita nas configurações do navegador ou do app.',
      'sinPermiso.computadora': 'O computador não deu permissão para usar o microfone. Permita nas configurações do navegador ou do app.',
      noSePuede: 'Este aparelho, ou esta página, não deixa gravar.',
      elegirTitulo: 'Duas gravações escolhidas',
      elegirPregunta: 'Em outro aparelho foi escolhida outra gravação. Escute as duas: qual fica?',
      quedarseCon: 'Ficar com esta gravação',
    },
    en: {
      nombre: 'Translate by voice',
      descripcion: 'Say each passage in your language and record it, instead of writing it',
      queDecir: 'What you will say',
      suVoz: 'Your voice',
      grabar: 'Record',
      detener: 'Stop',
      otraVez: 'Record again',
      grabadoPor: 'Recorded by {nombre} · {duracion}',
      versiculos: 'verses {de}–{a}',
      otras: 'Earlier recordings ({n})',
      usarEsta: 'Use this one',
      sinEscribir: 'Not written yet.',
      escribirlo: 'Translate it in writing',
      corregirEscrito: 'Correct what is written',
      siguiente: 'Next',
      sinPermiso: 'The phone did not allow the microphone. Allow it in the browser or app settings.',
      'sinPermiso.computadora': 'The computer did not allow the microphone. Allow it in the browser or app settings.',
      noSePuede: 'This device, or this page, does not allow recording.',
      elegirTitulo: 'Two recordings chosen',
      elegirPregunta: 'Another recording was chosen on another device. Listen to them: which one stays?',
      quedarseCon: 'Keep this recording',
    },
  },
}
