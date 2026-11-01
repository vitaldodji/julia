import { useMemo } from 'react'
import { summarize } from '../domain/insights'
import { formatMoney } from '../domain/money'
import { formatDay } from '../domain/period'
import { categoryLabel, expenseWhen } from '../domain/types'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Report() {
  const { session } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const summary = useMemo(() => summarize(space, period, today), [space, period, today])
  const openGoals = summary.goals.filter((item) => !item.reached && !item.goal.paused)
  const doneGoals = summary.goals.filter((item) => item.reached)

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">Bilan · {period.label}</p>
        <h1 className="page-title">Ce mois</h1>
      </header>

      <div className="kpis">
        <article className="kpi"><span>Revenus</span><strong>{formatMoney(summary.income, space.currency)}</strong></article>
        <article className="kpi"><span>Dépenses faites</span><strong>{formatMoney(summary.expenses, space.currency)}</strong></article>
        <article className="kpi"><span>À venir</span><strong>{formatMoney(summary.upcoming, space.currency)}</strong></article>
        <article className="kpi"><span>Mis de côté</span><strong>{formatMoney(summary.contributions, space.currency)}</strong></article>
        <article className="kpi"><span>Il reste</span><strong data-testid="dashboard-leftover">{formatMoney(summary.leftover, space.currency)}</strong></article>
      </div>

      <section>
        <h2 className="section-title">À venir</h2>
        {space.expenses.filter((item) => expenseWhen(item) === 'a_venir' && item.date >= period.start && item.date <= period.end).length === 0 ? (
          <p className="muted">Rien de prévu sur ce mois.</p>
        ) : (
          <ul className="rows">
            {space.expenses
              .filter((item) => expenseWhen(item) === 'a_venir' && item.date >= period.start && item.date <= period.end)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((item) => (
                <li key={item.id} className="row">
                  <div>
                    <strong>{item.title}</strong>
                    <span className="muted">{formatDay(item.date)} · {categoryLabel(item.category)}</span>
                  </div>
                  <span className="row-amt">{formatMoney(item.amount, space.currency)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title">Dépensé dans quoi</h2>
        {summary.byCategory.length === 0 ? <p className="muted">Aucune dépense sur ce mois.</p> : (
          <ul className="rows">
            {summary.byCategory.map((item) => (
              <li key={item.category} className="row">
                <strong>{categoryLabel(item.category)}</strong>
                <span className="row-amt">{formatMoney(item.spent, space.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title">Objectifs pas encore atteints</h2>
        {openGoals.length === 0 ? (
          <p className="muted">{doneGoals.length > 0 ? 'Ceux qui sont ouverts sont atteints.' : 'Aucun objectif en cours.'}</p>
        ) : (
          <ul className="rows">
            {openGoals.map((item) => (
              <li key={item.goal.id} className="row">
                <div>
                  <strong>{item.goal.title}</strong>
                  <span className="muted">
                    {formatMoney(item.saved, space.currency)} sur {formatMoney(item.goal.target, space.currency)}
                    {item.planned && !item.onTrack ? ' · versement du mois pas fait' : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
