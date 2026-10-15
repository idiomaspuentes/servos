/**
 * A verse with the words of the help being read marked in it. An aligned quote can have gaps («de … que es …»): each
 * piece is marked where it next appears, in order.
 */

export function markPieces(text: string, marked: string | null): Array<{ text: string; marked: boolean }> {
  if (!marked) return [{ text, marked: false }]
  const pieces = marked.split(/\s*…\s*/).map((p) => p.trim()).filter(Boolean)
  const out: Array<{ text: string; marked: boolean }> = []
  let from = 0
  for (const piece of pieces) {
    const at = text.toLocaleLowerCase().indexOf(piece.toLocaleLowerCase(), from)
    if (at < 0) continue
    if (at > from) out.push({ text: text.slice(from, at), marked: false })
    out.push({ text: text.slice(at, at + piece.length), marked: true })
    from = at + piece.length
  }
  if (from < text.length) out.push({ text: text.slice(from), marked: false })
  return out
}

export function VerseText({ verse, text, marked, size = 'large' }: { verse: number; text: string; marked: string | null; size?: 'large' | 'small' }) {
  return (
    <p className={`verse verse-${size}`}>
      <span className="verse-number">{verse}</span>{' '}
      {markPieces(text, marked).map((p, i) => (p.marked ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </p>
  )
}
