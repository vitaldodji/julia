import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { addExpense, deleteExpense } from '../domain/edit'
import { summarize } from '../domain/insights'
import { formatMoney, parseAmount } from '../domain/money'
import { formatDay } from '../domain/period'
import { QUICK_CATEGORIES, categoryLabel, type CategoryId } from '../domain/types'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Dashboard() {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const summary = useMemo(() => summarize(space, period, today), [space, period, today])
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CategoryId>('transport')
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const defaultDate = today >= period.start && today <= period.end ? today : period.start
  const rows = space.expenses
    .filter((item) => item.date >= period.start && item.date <= period.end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const openGoals = summary.goals.filter((item) => !item.reached && !item.goal.paused)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount, space.currency)
    if (parsed === null) {
      setError('Indique le montant, par exemple 100 ou 1500.')
      amountRef.current?.focus()
      return
    }
    const personId = space.people[0]?.id
    if (!personId) return
    const label = title.trim() || categoryLabel(category)
    commit((book) => addExpense(book, {
      title: label,
      amount: parsed,
      date: defaultDate,
      personId,
      category,
      nature: category === 'plaisirs' || category === 'loisirs' ? 'envie' : 'besoin',
      recurring: false,
    }))
    setAmount('')
    setTitle('')
    setError(null)
    amountRef.current?.focus()
  }

  return (
    <div className="page">
      <section className="pair">
        <div>
          <p className="kicker">Dépensé</p>
          <p className="quiet-figure" data-testid="spent-total">{formatMoney(summary.expenses, space.currency)}</p>
        </div>
        <div>
          <p className="kicker">Il reste</p>
          <p className={summary.leftover < 0 ? 'quiet-figure bad' : 'quiet-figure'} data-testid="dashboard-leftover">
            {formatMoney(summary.leftover, space.currency)}
          </p>
        </div>
      </section>

      <form className="quick" onSubmit={submit}>
        <label className="field">
          <span>Montant</span>
          <input
            ref={amountRef}
            className="amount-input"
            data-testid="expense-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
        </label>
        <label className="field">
          <span>Quoi</span>
          <input
            data-testid="expense-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Biscuit, essence, zem…"
          />
        </label>
        <div className="chips" role="group" aria-label="Dans quoi">
          {QUICK_CATEGORIES.map((id) => (
            <button
              key={id}
              type="button"
              className={category === id ? 'on' : ''}
              onClick={() => setCategory(id)}
            >
              {categoryLabel(id)}
            </button>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" data-testid="expense-submit">Noter</button>
      </form>

      <section>
        <h2 className="section-title">Ce mois</h2>
        {rows.length === 0 ? (
          <p className="empty">Rien pour l’instant. 100 F se note ici, tout de suite.</p>
        ) : (
          <ul className="rows">
            {rows.map((row) => (
              <li key={row.id} className="row">
                <div>
                  <strong>{row.title}</strong>
                  <span className="muted">{formatDay(row.date)} · {categoryLabel(row.category)}</span>
                </div>
                <div className="row-actions">
                  <span className="row-amt">{formatMoney(row.amount, space.currency)}</span>
                  <button type="button" className="text-btn" onClick={() => commit((book) => deleteExpense(book, row.id))}>
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.byCategory.length > 0 && (
        <section>
          <h2 className="section-title">Dans quoi</h2>
          <ul className="rows">
            {summary.byCategory.map((item) => (
              <li key={item.category} className="row">
                <strong>{categoryLabel(item.category)}</strong>
                <span className="row-amt">{formatMoney(item.spent, space.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="panel-head">
          <h2 className="section-title">Objectifs pas encore atteints</h2>
          <a href="#/objectifs">Mettre de côté</a>
        </div>
        {openGoals.length === 0 ? (
          <p className="muted">Aucun objectif en cours. <a href="#/objectifs">En ouvrir un</a>.</p>
        ) : (
          <ul className="rows">
            {openGoals.map((item) => (
              <li key={item.goal.id} className="row">
                <div>
                  <strong>{item.goal.title}</strong>
                  <span className="muted">
                    {item.planned && !item.onTrack
                      ? `Pas encore le versement du mois · ${formatMoney(item.contributed, space.currency)} sur ${formatMoney(item.suggested, space.currency)}`
                      : `Il manque ${formatMoney(item.remaining, space.currency)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">Un cours reçu se note dans <a href="#/revenus">Revenus</a>.</p>
      </section>
    </div>
  )
}
