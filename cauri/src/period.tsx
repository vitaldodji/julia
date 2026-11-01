import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { periodContaining, shiftPeriod, todayISO, type Period } from './domain/period'
import { useVault } from './store'

interface PeriodApi {
  period: Period
  today: string
  shift: (delta: number) => void
  jump: (day: string) => void
}

const PeriodContext = createContext<PeriodApi | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const { session } = useVault()
  const [today] = useState(todayISO)
  const [anchor, setAnchor] = useState(today)
  const monthStartsOn = session?.space.monthStartsOn ?? 1
  const period = useMemo(() => periodContaining(anchor, monthStartsOn), [anchor, monthStartsOn])
  const api = useMemo<PeriodApi>(() => ({
    period,
    today,
    shift: (delta) => setAnchor(shiftPeriod(periodContaining(anchor, monthStartsOn), monthStartsOn, delta).start),
    jump: setAnchor,
  }), [period, today, anchor, monthStartsOn])
  return <PeriodContext.Provider value={api}>{children}</PeriodContext.Provider>
}

export function usePeriod(): PeriodApi {
  const value = useContext(PeriodContext)
  if (!value) throw new Error('Période absente')
  return value
}
