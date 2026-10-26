import { describe, expect, it } from 'vitest'
import { diffDays, occurrenceDate, periodContaining, shiftPeriod } from './period'

describe('périodes', () => {
  it('découpe un mois civil', () => {
    const period = periodContaining('2026-10-15', 1)
    expect(period.start).toBe('2026-10-01')
    expect(period.end).toBe('2026-10-31')
    expect(period.days).toBe(31)
    expect(period.label).toBe('Octobre 2026')
  })

  it('accepte un mois qui commence le 25', () => {
    expect(periodContaining('2026-10-15', 25)).toMatchObject({
      start: '2026-09-25',
      end: '2026-10-24',
    })
    expect(periodContaining('2026-10-25', 25)).toMatchObject({
      start: '2026-10-25',
      end: '2026-11-24',
    })
  })

  it('avance et recule d’un mois', () => {
    const october = periodContaining('2026-10-08', 1)
    expect(shiftPeriod(october, 1, 1).start).toBe('2026-11-01')
    expect(shiftPeriod(october, 1, -1).start).toBe('2026-09-01')
  })

  it('compte février 2026 sur 28 jours', () => {
    const period = periodContaining('2026-02-10', 1)
    expect(period.days).toBe(28)
    expect(diffDays(period.start, period.end)).toBe(27)
  })

  it('place le jour prévu dans la période', () => {
    const period = periodContaining('2026-10-15', 25)
    expect(occurrenceDate(period, 28)).toBe('2026-09-28')
    expect(occurrenceDate(period, 5)).toBe('2026-10-05')
  })
})
