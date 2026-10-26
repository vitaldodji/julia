export interface Period {
  key: string
  label: string
  start: string
  end: string
  days: number
}

export function todayISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + delta
  return { y: Math.floor(index / 12), m: (index % 12) + 1 }
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function diffDays(a: string, b: string): number {
  const left = parseISO(a)
  const right = parseISO(b)
  const start = Date.UTC(left.y, left.m - 1, left.d)
  const end = Date.UTC(right.y, right.m - 1, right.d)
  return Math.round((end - start) / 86_400_000)
}

export function clampMonthStart(day: number): number {
  return Math.min(28, Math.max(1, Math.round(day) || 1))
}

function startForMonth(y: number, m: number, monthStartsOn: number): string {
  const day = Math.min(clampMonthStart(monthStartsOn), daysInMonth(y, m))
  return toISO(y, m, day)
}

export function monthLabel(iso: string): string {
  const { y, m, d } = parseISO(iso)
  const label = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDay(iso: string): string {
  const { y, m, d } = parseISO(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function periodContaining(day: string, monthStartsOn: number): Period {
  const { y, m } = parseISO(day)
  let start = startForMonth(y, m, monthStartsOn)
  if (start > day) {
    const prev = addMonths(y, m, -1)
    start = startForMonth(prev.y, prev.m, monthStartsOn)
  }
  const origin = parseISO(start)
  const next = addMonths(origin.y, origin.m, 1)
  const nextStart = startForMonth(next.y, next.m, monthStartsOn)
  const end = addDays(nextStart, -1)
  return {
    key: start,
    label: monthLabel(start),
    start,
    end,
    days: diffDays(start, end) + 1,
  }
}

export function shiftPeriod(period: Period, monthStartsOn: number, delta: number): Period {
  const origin = parseISO(period.start)
  const moved = addMonths(origin.y, origin.m, delta)
  return periodContaining(startForMonth(moved.y, moved.m, monthStartsOn), monthStartsOn)
}

export function inPeriod(date: string, period: Period): boolean {
  return date >= period.start && date <= period.end
}

/** Jour du mois où tombe un prévu, à l'intérieur de la période. */
export function occurrenceDate(period: Period, dayOfMonth: number): string {
  const wanted = Math.min(28, Math.max(1, dayOfMonth))
  let cursor = period.start
  while (cursor <= period.end) {
    if (parseISO(cursor).d === wanted) return cursor
    cursor = addDays(cursor, 1)
  }
  return period.start
}

export function monthsLeft(today: string, deadline: string): number {
  if (deadline < today) return 1
  const from = parseISO(today)
  const to = parseISO(deadline)
  return Math.max(1, (to.y - from.y) * 12 + (to.m - from.m) + 1)
}
