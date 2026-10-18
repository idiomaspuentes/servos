/**
 * The world's languages as Door43 lists them (`GET {host}/api/v1/languages/langnames.json`, public), to choose a
 * project's language by searching its name instead of knowing its code, as Taller does (`src/dcs/languages.ts`,
 * `src/domain/languages.ts`). Servos works without internet first: the list that came with the app
 * (`door43-languages.json`, read from Door43 on 23 September 2026, 9165 languages) is what is searched, or the one
 * read from Door43 since and kept on the phone; when there is a connection, the list is read again and kept for the
 * next time.
 */

export interface LanguageOption {
  code: string
  name: string
  /** Its other names: in English, and those it is also known by. */
  aliases: string[]
  /** A gateway language (Spanish, Portuguese…). */
  gateway?: boolean
}

interface Door43Row {
  lc?: unknown
  ln?: unknown
  ang?: unknown
  alt?: unknown
  gw?: unknown
}

export const LANGNAMES_URL = 'https://git.door43.org/api/v1/languages/langnames.json'
const KEPT = 'servos.idiomas.door43'

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function languageFromDoor43(row: Door43Row): LanguageOption | null {
  const code = text(row.lc).toLowerCase()
  if (!code) return null
  const ln = text(row.ln)
  const ang = text(row.ang)
  const name = ln || ang || code
  const alt = Array.isArray(row.alt) ? row.alt.map(text).filter(Boolean) : []
  const aliases = [...new Set([ln, ang, ...alt])].filter((a) => a && a !== name)
  return { code, name, aliases, ...(row.gw === true ? { gateway: true } : {}) }
}

/** The list from what Door43 sends (`{ languages: [...] }`, or the rows alone). */
export function languagesFromDoor43(raw: unknown): LanguageOption[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { languages?: unknown })?.languages) ? (raw as { languages: unknown[] }).languages : []
  const byCode = new Map<string, LanguageOption>()
  for (const row of rows) {
    const option = row && typeof row === 'object' ? languageFromDoor43(row as Door43Row) : null
    if (option && !byCode.has(option.code)) byCode.set(option.code, option)
  }
  return [...byCode.values()]
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * The languages that match what was typed, the likeliest first: the code itself, then a name that begins with it,
 * then one of its other names that does, then a name or another name that holds it; gateway languages before the
 * others alike. Accents do not count: «quechua» finds «Quechua», «espanol» finds «Español».
 */
export function searchLanguages(list: LanguageOption[], query: string, limit = 8): LanguageOption[] {
  const q = fold(query.trim())
  if (!q) return []
  const scored: Array<[number, LanguageOption]> = []
  for (const lang of list) {
    const name = fold(lang.name)
    const others = lang.aliases.map(fold)
    const score =
      lang.code === q
        ? 0
        : name.startsWith(q)
          ? 1
          : others.some((a) => a.startsWith(q))
            ? 2
            : lang.code.startsWith(q)
              ? 3
              : name.includes(q)
                ? 4
                : others.some((a) => a.includes(q))
                  ? 5
                  : -1
    if (score >= 0) scored.push([score * 2 + (lang.gateway ? 0 : 1), lang])
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, lang]) => lang)
}

/**
 * Languages usually written from right to left: a chosen one sets the project's direction, which the person can still
 * change. Door43's list does not say it.
 */
const RIGHT_TO_LEFT = new Set(['ar', 'arb', 'arc', 'ckb', 'dv', 'fa', 'pes', 'prs', 'glk', 'he', 'hbo', 'ku-arab', 'mzn', 'ps', 'pbt', 'sd', 'syr', 'ug', 'ur', 'yi', 'ydd'])
export const writtenRightToLeft = (code: string) => RIGHT_TO_LEFT.has(code.toLowerCase())

/**
 * A language's name in the languages the app speaks (`es-419` → «Español de Latinoamérica»), from the browser, which
 * knows it without internet; its code when the browser does not know it. Door43's names mix languages («Español Latin
 * America»).
 */
export function languageLabel(code: string, speaking: string[]): string {
  try {
    const name = new Intl.DisplayNames([...speaking, 'es'], { type: 'language' }).of(code)
    if (name && name.toLowerCase() !== code.toLowerCase()) return name.charAt(0).toLocaleUpperCase() + name.slice(1)
  } catch {
    // A code the browser refuses: said as it is.
  }
  return code
}

let memory: LanguageOption[] | null = null

function readKept(): LanguageOption[] | null {
  try {
    const raw = localStorage.getItem(KEPT)
    const list = raw ? languagesFromDoor43(JSON.parse(raw)) : []
    return list.length ? list : null
  } catch {
    return null
  }
}

function keep(list: LanguageOption[]) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(list.map((l) => ({ lc: l.code, ln: l.name, alt: l.aliases, ...(l.gateway ? { gw: true } : {}) }))))
  } catch {
    /* the list that came with the app is still there */
  }
}

/** Read the list again from Door43, when there is a connection, and keep it for the next time. */
async function refresh() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  try {
    const res = await fetch(LANGNAMES_URL)
    if (!res.ok) return
    const list = languagesFromDoor43(await res.json())
    if (list.length > 1000) {
      memory = list
      keep(list)
    }
  } catch {
    /* without internet, or Door43 did not answer: the list on the phone stays */
  }
}

/** The list to search: at once from the phone; Door43 is asked in the background for the next time. */
export async function loadLanguages(): Promise<LanguageOption[]> {
  if (memory) return memory
  memory = readKept() ?? languagesFromDoor43((await import('./door43-languages.json')).default)
  void refresh()
  return memory
}
