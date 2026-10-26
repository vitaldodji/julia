import type { ReactNode } from 'react'
import { Brand } from '../ui'
import { usePeriod } from '../period'
import { useVault } from '../store'
import { Dashboard } from './Dashboard'
import { Goals } from './Goals'
import { Ledger } from './Ledger'
import { Report } from './Report'
import { Review } from './Review'
import { Settings } from './Settings'

const LINKS = [
  ['#/tableau', 'Tableau'],
  ['#/revenus', 'Revenus'],
  ['#/depenses', 'Dépenses'],
  ['#/objectifs', 'Objectifs'],
  ['#/bilan', 'Bilan'],
  ['#/revue', 'Revue'],
  ['#/reglages', 'Réglages'],
] as const

export function Shell({ hash }: { hash: string }) {
  const { session, lock, persistError } = useVault()
  const { period, shift } = usePeriod()
  const space = session?.space
  if (!space) return null
  return (
    <div className="app">
      <aside className="sidebar">
        <Brand href="#/tableau" />
        <nav className="side-nav" aria-label="Sections">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className={hash === href ? 'active' : ''} data-testid={`nav-${href.slice(2)}`}>
              {label}
            </a>
          ))}
        </nav>
        <button type="button" className="text-btn light" onClick={lock}>Fermer le coffre</button>
      </aside>
      <div className="main">
        <header className="main-top">
          <p className="space-name">{space.displayName}</p>
          <div className="month-switch">
            <button type="button" aria-label="Mois précédent" onClick={() => shift(-1)}><Chevron direction="left" /></button>
            <strong>{period.label}</strong>
            <button type="button" aria-label="Mois suivant" onClick={() => shift(1)}><Chevron direction="right" /></button>
            <button type="button" className="text-btn lock-top" onClick={lock}>Fermer</button>
          </div>
        </header>
        {persistError && <p className="form-error banner-error" role="alert">{persistError}</p>}
        <Page hash={hash} />
      </div>
    </div>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d={direction === 'left' ? 'M11 4 L6 9 L11 14' : 'M7 4 L12 9 L7 14'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Page({ hash }: { hash: string }) {
  const pages: Record<string, ReactNode> = {
    '#/tableau': <Dashboard />,
    '#/revenus': <Ledger mode="income" />,
    '#/depenses': <Ledger mode="expense" />,
    '#/objectifs': <Goals />,
    '#/bilan': <Report />,
    '#/revue': <Review />,
    '#/reglages': <Settings />,
  }
  return pages[hash] ?? <Dashboard />
}
