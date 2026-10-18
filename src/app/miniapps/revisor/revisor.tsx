/**
 * Revisar el pasaje: a section of the team's translation read through and weighed by four questions, one at a time
 * (faithful, clear, natural, precise; `projects/passageReview.ts`). The checks with the notes and the words go phrase by
 * phrase; this one hears the passage whole, as a reader would.
 *
 * The translation is in the centre; the source a touch away, to weigh faithfulness and precision against it. «Yes»
 * goes on to the next question; «something to improve» marks the words with the finger (as the other reviews do) and
 * either opens the editor there, or notes it for later: the editor shows it under its verse until someone marks it
 * improved. With the four answered, the way on is the next section.
 */

import { useWide } from '../../frame/Panes'
import { useState } from 'react'
import { chapterOf, type PrototypeData } from '../../../prototype/data'
import { WordLines } from '../../frame/TouchWords'
import { WordPicker } from '../../frame/WordPicker'
import { useT } from '../../i18n/i18n'
import {
  CRITERIA,
  addObservation,
  answer,
  answersOf,
  observationsOf,
  passageDone,
  resolveObservation,
  type Criterion,
  type Observation,
} from '../../projects/passageReview'
import { joinStartOf, joinedVerses, textOf } from '../../projects/work'
import type { MiniApp, MiniAppCenterProps, Position } from '../contract'

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean)

/** The verses of a section as the team writes them: a join once, by its first verse. */
const unitsOf = (book: string, chapter: number, verses: number[]) => verses.filter((v) => joinStartOf(book, chapter, v) === v)

