import { useEffect, useState, type RefObject } from 'react'
import type { Entry } from './types'

/**
 * Fires once when `ref`'s element scrolls into the viewport. Returns a boolean
 * that flips to true on first intersection and never reverts. Pair with the
 * `.anim-on-view` / `.is-visible` CSS classes for scroll-triggered entrances.
 */
export function useInViewOnce(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, root: null },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return inView
}

export function sortReviewsByDateDesc<T extends { date: string | null }>(reviews: T[]): T[] {
  return [...reviews].map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.date && b.r.date) {
        const diff = new Date(b.r.date).getTime() - new Date(a.r.date).getTime()
        return diff !== 0 ? diff : b.i - a.i
      }
      if (a.r.date) return -1
      if (b.r.date) return 1
      return b.i - a.i
    })
    .map(({ r }) => r)
}

export function latestRating(reviews: Entry['reviews']): number | null {
  return sortReviewsByDateDesc(reviews).find(r => r.overallRating !== null)?.overallRating ?? null
}

export function latestRatedReview(reviews: Entry['reviews']): Entry['reviews'][0] | null {
  return sortReviewsByDateDesc(reviews).find(r => r.overallRating !== null) ?? null
}

export function latestPrice(reviews: Entry['reviews']): number | null {
  return sortReviewsByDateDesc(reviews).find(r => r.price != null)?.price ?? null
}

function scoreHue(v: number): number {
  return 25 + ((v - 3) / 6.5) * 120
}

export function scoreColor(v: number): string {
  return `oklch(0.62 0.16 ${scoreHue(v)})`
}

/** Same hue as scoreColor but with an alpha channel — for subtle score-based glows. */
export function scoreColorAlpha(v: number, alpha: number): string {
  return `oklch(0.62 0.16 ${scoreHue(v)} / ${alpha})`
}

/**
 * Eases a number from 0 up to `target` once `start` flips true. Returns the live
 * value (float) — round at the call site for integer stats. Pair with
 * useInViewOnce to trigger on scroll into view.
 */
export function useCountUp(target: number | null, start: boolean, duration = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start || target === null) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [start, target, duration])
  return value
}

export function getLocalDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

/** Force-restarts the .card-gleam sweep animation on hover-end by toggling the
 *  class off/on with an intervening reflow. Call from onMouseLeave on the host. */
export function restartGleam(el: HTMLElement): void {
  if (!el.classList.contains('card-gleam')) return
  el.classList.remove('card-gleam')
  void el.offsetWidth
  el.classList.add('card-gleam')
}

export function formatReviewDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const local = new Date(d.getTime() + d.getTimezoneOffset() * -60_000)
  return local.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
