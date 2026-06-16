import { describe, expect, it } from 'vitest'
import { compactNumber, formatDate, relativeTime } from './format'

describe('compactNumber', () => {
  it('formats large numbers compactly', () => {
    expect(compactNumber(999)).toBe('999')
    expect(compactNumber(1000)).toBe('1K')
    expect(compactNumber(12300)).toBe('12.3K')
    expect(compactNumber(1_500_000)).toBe('1.5M')
  })

  it('handles zero and negatives', () => {
    expect(compactNumber(0)).toBe('0')
    expect(compactNumber(-1_500_000)).toBe('-1.5M')
  })

  it('returns an empty string for non-finite input', () => {
    expect(compactNumber(Number.NaN)).toBe('')
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('relativeTime', () => {
  const now = new Date('2024-01-10T12:00:00Z')

  it('formats past times', () => {
    expect(relativeTime('2024-01-07T12:00:00Z', now)).toBe('3 days ago')
    expect(relativeTime('2024-01-10T11:59:30Z', now)).toBe('30 seconds ago')
  })

  it('rolls up to the larger unit at boundaries', () => {
    expect(relativeTime('2024-01-10T11:59:01Z', now)).toBe('59 seconds ago')
    expect(relativeTime('2024-01-10T11:59:00Z', now)).toBe('1 minute ago')
  })

  it('formats future times', () => {
    expect(relativeTime('2024-01-10T12:00:30Z', now)).toBe('in 30 seconds')
  })

  it('returns "now" for the present moment', () => {
    expect(relativeTime('2024-01-10T12:00:00Z', now)).toBe('now')
  })

  it('returns an empty string for an invalid date', () => {
    expect(relativeTime('not-a-date', now)).toBe('')
  })
})

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2024-06-01T00:00:00Z')).toBe('Jun 1, 2024')
  })

  it('renders the UTC calendar date regardless of input offset', () => {
    expect(formatDate('2024-06-01T01:00:00+05:00')).toBe('May 31, 2024')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('nope')).toBe('')
  })
})