function Center({ context }: MiniAppCenterProps) {
  const { t, position, shown, data, person, frame } = context
  const { book, chapter } = position
  const units = unitsOf(book, chapter, shown)
  const texts = units.map((v) => textOf(book, chapter, v))
  const [, redraw] = useState(0)
  const answers = answersOf(book, chapter, shown, texts)
  const firstOpen = CRITERIA.find((c) => !answers[c]) ?? null
  const [chosen, setChosen] = useState<Criterion | null>(null)
  const sectionKey = `${book}.${chapter}.${shown.join(',')}`
  const [key, setKey] = useState(sectionKey)
  const [marking, setMarking] = useState(false)
  const [picked, setPicked] = useState<{ verse: number; words: number[] } | null>(null)
  const [comment, setComment] = useState('')
  const [source, setSource] = useState<string | null>(null)
  if (key !== sectionKey) {
    // Another section: from its first question left, nothing marked.
    setKey(sectionKey)
    setChosen(null)
    setMarking(false)
    setPicked(null)
    setComment('')
  }
  const criterion = chosen ?? firstOpen
  const observations = units.flatMap((v) => observationsOf(book, chapter, v))
  const open = observations.filter((o) => o.state === 'abierta')
  // Wide, the translation and a source are side by side from the start; on a phone the source is a touch away.
  const wide = useWide()
  const sourceShown = source ?? (wide ? (data.texts.find((x) => !x.original)?.abbreviation ?? null) : null)
  const shownSource = sourceShown ? data.texts.find((x) => x.abbreviation === sourceShown) : null

  const yes = () => {
    if (!criterion) return
    answer(book, chapter, shown, texts, criterion, person.name)
    setChosen(null)
    setMarking(false)
    redraw((n) => n + 1)
  }
  const noteLater = () => {
    if (!criterion || !picked) return
    const words = wordsOf(texts[units.indexOf(picked.verse)] ?? '')
    addObservation(book, chapter, {
      verse: picked.verse,
      criterion,
      words: picked.words.map((i) => words[i]).join(' '),
      comment: comment.trim(),
      by: person.name,
    })
    // Seen and noted: the question is answered for now; the section is not done while the note is open.
    answer(book, chapter, shown, texts, criterion, person.name)
    setMarking(false)
    setPicked(null)
    setComment('')
    setChosen(null)
    redraw((n) => n + 1)
  }

  const somethingToImprove = (
    <button type="button" className="button-secondary" onClick={() => setMarking(true)}>
      {t('revisor.hayAlgo')}
    </button>
  )

  if (!texts.some((x) => x.trim())) {
    return (
      <div className="review">
        <div className="review-empty">
          <p className="quiet">{t('revisor.sinTraducir')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="review passage">
      <div className="review-scroll">
        {/* The four questions, each with how it stands: answered, or with something to improve. */}
        <ol className="review-stepper passage-steps">
          {CRITERIA.map((c) => {
            const notes = open.filter((o) => o.criterion === c).length
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-current={c === criterion ? 'step' : undefined}
                  className={answers[c] && !notes ? 'is-done' : notes ? 'has-notes' : undefined}
                  onClick={() => {
                    setChosen(c)
                    setMarking(false)
                  }}
                >
                  <span className="review-stepper-n">{notes ? '!' : answers[c] ? '✓' : CRITERIA.indexOf(c) + 1}</span>
                  {t(`revisor.c.${c}`)}
                </button>
              </li>
            )
          })}
        </ol>

        {criterion ? (
          <section className="passage-question">
            <h2>{t(`revisor.q.${criterion}`)}</h2>
            <p className="quiet">{t(`revisor.ayuda.${criterion}`)}</p>
          </section>
        ) : (
          <p className="review-done">✓ {t(open.length ? 'revisor.revisadoConNotas' : 'revisor.revisado', { n: open.length })}</p>
        )}

        <div className="passage-compare">
          {/* The team's translation of the section, in the centre; its words to mark when something is to improve. */}
          <section className="passage-text" aria-label={t('revisor.suTraduccion')}>
            {marking && <p className="review-instruction">{t('revisor.marque')}</p>}
            {units.map((v, i) => {
              const joined = joinedVerses(book, chapter, v)
              return (
                <div key={v} className="passage-verse">
                  <span className="verse-number">{joined.length > 1 ? `${v}–${joined[joined.length - 1]}` : v}</span>
                  {marking ? (
                    <WordPicker
                      words={wordsOf(texts[i])}
                      picked={picked?.verse === v ? picked.words : []}
                      onChange={(words) => setPicked(words.length ? { verse: v, words } : null)}
                    />
                  ) : (
                    <span className="passage-verse-text">{texts[i] || '—'}</span>
                  )}
                </div>
              )
            })}
          </section>

          {/* The source, a layer away: to weigh faithfulness and precision against it. */}
          <div className="passage-source">
            <div className="review-quote-switch" role="radiogroup" aria-label={t('revisor.comparar')}>
              {data.texts.map((x) => (
                <button
                  key={x.abbreviation}
                  type="button"
                  role="radio"
                  aria-checked={sourceShown === x.abbreviation}
                  onClick={() => setSource(wide ? x.abbreviation : sourceShown === x.abbreviation ? null : x.abbreviation)}
                >
                  {x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation}
                </button>
              ))}
            </div>
            {shownSource ? (
              <div className="versions-source" dir={shownSource.dir}>
                {shown.map((v) => (
                  <WordLines key={v} lines={shownSource.lines[v] ?? []} verse={v} lit={new Set()} onWord={() => {}} />
                ))}
              </div>
            ) : (
              <p className="quiet passage-source-hint">{t('revisor.compararAyuda')}</p>
            )}
          </div>
        </div>

        {marking && (
          <section className="passage-improve">
            <label className="field">
              <span className="field-label">{t('revisor.queMejorar')}</span>
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <button type="button" className="button-secondary" disabled={!picked} onClick={() => picked && frame.open('editor', { book, chapter, verse: picked.verse })}>
              {t('revisor.mejorarAhora')}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setMarking(false)
                setPicked(null)
              }}
            >
              {t('revisor.nadaQueMejorar')}
            </button>
          </section>
        )}
        {/* On a wide window it goes beside «Yes», at the foot (principle 13); on a phone, under what is compared. */}
        {!marking && criterion && !wide && somethingToImprove}

        {observations.length > 0 && (
          <section className="passage-notes" aria-label={t('revisor.paraMejorar')}>
            <h3>{t('revisor.paraMejorar')}</h3>
            {observations.map((o) => (
              <ObservationRow
                key={o.id}
                o={o}
                onResolve={() => {
                  resolveObservation(book, chapter, o.verse, o.id, person.name)
                  redraw((n) => n + 1)
                }}
              />
            ))}
          </section>
        )}
      </div>

      <div className="review-next">
        {marking ? (
          <button type="button" className="button-primary" disabled={!picked} onClick={noteLater}>
            {t('revisor.anotar')}
          </button>
        ) : criterion ? (
          <button type="button" className="button-primary" onClick={yes}>
            {t(`revisor.si.${criterion}`)}
          </button>
        ) : null}
        {!marking && criterion && wide && somethingToImprove}
        {marking && !picked && <p className="quiet review-hint">{t('revisor.primeroMarque')}</p>}
      </div>
    </div>
  )
}

