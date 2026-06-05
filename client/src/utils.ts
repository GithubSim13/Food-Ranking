import type { Entry } from './types'

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

export function scoreColor(v: number): string {
  return `oklch(0.62 0.16 ${25 + ((v - 3) / 6.5) * 120})`
}

export function formatReviewDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const local = new Date(d.getTime() + d.getTimezoneOffset() * -60_000)
  return local.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
