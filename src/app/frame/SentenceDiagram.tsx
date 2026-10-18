/**
 * How the sentence a word is in is built, as Taller draws it on a phone (`SideTree` in its `SentenceSheet.tsx`): the
 * sentence at the near edge, each part a step further in, named by the question it answers (Who? What happens? To
 * whom?), and the words in a column at the far edge in the order they are read. Under each word, its meaning in the
 * lexicon, who does a verb and how, and the words of the bridge text aligned to it, for whoever does not read the
 * original. From MACULA (Biblica, CC BY 4.0); read only here, the team's own diagrams are Taller's for now.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { lexiconOf } from '../../prototype/data'
import { treesOf } from '../../prototype/original'
import { glossOfWord, strongCode, strongParts } from '../../lexicon/lexicon'
import { verbHint } from '../../original/morphology'
import { clauseKind, isClause, leavesOf, LINK, sentenceFits, sentenceShape, sentencesAt, type TreeLeaf, type TreeNode } from '../../original/syntaxTree'
import { layoutSideways } from '../../original/treeLayout'
import { useT } from '../i18n/i18n'
import { maculaCount, maculaPlace, originalText } from './OriginalWord'
import { Sheet } from './Sheet'
import { placesOfOriginals, wordAt } from './TouchWords'

const ROLE: Record<string, string> = {
  v: 'st.v',
  s: 'st.s',
  o: 'st.o',
  o2: 'st.o2',
  io: 'st.io',
  p: 'st.p',
  vc: 'st.vc',
  adv: 'st.adv',
  pp: 'st.pp',
  aux: 'st.aux',
  [LINK]: 'st.link',
}

/** Each step into the tree, the room of a part's name and of a word, and the column of the words. */
const STEP = 14
const PILL = 22
const SIDE_NODE = 30
const SIDE_LEAF = 92
const SIDE_WORDS = 148

const pillWidth = (name: string) => name.length * 7.2 + 18

export function SentenceDiagram({ data, verse, place, onClose }: { data: PrototypeData; verse: number; place: number; onClose(): void }) {
  const t = useT()
  const original = data.texts.find((x) => x.original)
  const bridge = data.texts.find((x) => !x.original)
  const file = treesOf(data.book.id)
  const sentences = file
    ? sentencesAt(file, { chapter: data.chapter, verse }).filter((s) =>
        sentenceFits(file, s, (p) => (p.chapter === data.chapter ? maculaCount(data, p.verse) : undefined))
      )
    : []

  const name = (node: TreeNode, parent: TreeNode | undefined, nth?: number) => {
    const role = ROLE[node.role] ? t(ROLE[node.role]) : ''
    if (!isClause(node)) return role || '·'
    const kind = clauseKind(node, parent)
    if (kind === 'as') return t('st.treeAs', { role })
    if (kind === 'describes') return t('st.treeSub')
    return kind === 'joined' && nth ? t('st.partN', { n: nth }) : t('st.clause')
  }
  const leafPlace = (leaf: TreeLeaf) => (leaf.chapter === data.chapter ? maculaPlace(data, leaf.verse, leaf.word) : undefined)

  return (
    <Sheet title={t('st.title')} onClose={onClose}>
      {!sentences.length && <p className="quiet">{t('st.none')}</p>}
      {sentences.map((sentence, i) => {
        const shape = sentenceShape(sentence.root)
        // How many pieces of each word the sentence holds: of a word two parts share, the meaning goes with the verb.
        const pieces = new Map<string, number>()
        for (const leaf of leavesOf(sentence.root)) pieces.set(`${leaf.chapter}:${leaf.verse}:${leaf.word}`, (pieces.get(`${leaf.chapter}:${leaf.verse}:${leaf.word}`) ?? 0) + 1)
        return (
          <section key={i} className="diagram">
            <p className="quiet">
              {shape.subordinate
                ? t('st.complex', { sub: shape.subordinate })
                : shape.joined > 1
                  ? t('st.compound', { joined: shape.joined })
                  : t('st.simple')}
            </p>
            <SideTree
              root={sentence.root}
              rtl={original?.dir === 'rtl'}
              name={name}
              word={(leaf, role) => {
                const p = leafPlace(leaf)
                if (p === undefined) return <span className="diagram-word">…</span>
                const w = original?.words?.[p]
                const at = { book: data.book.id.toUpperCase(), chapter: leaf.chapter, verse: leaf.verse }
                const marker = w ? strongParts(w.strong).some((part) => strongCode(part) === 'H0853') : false
                const found = w && !marker ? lexiconOf(w.strong) : null
                const gloss = marker ? t('st.objectMarker') : found ? glossOfWord(found.file, at, found.letter) : ''
                const hint = w ? verbHint(w.morph) : null
                const aligned = bridge ? (placesOfOriginals(data, [p])[bridge.abbreviation] ?? []).map((q) => wordAt(bridge, q)).join(' ') : ''
                // Under the «me» of «me rodearon» it would say «rodear»; the «and» Hebrew joins to a word is always «and».
                const whole = !leaf.piece || role === 'v' || (role !== LINK && (pieces.get(`${leaf.chapter}:${leaf.verse}:${leaf.word}`) ?? 0) <= 1)
                const joining = !whole && role === LINK && original?.dir === 'rtl'
                return (
                  <span className="diagram-word" data-here={p === place || undefined}>
                    <span className="diagram-original" lang={original?.lang} dir={original?.dir}>
                      {leaf.piece ?? originalText(data, p)}
                    </span>
                    {joining && <span className="diagram-gloss">{t('st.and')}</span>}
                    {whole && gloss && gloss !== '-' && <span className="diagram-gloss">{gloss}</span>}
                    {whole && hint && (
                      <span className="diagram-morph">
                        {[hint.who, hint.how]
                          .filter(Boolean)
                          .map((key) => t(key as string))
                          .join(' · ')}
                      </span>
                    )}
                    {whole && aligned && (
                      <span className="diagram-aligned">
                        {bridge?.abbreviation}: {aligned}
                      </span>
                    )}
                  </span>
                )
              }}
            />
          </section>
        )
      })}
      <p className="quiet lexicon-credit">{t('st.credit')}</p>
    </Sheet>
  )
}