/** Something seen to improve: where, why, by whom; and the way to say it is done. Also shown in the editor. */
export function ObservationRow({ o, onResolve }: { o: Observation; onResolve(): void }) {
  const t = useT()
  return (
    <div className={`observation is-${o.state}`}>
      <p className="observation-head">
        <strong>
          {o.verse} · {t(`revisor.c.${o.criterion}`)}
        </strong>{' '}
        <span className="quiet">{t('revisor.de', { nombre: o.by })}</span>
      </p>
      {o.words && <p className="observation-words">«{o.words}»</p>}
      {o.comment && <p>{o.comment}</p>}
      {o.state === 'abierta' ? (
        <button type="button" className="button-secondary" onClick={onResolve}>
          {t('revisor.yaMejorado')}
        </button>
      ) : (
        <p className="quiet">✓ {t('revisor.mejoradoPor', { nombre: o.resolvedBy ?? '' })}</p>
      )}
    </div>
  )
}

/**
 * What is open to improve in a verse, under its box in the editor: there it is seen while writing, and marked improved
 * once it is.
 */
export function VerseObservations({ book, chapter, verse, person }: { book: string; chapter: number; verse: number; person: string }) {
  const [, redraw] = useState(0)
  const open = observationsOf(book, chapter, verse).filter((o) => o.state === 'abierta')
  if (!open.length) return null
  return (
    <div className="verse-observations">
      {open.map((o) => (
        <ObservationRow
          key={o.id}
          o={o}
          onResolve={() => {
            resolveObservation(book, chapter, verse, o.id, person)
            redraw((n) => n + 1)
          }}
        />
      ))}
    </div>
  )
}

/** The verses of the section a verse is in, as the bridge text's sections go. */
function sectionOf(data: PrototypeData | null, verse: number): number[] {
  return data?.sections.find((s) => s.includes(verse)) ?? [verse]
}

const doneAt = (at: Position) => {
  const verses = sectionOf(chapterOf(at.book, at.chapter), at.verse)
  const units = unitsOf(at.book, at.chapter, verses)
  return passageDone(at.book, at.chapter, verses, units.map((v) => textOf(at.book, at.chapter, v)))
}

