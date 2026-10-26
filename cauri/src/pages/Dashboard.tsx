import { useMemo } from 'react'
import { GoalMeter, Pointage } from '../bits'
import { currencyLabel, formatMoney, formatNumber } from '../domain/money'
import { summarize, type Summary } from '../domain/insights'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Dashboard() {
  const { session } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const summary = useMemo(() => summarize(space, period, today), [space, period, today])
  const steps = [
    { href: '#/revenus', label: 'Revenus', done: space.incomes.length > 0 },
    { href: '#/depenses', label: 'Dépenses', done: space.expenses.length > 0 },
    { href: '#/objectifs', label: 'Un objectif', done: space.goals.length > 0 },
  ]
  const hour = new Date().getHours()

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">Tableau</p>
        <h1 className="page-title">{hour < 18 ? 'Bonjour' : 'Bonsoir'}, {space.displayName}</h1>
      </header>

      {steps.some((step) => !step.done) && (
        <ol className="steps-inline">
          {steps.map((step, index) => (
            <li key={step.href} className={step.done ? 'done' : undefined}>
              <a href={step.href}><span>{index + 1}</span>{step.label}</a>
            </li>
          ))}
        </ol>
      )}

      <section className="hero-number">
        <p className="kicker">Reste à vivre · {period.label}</p>
        <p className={summary.leftover < 0 ? 'figure bad' : 'figure'} data-testid="dashboard-leftover">
          {formatNumber(summary.leftover, space.currency)}
          <span>{currencyLabel(space.currency)}</span>
        </p>
        <p className="lede">{headline(summary)}</p>
        {summary.dailyAllowance !== null && (
          <p className="daily">
            Aujourd’hui, {formatMoney(summary.dailyAllowance, space.currency)} sans casser le mois.
            Il reste {summary.daysLeft} jour{summary.daysLeft > 1 ? 's' : ''}.
          </p>
        )}
        {summary.viewing === 'current' && summary.projection !== null && (
          <p className="daily">Si le rythme continue, le mois finit autour de {formatMoney(summary.projection, space.currency)}.</p>
        )}
      </section>

      <div className="kpis">
        <Kpi label="Gagné" value={formatMoney(summary.income, space.currency)} />
        <Kpi label="Dépensé" value={formatMoney(summary.expenses, space.currency)} />
        <Kpi label="Mis de côté" value={formatMoney(summary.contributions, space.currency)} />
      </div>

      <div className="split">
        <section className="panel">
          <h2>Pointage du mois</h2>
          <Pointage items={summary.missing} hasTemplates={space.templates.some((item) => item.active)} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Objectifs</h2>
            <a href="#/objectifs">Voir</a>
          </div>
          {summary.goals.length === 0 ? (
            <p className="muted">Aucun objectif. <a href="#/objectifs">En ouvrir un</a> pour une chose à payer.</p>
          ) : (
            summary.goals.slice(0, 3).map((item) => <GoalMeter key={item.goal.id} item={item} currency={space.currency} />)
          )}
        </section>
      </div>

      {space.people.length > 1 && (
        <section className="panel">
          <h2>Par personne</h2>
          <ul className="people-flow">
            {summary.byPerson.map((person) => (
              <li key={person.id}>
                <strong>{person.name}</strong>
                <span>Revenus {formatMoney(person.income, space.currency)}</span>
                <span>Dépenses {formatMoney(person.expenses, space.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function headline(summary: Summary): string {
  if (summary.income === 0 && summary.expenses === 0 && summary.contributions === 0) {
    return 'Note ce qui entre, puis ce qui sort. Le reste se calcule.'
  }
  if (summary.leftover < 0) return 'Les dépenses et les versements dépassent les revenus notés ce mois-ci.'
  return 'C’est ce qui reste une fois les dépenses et les versements notés.'
}
