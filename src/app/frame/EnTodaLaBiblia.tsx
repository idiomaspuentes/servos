/**
 * «En toda la Biblia», folded in the word card's «Más sobre…»: how the bridge texts on this device render a word of the
 * original in every book (`renderings`), with how many times and where (a place opens its verse), then the books where
 * the word is that are not on this device, with their size and «Bajar». Asked only when opened; not shown at all
 * without format 3 or without the Strong table on the device.
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { renderingsByText, wordAcrossBooks, type Rendering } from '../../resources/v3/lookups'
import { useT } from '../i18n/i18n'
import { booksRead, ElsewhereBooks, MissingBooks, placeName, useLookup, useMapHere, VerseSheet } from './acrossBooks'

/** A rendering's places are listed at once up to this many; more wait behind «Ver los N lugares». */
const SHOWN_PLACES = 12

export function EnTodaLaBiblia({ data, strong }: { data: PrototypeData; strong: string }) {
  const t = useT()
  const here = useMapHere(data.language, 'xmap')
  const [open, setOpen] = useState(false)
  const [verse, setVerse] = useState<string | null>(null)
  const word = useLookup(open && here, data.language, `renderings ${strong}`, async (reader) => {
    const answer = await reader.renderings({ strong })
    // The reader adds the texts together; by text, and the word counted once, from the books themselves.
    const byText = renderingsByText(await booksRead(reader), answer.data?.strong ?? strong)
    return wordAcrossBooks(answer, byText, (book) => reader.listed(`book:${book}`))
  })
  if (!here || (word && !word.installed)) return null
  const labelOf = (res: string) => data.texts.find((x) => x.key === res)?.abbreviation ?? res.slice(res.lastIndexOf('/') + 1).toUpperCase()

  const count =
    word && word.total > 0
      ? word.total === 1
        ? t('ayudas.enTodaLaBibliaUnaVez')
        : word.books === 1
          ? t('ayudas.enTodaLaBibliaCuentaUnLibro', { n: word.total })
          : t('ayudas.enTodaLaBibliaCuenta', { n: word.total, libros: word.books })
      : t('ayudas.enTodaLaBibliaNada')

  return (
    <details className="word-help-other across" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('ayudas.enTodaLaBiblia')}</summary>
      {word && (
        <>
          <p className="quiet">{count}</p>
          {/* Each bridge text apart, by its name in the panes (TPL, TPS): how one renders it is not how the other does. */}
          {word.texts.map((x) => (
            <section key={x.res} className="across-text">
              {word.texts.length > 1 && <p className="word-help-label">{labelOf(x.res)}</p>}
              <ul className="across-renderings">
                {x.renderings.map((r) => (
                  <RenderingRow key={r.text} rendering={r} folded={word.folded} onPlace={setVerse} />
                ))}
              </ul>
            </section>
          ))}
          <MissingBooks language={data.language} books={word.missing} />
          <ElsewhereBooks books={word.elsewhere} />
        </>
      )}
      {verse && <VerseSheet data={data} place={verse} onClose={() => setVerse(null)} />}
    </details>
  )
}

/** One way the word is rendered: the words and how many times; its places, or «Ver los N lugares» while folded. */
function RenderingRow({ rendering, folded, onPlace }: { rendering: Rendering; folded: boolean; onPlace(ref: string): void }) {
  const t = useT()
  const [shown, setShown] = useState(rendering.refs.length === 1 || (!folded && rendering.refs.length <= SHOWN_PLACES))
  return (
    <li className="across-rendering">
      <p className="across-rendering-head">
        <strong>{rendering.text}</strong>
        <span className="quiet"> · {rendering.count === 1 ? t('ayudas.unaVez') : t('ayudas.vecesN', { n: rendering.count })}</span>
      </p>
      {shown ? (
        <div className="chip-row">
          {rendering.refs.map((ref) => (
            <button key={ref} type="button" className="chip" onClick={() => onPlace(ref)}>
              {placeName(ref)}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="word-help-read" onClick={() => setShown(true)}>
          {t('ayudas.verLugares', { n: rendering.refs.length })} ›
        </button>
      )}
    </li>
  )
}