export const revisor: MiniApp = {
  id: 'revisor',
  needs: ['text'],
  phase: 'revision',
  unit: 'section',
  sections: true,
  helps: false,
  fills: true,
  writes: false,
  done: doneAt,
  Center,
  texts: {
    es: {
      nombre: 'Revisar el pasaje',
      descripcion: 'Leer cada sección entera y ver si es fiel, clara, natural y precisa',
      'c.fiel': 'Fiel',
      'c.claro': 'Claro',
      'c.natural': 'Natural',
      'c.preciso': 'Preciso',
      'q.fiel': '¿Dice lo mismo que el texto fuente?',
      'q.claro': '¿Se entiende a la primera?',
      'q.natural': '¿Suena como habla la gente?',
      'q.preciso': '¿Los detalles están bien?',
      'ayuda.fiel': 'Compárelo con el TPL, el TPS o el original: que no falte nada ni sobre nada.',
      'ayuda.claro': 'Léalo en voz alta, como si lo oyera alguien que no conoce el pasaje.',
      'ayuda.natural': 'Que no suene a traducción: el orden, las palabras y las uniones de su idioma.',
      'ayuda.preciso': 'Nombres, números, lugares y palabras clave: que estén y que estén bien.',
      'si.fiel': 'Sí, dice lo mismo',
      'si.claro': 'Sí, se entiende',
      'si.natural': 'Sí, suena natural',
      'si.preciso': 'Sí, los detalles están bien',
      revisado: 'Pasaje revisado: fiel, claro, natural y preciso.',
      revisadoConNotas: 'Las cuatro preguntas tienen respuesta. Queda por mejorar: {n}.',
      suTraduccion: 'Su traducción',
      comparar: 'Comparar con',
      compararAyuda: 'Toque un texto para compararlo con su traducción.',
      'compararAyuda.computadora': 'Haga clic en un texto para compararlo con su traducción.',
      hayAlgo: 'Hay algo que mejorar',
      marque: 'Toque o deslice el dedo sobre las palabras que hay que mejorar:',
      'marque.computadora': 'Haga clic o arrastre el ratón sobre las palabras que hay que mejorar:',
      queMejorar: '¿Qué hay que mejorar? (opcional)',
      mejorarAhora: 'Mejorarlo ahora por escrito',
      nadaQueMejorar: 'No, no hay nada',
      anotar: 'Anotarlo para después',
      primeroMarque: 'Primero marque las palabras.',
      paraMejorar: 'Para mejorar en este pasaje',
      de: 'lo vio {nombre}',
      yaMejorado: 'Ya está mejorado',
      mejoradoPor: 'Mejorado · lo marcó {nombre}',
      siguiente: 'Siguiente sección',
      sinTraducir: 'Este pasaje todavía no está traducido.',
    },
    pt: {
      nombre: 'Revisar a passagem',
      descripcion: 'Ler cada seção inteira e ver se é fiel, clara, natural e precisa',
      'c.fiel': 'Fiel',
      'c.claro': 'Clara',
      'c.natural': 'Natural',
      'c.preciso': 'Precisa',
      'q.fiel': 'Diz o mesmo que o texto-fonte?',
      'q.claro': 'Dá para entender de primeira?',
      'q.natural': 'Soa como as pessoas falam?',
      'q.preciso': 'Os detalhes estão certos?',
      'ayuda.fiel': 'Compare com o TPL, o TPS ou o original: que não falte nem sobre nada.',
      'ayuda.claro': 'Leia em voz alta, como se alguém que não conhece a passagem estivesse ouvindo.',
      'ayuda.natural': 'Que não soe a tradução: a ordem, as palavras e as ligações da sua língua.',
      'ayuda.preciso': 'Nomes, números, lugares e palavras-chave: que estejam e que estejam certos.',
      'si.fiel': 'Sim, diz o mesmo',
      'si.claro': 'Sim, dá para entender',
      'si.natural': 'Sim, soa natural',
      'si.preciso': 'Sim, os detalhes estão certos',
      revisado: 'Passagem revisada: fiel, clara, natural e precisa.',
      revisadoConNotas: 'As quatro perguntas têm resposta. Falta melhorar: {n}.',
      suTraduccion: 'Sua tradução',
      comparar: 'Comparar com',
      compararAyuda: 'Toque num texto para compará-lo com sua tradução.',
      'compararAyuda.computadora': 'Clique num texto para compará-lo com sua tradução.',
      hayAlgo: 'Há algo para melhorar',
      marque: 'Toque ou deslize o dedo sobre as palavras que precisam melhorar:',
      'marque.computadora': 'Clique ou arraste o mouse sobre as palavras que precisam melhorar:',
      queMejorar: 'O que precisa melhorar? (opcional)',
      mejorarAhora: 'Melhorar agora por escrito',
      nadaQueMejorar: 'Não, não há nada',
      anotar: 'Anotar para depois',
      primeroMarque: 'Primeiro marque as palavras.',
      paraMejorar: 'Para melhorar nesta passagem',
      de: '{nombre} viu',
      yaMejorado: 'Já está melhorado',
      mejoradoPor: 'Melhorado · {nombre} marcou',
      siguiente: 'Próxima seção',
      sinTraducir: 'Esta passagem ainda não está traduzida.',
    },
    en: {
      nombre: 'Check the passage',
      descripcion: 'Read each section whole and see whether it is faithful, clear, natural and precise',
      'c.fiel': 'Faithful',
      'c.claro': 'Clear',
      'c.natural': 'Natural',
      'c.preciso': 'Precise',
      'q.fiel': 'Does it say what the source says?',
      'q.claro': 'Is it understood the first time?',
      'q.natural': 'Does it sound as people speak?',
      'q.preciso': 'Are the details right?',
      'ayuda.fiel': 'Compare it with the TPL, the TPS or the original: nothing missing, nothing added.',
      'ayuda.claro': 'Read it aloud, as if someone who does not know the passage heard it.',
      'ayuda.natural': 'That it does not sound translated: the order, words and links of your language.',
      'ayuda.preciso': 'Names, numbers, places and key words: there, and right.',
      'si.fiel': 'Yes, it says the same',
      'si.claro': 'Yes, it is understood',
      'si.natural': 'Yes, it sounds natural',
      'si.preciso': 'Yes, the details are right',
      revisado: 'Passage checked: faithful, clear, natural and precise.',
      revisadoConNotas: 'The four questions are answered. Left to improve: {n}.',
      suTraduccion: 'Your translation',
      comparar: 'Compare with',
      compararAyuda: 'Touch a text to compare it with your translation.',
      'compararAyuda.computadora': 'Click a text to compare it with your translation.',
      hayAlgo: 'Something to improve',
      marque: 'Touch or slide your finger over the words to improve:',
      'marque.computadora': 'Click or drag the mouse over the words to improve:',
      queMejorar: 'What is to improve? (optional)',
      mejorarAhora: 'Improve it now in writing',
      nadaQueMejorar: 'No, nothing',
      anotar: 'Note it for later',
      primeroMarque: 'First mark the words.',
      paraMejorar: 'To improve in this passage',
      de: 'seen by {nombre}',
      yaMejorado: 'It is improved',
      mejoradoPor: 'Improved · marked by {nombre}',
      siguiente: 'Next section',
      sinTraducir: 'This passage is not translated yet.',
    },
  },
}
