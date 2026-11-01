import { describe, expect, it } from 'vitest'
import { formatMoney, parseAmount } from './money'

describe('montants', () => {
  it('lit un montant en francs, espaces compris', () => {
    expect(parseAmount('15 000', 'XOF')).toBe(15_000)
    expect(parseAmount('0', 'XOF')).toBeNull()
    expect(parseAmount('12,5', 'XOF')).toBe(13)
  })

  it('lit les euros en centimes', () => {
    expect(parseAmount('10,50', 'EUR')).toBe(1050)
    expect(parseAmount('10.5', 'EUR')).toBe(1050)
  })

  it('affiche les francs CFA', () => {
    expect(formatMoney(225_000, 'XOF')).toContain('225\u00a0000')
    expect(formatMoney(225_000, 'XOF')).toContain('F CFA')
    expect(formatMoney(-1_500, 'XOF')).toContain('\u22121\u00a0500')
  })
})
