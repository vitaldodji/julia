import { useMemo, useState } from 'react'
import { setBudget } from '../domain/edit'
import { percent, summarize } from '../domain/insights'
import { currencyLabel, formatMoney, formatNumber, parseAmount } from '../domain/money'
import { shiftPeriod } from '../domain/period'
import { CATEGORIES, categoryLabel, type CategoryId } from '../domain/types'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Report() {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const summary = useMemo(() => summarize(space, period, today), [space, period, today])
  const previousPeriod = shiftPeriod(period, space.monthStartsOn, -1)
  const previous = useMemo(() => summarize(space, previousPeriod, today), [previousPeriod, space, today])
  const previousHasNumbers = previous.income > 0 || previous.expenses > 0 || previous.contributions > 0
  const maxCategory = Math.max(1, ...summary.byCategory.map((item) => item.spent))

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">Bilan · {period.label}</p>
        <h1 className="page-title">
          {formatNumber(summary.leftover, space.currency)}
          <span className="figure-unit">{currencyLabel(space.currency)}</span>
        </h1>
        <p className="lede">Revenus moins dépenses moins versements vers les objectifs.</p>
      </header>

      <div className="kpis">
        <article className="kpi"><span>Gagné</span><strong>{formatMoney(summary.income, space.currency)}</strong></article>
        <article className="kpi"><span>Dépensé</span><strong>{formatMoney(summary.expenses, space.currency)}</strong></article>
        <article className="kpi"><span>Mis de côté</span><strong>{formatMoney(summary.contributions, space.currency)}</strong></article>
      </div>

      {previousHasNumbers && (
        <p className="daily">
          Mois précédent : reste {formatMoney(previous.leftover, space.currency)}.
          {' '}Écart {formatMoney(summary.leftover - previous.leftover, space.currency)}.
        </p>
      )}

      <section className="panel">
        <h2>Besoins, envies, épargne</h2>
        <RuleRow label="Besoins" actual={summary.needsShare} target={space.rule.needs} amount={summary.needs} currency={space.currency} />
        <RuleRow label="Envies" actual={summary.wantsShare} target={space.rule.wants} amount={summary.wants} currency={space.currency} />
        <RuleRow label="Épargne" actual={summary.savingsShare} target={space.rule.savings} amount={summary.contributions} currency={space.currency} />
        <p className="muted">La règle visée se règle dans Réglages. Ici, c’est la part réelle de ce mois.</p>
      </section>

      <div className="split">
        <section className="panel">
          <h2>Par catégorie</h2>
          {summary.byCategory.length === 0 ? <p className="muted">Aucune dépense sur ce mois.</p> : (
            <ul className="meter-list">
              {summary.byCategory.map((item) => (
                <li key={item.category}>
                  <div className="goal-line-top">
                    <strong>{categoryLabel(item.category)}</strong>
                    <span>{formatMoney(item.spent, space.currency)}{item.limit ? ` / ${formatMoney(item.limit, space.currency)}` : ''}</span>
                  </div>
                  <div className={item.over ? 'bar over' : 'bar'}><span style={{ width: `${Math.min(100, (item.spent / maxCategory) * 100)}%` }} /></div>
                  {item.over && <p className="form-error">Plafond dépassé.</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
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
      </div>

      <section className="panel">
        <h2>Plafonds du mois</h2>
        <p className="muted">Un plafond vide ne surveille pas la catégorie. Il s’applique à chaque mois.</p>
        <div className="budget-grid">
          {CATEGORIES.map((item) => (
            <BudgetField
              key={item.id}
              category={item.id}
              label={item.label}
              limit={space.budgets.find((budget) => budget.category === item.id)?.limit ?? 0}
              currency={space.currency}
              onCommit={(limit) => commit((book) => setBudget(book, item.id, limit))}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function RuleRow({
  label,
  actual,
  target,
  amount,
  currency,
}: {
  label: string
  actual: number | null
  target: number
  amount: number
  currency: 'XOF' | 'EUR' | 'USD'
}) {
  return (
    <div className="rule-row">
      <div className="goal-line-top">
        <strong>{label}</strong>
        <span>{percent(actual)} · visé {target}&nbsp;% · {formatMoney(amount, currency)}</span>
      </div>
      <div className="bar"><span style={{ width: `${Math.min(100, (actual ?? 0) * 100)}%` }} /></div>
    </div>
  )
}

function BudgetField({
  category,
  label,
  limit,
  currency,
  onCommit,
}: {
  category: CategoryId
  label: string
  limit: number
  currency: 'XOF' | 'EUR' | 'USD'
  onCommit: (limit: number) => void
}) {
  const [raw, setRaw] = useState(limit > 0 ? formatNumber(limit, currency) : '')
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        placeholder="Sans plafond"
        aria-label={`Plafond ${label}`}
        value={raw}
        data-category={category}
        onChange={(event) => setRaw(event.target.value)}
        onBlur={() => {
          if (!raw.trim()) {
            onCommit(0)
            return
          }
          const amount = parseAmount(raw, currency)
          if (amount === null) {
            setRaw(limit > 0 ? formatNumber(limit, currency) : '')
            return
          }
          onCommit(amount)
          setRaw(formatNumber(amount, currency))
        }}
      />
    </label>
  )
}
