/**
 * «Medir paquetes»: how long this device takes to read English Psalms from the format 3 packs, against the proposal's
 * targets for a 2 GB phone (a whole book readable in under 3 s, a verse with its helps in under 50 ms). It measures on
 * the real store, so what IndexedDB costs counts. English Psalms are brought from the packs server first when they are
 * not here; the table can be copied to a message. Shown only to whoever opened Servos with `?medir`, or chose the
 * staging packs server (see `AboutSheet`).
 */

import { useEffect, useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { useOnline } from '../frame/online'
import { packsFormat } from '../../resources/online/packsServer'
import { useI18n } from '../i18n/i18n'
import { askForBook, useBookAsked, useDownloadSize } from '../projects/onlineBooks'
import { sizeIn } from '../projects/onlineWords'
import { forgetReadersV3 } from '../../resources/v3/client'
import { measure, onDeviceV3, TARGETS, type Stat, type Timings } from '../../resources/v3/timings'

const LANG = 'en'
const BOOK = 'psa'
const REF = 'psa 23:1'
const RUNS = 20

type Row = { key: keyof Timings; label: string; target?: number }

const ROWS: Row[] = [
  { key: 'open', label: 'paquetes3.medirAbrir' },
  { key: 'book', label: 'paquetes3.medirLibro' },
  { key: 'screen', label: 'paquetes3.medirPantalla', target: TARGETS.readableMs },
  { key: 'passage', label: 'paquetes3.medirVersiculo', target: TARGETS.verseMs },
  { key: 'context', label: 'paquetes3.medirContexto', target: TARGETS.verseMs },
]

export function TimingsSheet({ onClose }: { onClose(): void }) {
  const { t, language } = useI18n()
  const online = useOnline()
  // Undefined while the device is read.
  const [here, setHere] = useState<boolean | undefined>()
  const [problem, setProblem] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult] = useState<Timings | null>(null)
  const [copied, setCopied] = useState<boolean | null>(null)
  const asked = useBookAsked(LANG, BOOK)
  const size = useDownloadSize(LANG, BOOK, here === false && online && !asked)

  const look = () =>
    onDeviceV3(LANG, BOOK)
      .then(setHere)
      .catch(() => setHere(false))
  useEffect(() => {
    void look()
  }, [])

  const bring = async () => {
    setProblem(null)
    await askForBook(LANG, BOOK)
    forgetReadersV3()
    const now = await onDeviceV3(LANG, BOOK).catch(() => false)
    setHere(now)
    if (!now) setProblem(t('paquetes3.medirNoBajo'))
  }

  const run = async () => {
    setProblem(null)
    setResult(null)
    setCopied(null)
    setProgress(0)
    try {
      setResult(await measure(LANG, BOOK, REF, RUNS, { onRun: (done) => setProgress(done) }))
    } catch {
      setProblem(t('paquetes3.medirFallo'))
    } finally {
      setProgress(null)
    }
  }

  const ms = (n: number) => {
    const fmt = (v: number, digits: number) => new Intl.NumberFormat(language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)
    return n >= 1000 ? t('paquetes3.medirS', { n: fmt(n / 1000, 2) }) : t('paquetes3.medirMs', { n: fmt(n, n < 10 ? 1 : 0) })
  }
  const said = (s: Stat) => t('paquetes3.medirStat', { mediana: ms(s.median), menor: ms(s.min), mayor: ms(s.max) })
  const verdict = (row: Row, s: Stat) => (row.target === undefined ? '' : s.median < row.target ? t('paquetes3.medirCumple') : t('paquetes3.medirNoCumple'))

  const table = (r: Timings) =>
    [
      t('paquetes3.medirCabecera', { veces: RUNS }),
      ...ROWS.map((row) => `${t(row.label)}: ${said(r[row.key])}${row.target === undefined ? '' : ` · ${t('paquetes3.medirMeta', { meta: ms(row.target) })} · ${verdict(row, r[row.key])}`}`),
      `${typeof navigator === 'undefined' ? '' : navigator.userAgent}`,
    ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(table(result!))
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
        {packsFormat() !== 3 ? (
          <p className="quiet">{t('paquetes3.medirHaceFalta3')}</p>
        ) : here === undefined ? null : !here ? (
          <>
            {asked ? (
              <p className="quiet">{t('ayudas.bajando')}</p>
            ) : online ? (
              <button type="button" className="button-primary" onClick={() => void bring()}>
                {typeof size === 'number' && size > 0 ? t('paquetes3.medirBajar', { tamano: sizeIn(t, size, language) }) : t('paquetes3.medirBajarSinTamano')}
              </button>
            ) : (
              <p className="quiet">{t('paquetes3.medirSinConexion')}</p>
            )}
          </>
        ) : (
          <button type="button" className="button-primary" disabled={measuring} onClick={() => void run()}>
            {measuring ? t('paquetes3.midiendo', { n: progress, total: RUNS }) : t('paquetes3.medir')}
          </button>
        )}
        {problem && (
          <p className="field-problem" role="alert">
            {problem}
          </p>
        )}
        {result && (
          <>
            <ul className="credits timings-rows" aria-label={t('paquetes3.medirCabecera', { veces: RUNS })}>
              {ROWS.map((row) => (
                <li key={row.key}>
                  <span className="credit-titles">{t(row.label)}</span>
                  <span className="quiet">{said(result[row.key])}</span>
                  {row.target !== undefined && (
                    <span className={result[row.key].median < row.target ? 'timings-ok' : 'timings-over'}>
                      {t('paquetes3.medirMeta', { meta: ms(row.target) })} · {verdict(row, result[row.key])}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="button-secondary" onClick={() => void copy()}>
              {copied ? t('marco.copiado') : t('marco.copiar')}
            </button>
            {copied === false && (
              <p className="field-problem" role="alert">
                {t('compartir.noCopiado')}
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
