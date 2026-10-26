import type { Currency } from './types'

export function exponent(currency: Currency): number {
  return currency === 'XOF' ? 0 : 2
}

export function currencyLabel(currency: Currency): string {
  if (currency === 'XOF') return 'F CFA'
  if (currency === 'EUR') return '€'
  return '$US'
}

export function formatNumber(minor: number, currency: Currency): string {
  const digits = exponent(currency)
  const negative = minor < 0
  const [whole, fraction = ''] = (Math.abs(minor) / 10 ** digits).toFixed(digits).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  const body = digits === 0 ? grouped : `${grouped},${fraction}`
  return negative ? `\u2212${body}` : body
}

export function formatMoney(minor: number, currency: Currency): string {
  return `${formatNumber(minor, currency)}\u00a0${currencyLabel(currency)}`
}

/** Montant saisi par une personne. Unité mineure : franc entier, ou centime. */
export function parseAmount(raw: string, currency: Currency): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  const factor = 10 ** exponent(currency)
  const minor = Math.round(value * factor)
  if (minor <= 0 || minor > 1_000_000_000_000) return null
  return minor
}
