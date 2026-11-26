/**
 * Which format 3 catalogs are languages. `common` is the originals' catalog, and a `zxx-*` catalog holds companions
 * shared by every language (`zxx-obsimg`, the OBS images; ISO 639 `zxx` means "no linguistic content"): neither is a
 * language, so no list of languages built from catalog names shows them.
 */
export function isLanguageCatalog(name: string): boolean {
  return name !== 'common' && !name.startsWith('zxx-')
}

/** The languages among catalog names, in their order. */
export function languageCatalogs(names: Iterable<string>): string[] {
  return [...names].filter(isLanguageCatalog)
}
