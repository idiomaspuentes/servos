import { describe, expect, it } from 'vitest'
import type { AlignmentGroup } from '@usfm-tools/types'
import { alignedLines } from './usfmExport'
import { readUsfmBook } from './usfmImport'

const jonah = { strong: 'H3124', lemma: 'יוֹנָה', content: 'יוֹנָה', occurrence: 1, occurrences: 1 }
const rose = { strong: 'H6965', lemma: 'קוּם', morph: 'He,Vqw3ms', content: 'וַיָּקָם', occurrence: 1, occurrences: 1 }

describe('a verse written with its alignment to the original', () => {
  it('wraps each word, the aligned ones inside their group, punctuation outside', () => {
    const groups: AlignmentGroup[] = [
      { sources: [jonah], targets: [{ word: 'Jonasca', occurrence: 1, occurrences: 1 }] },
      { sources: [rose], targets: [{ word: 'sharirca', occurrence: 1, occurrences: 1 }, { word: 'nirca', occurrence: 1, occurrences: 1 }] },
    ]
    const [line] = alignedLines(['Jonasca, sharirca nirca ñuca.'], groups)
    expect(line).toBe(
      String.raw`\zaln-s |x-strong="H3124" x-lemma="יוֹנָה" x-occurrence="1" x-occurrences="1" x-content="יוֹנָה"\*\w Jonasca|x-occurrence="1" x-occurrences="1"\w*\zaln-e\*,` +
        String.raw` \zaln-s |x-strong="H6965" x-lemma="קוּם" x-morph="He,Vqw3ms" x-occurrence="1" x-occurrences="1" x-content="וַיָּקָם"\*\w sharirca|x-occurrence="1" x-occurrences="1"\w* \w nirca|x-occurrence="1" x-occurrences="1"\w*\zaln-e\*` +
        String.raw` \w ñuca|x-occurrence="1" x-occurrences="1"\w*.`
    )
  })

  it('counts a repeated word, and aligns only the occurrence the group names', () => {
    const groups: AlignmentGroup[] = [{ sources: [jonah], targets: [{ word: 'pay', occurrence: 2, occurrences: 2 }] }]
    const [line] = alignedLines(['pay rimarca pay'], groups)
    expect(line.startsWith(String.raw`\w pay|x-occurrence="1" x-occurrences="2"\w*`)).toBe(true)
    expect(line.endsWith(String.raw`\w pay|x-occurrence="2" x-occurrences="2"\w*\zaln-e\*`)).toBe(true)
  })

  it('reads back as the plain verse', () => {
    const groups: AlignmentGroup[] = [{ sources: [jonah], targets: [{ word: 'Jonasca', occurrence: 1, occurrences: 1 }] }]
    const usfm = `\\id JON\n\\c 1\n\\p\n\\v 1 ${alignedLines(['Jonasca, rircami.'], groups)[0]}\n`
    expect(readUsfmBook(usfm, 'Ana').book.verses[0].text).toBe('Jonasca, rircami.')
  })
})
