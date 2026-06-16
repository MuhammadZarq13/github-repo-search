const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  return compactFormatter.format(value)
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  let duration = (then - now.getTime()) / 1000
  for (const division of divisions) {
    const rounded = Math.round(duration)
    if (Math.abs(rounded) < division.amount) {
      return relativeFormatter.format(rounded, division.unit)
    }
    duration /= division.amount
  }
  return ''
}

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date)
}
