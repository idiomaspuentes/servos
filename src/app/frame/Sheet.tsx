/** A sheet that comes up from the bottom (philosophy, layer «hoja que sube»): a list, an article, a menu. */

import { useEffect, useRef, type ReactNode } from 'react'
import { useT } from '../i18n/i18n'

export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const t = useT()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="button-quiet" onClick={onClose}>
            {t('marco.cerrar')}
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/** A menu row: the action, and under it what it does (philosophy, principle 3). */
export function MenuRow({ label, description, onClick, disabled }: { label: string; description?: string; onClick(): void; disabled?: boolean }) {
  return (
    <button type="button" className="menu-row" onClick={onClick} disabled={disabled}>
      <span className="menu-row-label">{label}</span>
      {description && <span className="menu-row-description">{description}</span>}
    </button>
  )
}
