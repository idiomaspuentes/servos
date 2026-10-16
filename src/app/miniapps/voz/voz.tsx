/**
 * Traducir de viva voz (design, section 10): each verse said aloud in the team's language and recorded, instead of
 * written. What is to be said is at the top (the bridge text, the other a touch away); under it, one big button to
 * record, and once recorded, the recording to hear, «record again», and the way on. No take is thrown away: the last
 * one counts, and an earlier one can be chosen. Whatever was written of the verse is shown too, with the way to the
 * editor, since a team may say it first and write it after.
 */

import { useEffect, useRef, useState } from 'react'
import { WordLines } from '../../frame/TouchWords'
import { addTake, chooseTake, chosenTake, clock, keepSound, soundOf, takesOf, type Take } from '../../projects/recordings'
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
  const { t, position, data, person, frame, textAbbreviation } = context
  const { book, chapter } = position
  // A join is said once, by its first verse.
  const place = joinStartOf(book, chapter, position.verse)
  const verses = joinedVerses(book, chapter, place)
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
  const written = textOf(book, chapter, place)
  // The prototype shared as a page inside Claude may not use the microphone: said before trying.
  const canRecord = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && !('claude' in window)

  // Going to another verse while recording keeps what was said, as a take of the verse it was said for.
  useEffect(() => () => stop(), [place]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setProblem(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      const started = Date.now()
      const at = { book, chapter, verse: place }
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const ms = Date.now() - started
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) return
        const made = addTake(at.book, at.chapter, at.verse, { by: person.name, at: new Date().toISOString(), ms, mime: blob.type })
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
          ) : take ? (
            <>
              <TakePlayer key={take.id} take={take} />
              <p className="quiet">{t('editorVoz.grabadoPor', { nombre: take.by, duracion: clock(take.ms) })}</p>
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
          {takes.length > 1 && !recording && (
            <details className="advanced" open={others} onToggle={(e) => setOthers(e.currentTarget.open)}>
              <summary>{t('editorVoz.otras', { n: takes.length - 1 })}</summary>
              <ul className="voice-takes">
                {takes
                  .filter((x) => x.id !== take?.id)
                  .reverse()
                  .map((x) => (
                    <li key={x.id}>
                      <TakePlayer take={x} />
                      <span className="quiet">{t('editorVoz.grabadoPor', { nombre: x.by, duracion: clock(x.ms) })}</span>
                      <button
                        type="button"
                        className="button-quiet"
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

        {/* Said and written may go together: what is written of the verse, and the way to write it. */}
        <section className="voice-written">
          {written.trim() ? <p className="voice-written-text">{written}</p> : <p className="quiet">{t('editorVoz.sinEscribir')}</p>}
          <button type="button" className="button-quiet" onClick={() => frame.open('editor', { book, chapter, verse: place })}>
            {t(written.trim() ? 'editorVoz.corregirEscrito' : 'editorVoz.escribirlo')}
          </button>
        </section>
      </div>
      {take && !recording && (
        <div className="review-next">
          <button type="button" className="button-primary" onClick={frame.next}>
            {frame.atEnd ? t('marco.listoVolver', { libro: context.bookTitle }) : `${t('editorVoz.siguiente')} →`}
          </button>
        </div>
      )}
    </div>
  )
}

export const editorVoz: MiniApp = {
  id: 'editorVoz',
  phase: 'traduccion',
  needs: ['text'],
  unit: 'verse',
  helps: false,
  fills: true,
  writes: true,
  done: (at) => chosenTake(at.book, at.chapter, joinStartOf(at.book, at.chapter, at.verse)) !== null,
  Center,
  texts: {
    es: {
      nombre: 'Traducir de viva voz',
      descripcion: 'Decir cada versículo en su idioma y grabarlo, en lugar de escribirlo',
      queDecir: 'Lo que va a decir',
      suVoz: 'Su voz',
      grabar: 'Grabar',
      detener: 'Detener',
      otraVez: 'Grabar otra vez',
      grabadoPor: 'Lo grabó {nombre} · {duracion}',
      otras: 'Grabaciones anteriores ({n})',
      usarEsta: 'Usar esta',
      sinEscribir: 'Este versículo todavía no está escrito.',
      escribirlo: 'Escribirlo en el editor',
      corregirEscrito: 'Corregir lo escrito en el editor',
      siguiente: 'Siguiente',
      sinPermiso: 'El teléfono no dio permiso para usar el micrófono. Permítalo en los ajustes del navegador o de la app.',
      noSePuede: 'Este aparato, o esta página, no deja grabar.',
    },
    pt: {
      nombre: 'Traduzir em voz alta',
      descripcion: 'Dizer cada versículo no seu idioma e gravá-lo, em vez de escrevê-lo',
      queDecir: 'O que vai dizer',
      suVoz: 'Sua voz',
      grabar: 'Gravar',
      detener: 'Parar',
      otraVez: 'Gravar de novo',
      grabadoPor: 'Gravado por {nombre} · {duracion}',
      otras: 'Gravações anteriores ({n})',
      usarEsta: 'Usar esta',
      sinEscribir: 'Este versículo ainda não está escrito.',
      escribirlo: 'Escrevê-lo no editor',
      corregirEscrito: 'Corrigir o escrito no editor',
      siguiente: 'Próximo',
      sinPermiso: 'O telefone não deu permissão para usar o microfone. Permita nas configurações do navegador ou do app.',
      noSePuede: 'Este aparelho, ou esta página, não deixa gravar.',
    },
    en: {
      nombre: 'Translate by voice',
      descripcion: 'Say each verse in your language and record it, instead of writing it',
      queDecir: 'What you will say',
      suVoz: 'Your voice',
      grabar: 'Record',
      detener: 'Stop',
      otraVez: 'Record again',
      grabadoPor: 'Recorded by {nombre} · {duracion}',
      otras: 'Earlier recordings ({n})',
      usarEsta: 'Use this one',
      sinEscribir: 'This verse is not written yet.',
      escribirlo: 'Write it in the editor',
      corregirEscrito: 'Correct what is written in the editor',
      siguiente: 'Next',
      sinPermiso: 'The phone did not allow the microphone. Allow it in the browser or app settings.',
      noSePuede: 'This device, or this page, does not allow recording.',
    },
  },
}
