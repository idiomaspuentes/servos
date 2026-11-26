/** What a map in a box needs from the page: the theme changing, and the box's width. */
import { useEffect, useLayoutEffect, useState } from 'react'

/** Counts up when the theme changes (the app's `data-theme`, or the system's scheme): the map is drawn again. */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    const watcher = new MutationObserver(bump)
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener?.('change', bump)
    return () => {
      watcher.disconnect()
      scheme?.removeEventListener?.('change', bump)
    }
  }, [])
  return tick
}

/** The width of a box, kept up to date; 0 until it is measured. */
export function useBoxWidth(box: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!box) return
    const measure = () => setWidth(Math.round(box.clientWidth))
    measure()
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    watcher?.observe(box)
    return () => watcher?.disconnect()
  }, [box])
  return width
}