function SideTree({
  root,
  rtl,
  name,
  word,
}: {
  root: TreeNode
  rtl: boolean
  name(node: TreeNode, parent: TreeNode | undefined, nth?: number): string
  word(leaf: TreeLeaf, role: string): React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(element)
    return () => watch.disconnect()
  }, [])
  const layout = useMemo(
    () =>
      layoutSideways(root, {
        node: SIDE_NODE,
        leaf: SIDE_LEAF,
        beside: (node, parent, depth) => depth * STEP + pillWidth(name(node, parent, 9)) + 8 <= width - SIDE_WORDS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [root, width]
  )
  useEffect(() => {
    // On the word one came from, inside the sheet only.
    const here = box.current?.querySelector<HTMLElement>('.diagram-word[data-here]')
    const scroller = box.current?.closest<HTMLElement>('.sheet-body')
    if (here && scroller) scroller.scrollTop += here.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 3
  }, [layout])
  const trunk = (depth: number) => depth * STEP + 9
  const words = Math.max(0, width - SIDE_WORDS)
  return (
    <div className="diagram-side" ref={box} dir={rtl ? 'rtl' : 'ltr'} style={{ height: layout.height }}>
      {width > 0 && (
        <>
          <svg width={width} height={layout.height} aria-hidden>
            {layout.branches.map((branch, i) => (
              <g key={i}>
                {branch.to > branch.from && <line x1={trunk(branch.depth)} y1={branch.from} x2={trunk(branch.depth)} y2={branch.to} />}
                {branch.twigs.map((twig, k) => (
                  <line key={k} x1={trunk(branch.depth)} y1={twig.y} x2={twig.leaf ? words : (branch.depth + 1) * STEP} y2={twig.y} />
                ))}
              </g>
            ))}
          </svg>
          {layout.nodes.map((placed) => {
            const clause = isClause(placed.node)
            return (
              <span
                key={placed.path.join('.') || 'root'}
                className="diagram-node"
                data-role={placed.node.role || undefined}
                data-clause={clause || undefined}
                data-kind={clause ? clauseKind(placed.node, placed.parent) : undefined}
                style={{ insetInlineStart: placed.depth * STEP, top: placed.y - PILL / 2 }}
              >
                {name(placed.node, placed.parent, placed.nth)}
              </span>
            )
          })}
          {layout.leaves.map((placed) => (
            <div
              key={placed.path.join('.')}
              className="diagram-leaf"
              style={{ insetInlineEnd: 0, top: placed.y - SIDE_LEAF / 2 + 2, width: SIDE_WORDS - 4, height: SIDE_LEAF - 4 }}
            >
              {word(placed.leaf, placed.role)}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
