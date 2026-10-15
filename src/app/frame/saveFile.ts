/**
 * Saving a file the app made (a book shared, the glossary) where the person keeps it. On a phone or a computer it is a
 * download. The prototype, shared as one page inside Claude, cannot download by itself: there the page asks the
 * viewer to accept the file (its `downloads` capability), and the extensions it may give are a fixed list, so a
 * `.servos` file goes as `.servos.json`, which «Receive» opens all the same.
 */

type Downloads = { save(request: { filename: string; data: string }): Promise<unknown> }
type Host = { use(name: string): Promise<unknown> }

/** Saved, refused by the person, or not possible here; and the name it was given. */
export type Saved = { state: 'saved' | 'declined' | 'failed'; name: string }

const ALLOWED = /\.(json|txt|md|csv|html|zip)$/i

export async function saveFile(filename: string, text: string, type = 'application/json'): Promise<Saved> {
  const host = (window as unknown as { claude?: Host }).claude
  if (host?.use) {
    const downloads = (await host.use('downloads').catch(() => null)) as Downloads | null
    if (downloads) {
      const name = ALLOWED.test(filename) ? filename : `${filename}.json`
      try {
        await downloads.save({ filename: name, data: text })
        return { state: 'saved', name }
      } catch (e) {
        return { state: (e as { code?: string }).code === 'declined' ? 'declined' : 'failed', name }
      }
    }
    // Inside Claude without it, a link downloads nothing either: not said as saved.
    return { state: 'failed', name: filename }
  }
  try {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([text], { type }))
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    return { state: 'saved', name: filename }
  } catch {
    return { state: 'failed', name: filename }
  }
}
