/**
 * «Medir paquetes»: how long this device takes to read English Psalms from the format 3 packs, against the proposal's
 * targets for a 2 GB phone (a whole book readable in under 3 s, a verse with its helps in under 50 ms). It measures on
 * the real store, so what IndexedDB costs counts; the first (cold) run is shown apart, and a measure during which Servos
 * went to the background is said not to be valid. English Psalms are brought from the packs server first when they are
 * not here; the table, with what says which device and build it is, can be copied to a message. Shown only to whoever
 * has the staging packs server (a test build, `?packs=staging`, or the choice in «Acerca de») or opened Servos with
 * `?medir` (see `AboutSheet`).
 */

import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { useOnline } from '../frame/online'
import { appLabel } from '../frame/version'
import { packsFormat, packsServer } from '../../resources/online/packsServer'
import { useI18n } from '../i18n/i18n'
import { askForBook, useBookAsked, useDownloadSize } from '../projects/onlineBooks'
import { sizeIn } from '../projects/onlineWords'
import { forgetReadersV3 } from '../../resources/v3/client'
import { measure, onDeviceV3, ROWS, TARGETS, type RowName, type Stat, type Timings } from '../../resources/v3/timings'

const LANG = 'en'
const BOOK = 'psa'
const REF = 'psa 23:1'
const RUNS = 20

const LABELS: Record<RowName, string> = {
  open: 'paquetes3.medirAbrir',
  book: 'paquetes3.medirLibro',
  firstChapter: 'paquetes3.medirPrimerCapitulo',
  screen: 'paquetes3.medirPantalla',
  firstVerse: 'paquetes3.medirPrimerVersiculo',
  passage: 'paquetes3.medirVersiculo',
  context: 'paquetes3.medirContexto',
}
const TARGET: Partial<Record<RowName, number>> = { screen: TARGETS.readableMs, passage: TARGETS.verseMs, context: TARGETS.verseMs }

export function TimingsSheet({ onClose }: { onClose(): void }) {
  const { t, language } = useI18n()
  const online = useOnline()
  const format3 = packsFormat() === 3
  // Undefined while the device is read.
  const [here, setHere] = useState<boolean | undefined>()
  const [problem, setProblem] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult] = useState<Timings | null>(null)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState<boolean | null>(null)
  const asked = useBookAsked(LANG, BOOK)
  const size = useDownloadSize(LANG, BOOK, format3 && here === false && online && !asked)
  // Stops a measure still going when the sheet is closed.
  const stop = useRef<AbortController | null>(null)
  useEffect(() => () => stop.current?.abort(), [])

  // The store is opened only with format 3: with the production packs this sheet must not touch it.
  useEffect(() => {
    if (!format3) return
    let live = true
    onDeviceV3(LANG, BOOK)
      .then((v) => live && setHere(v))
      .catch(() => live && setHere(false))
    return () => {
      live = false
    }
  }, [format3])

  const bring = async () => {
    setProblem(null)
    await askForBook(LANG, BOOK)
    forgetReadersV3()
    const now = await onDeviceV3(LANG, BOOK).catch(() => false)
    setHere(now)
    if (!now) setProblem(t('paquetes3.medirNoBajo'))
  }

  const ms = (n: number) => {
    const fmt = (v: number, digits: number) => new Intl.NumberFormat(language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)
    return n >= 1000 ? t('paquetes3.medirS', { n: fmt(n / 1000, 2) }) : t('paquetes3.medirMs', { n: fmt(n, n < 10 ? 1 : 0) })
  }
  const said = (s: Stat) => t('paquetes3.medirStat', { mediana: ms(s.median), menor: ms(s.min), mayor: ms(s.max) })
  const verdict = (row: RowName, s: Stat) => (TARGET[row] === undefined ? '' : s.median < TARGET[row]! ? t('paquetes3.medirCumple') : t('paquetes3.medirNoCumple'))
  const meta = (row: RowName) => t('paquetes3.medirMeta', { meta: ms(TARGET[row]!) })

  /** The table as text, with what says which device and build gave it. */
  const table = (r: Timings | null, detail: string | null) => {
    const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number })
    const none = t('paquetes3.medirSinDato')
    const lines = [
      t('paquetes3.medirDatos', {
        version: appLabel(),
        memoria: nav?.deviceMemory ? `${nav.deviceMemory} GB` : none,
        nucleos: nav?.hardwareConcurrency ?? none,
        servidor: packsServer(),
        formato: packsFormat(),
        fecha: new Date().toISOString(),
      }),
      t('paquetes3.medirNavegador', { ua: nav?.userAgent ?? none }),
      t('paquetes3.medirAlFrente', { si: !r || r.hidden === 0 ? t('paquetes3.medirSi') : t('paquetes3.medirNo') }),
      ...(r ? [t('paquetes3.medirCabecera', { veces: r.runs })] : []),
      ...(r ? ROWS : []).map((row) => {
        if (!r) return ''
        const bits = [`${t(LABELS[row])}: ${said(r[row])}`, t('paquetes3.medirPrimera', { valor: ms(r.first[row]) })]
        if (row === 'screen') bits.push(t('paquetes3.medirEspera', { valor: ms(r.yielded.median) }))
        if (TARGET[row] !== undefined) bits.push(meta(row), verdict(row, r[row]))
        return bits.join(' · ')
      }),
    ]
    if (detail) lines.push(t('paquetes3.medirError', { detalle: detail }))
    return lines.join('\n')
  }

  const run = async () => {
    setProblem(null)
    setResult(null)
    setCopied(null)
    setText('')
    setProgress(0)
    const mine = new AbortController()
    stop.current = mine
    try {
      const out = await measure(LANG, BOOK, REF, RUNS, { signal: mine.signal, onRun: (done) => !mine.signal.aborted && setProgress(done) })
      if (mine.signal.aborted) return
      setResult(out)
      setText(table(out, null))
    } catch (e) {
      if (mine.signal.aborted) return
      // Said and kept for the copy: a failure that is not told is not one that can be fixed.
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      setProblem(`${t('paquetes3.medirFallo')} ${detail}`)
      setText(table(null, detail))
    } finally {
      if (!mine.signal.aborted) setProgress(null)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const measuring = progress !== null

  return (
    <Sheet title={t('paquetes3.medirTitulo')} onClose={onClose}>
      <div className="about timings">
        <p>{t('paquetes3.medirAyuda')}</p>
        {!format3 ? (
          <p className="quiet">{t('paquetes3.medirHaceFalta3')}</p>
        ) : here === undefined ? null : !here ? (
          asked ? (
            <p className="quiet">{t('ayudas.bajando')}</p>
          ) : online ? (
            <button type="button" className="button-primary" onClick={() => void bring()}>
              {typeof size === 'number' && size > 0 ? t('paquetes3.medirBajar', { tamano: sizeIn(t, size, language) }) : t('paquetes3.medirBajarSinTamano')}
            </button>
          ) : (
            <p className="quiet">{t('paquetes3.medirSinConexion')}</p>
          )
        ) : (
          <button type="button" className="button-primary" disabled={measuring} onClick={() => void run()}>
            {measuring ? t('paquetes3.midiendo', { n: progress, total: RUNS }) : t('paquetes3.medir')}
          </button>
        )}
        {measuring && <p className="quiet">{t('paquetes3.medirAlFrenteAviso')}</p>}
        {problem && (
          <p className="field-problem" role="alert">
            {problem}
          </p>
        )}
        {result && result.hidden > 0 && (
          <p className="field-problem" role="alert">
            {t('paquetes3.medirInvalida', { n: result.hidden, total: result.runs })}
          </p>
        )}
        {result && (
          <ul className="credits timings-rows" aria-label={t('paquetes3.medirCabecera', { veces: result.runs })}>
            {ROWS.map((row) => (
              <li key={row}>
                <span className="credit-titles">{t(LABELS[row])}</span>
                <span className="quiet">{said(result[row])}</span>
                <span className="quiet">{t('paquetes3.medirPrimera', { valor: ms(result.first[row]) })}</span>
                {row === 'screen' && <span className="quiet">{t('paquetes3.medirEspera', { valor: ms(result.yielded.median) })}</span>}
                {TARGET[row] !== undefined && (
                  <span className={result[row].median < TARGET[row]! ? 'timings-ok' : 'timings-over'}>
                    {meta(row)} · {verdict(row, result[row])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {text && (
          <>
            <button type="button" className="button-secondary" onClick={() => void copy()}>
              {copied ? t('marco.copiado') : t('marco.copiar')}
            </button>
            {copied === false && <p className="field-problem">{t('paquetes3.medirCopiaManual')}</p>}
            {/* Always selectable: the clipboard can be blocked (a page without a secure context). */}
            <textarea className="timings-text" readOnly rows={8} value={text} onFocus={(e) => e.currentTarget.select()} aria-label={t('paquetes3.medirCabecera', { veces: RUNS })} />
          </>
        )}
      </div>
    </Sheet>
  )
}
