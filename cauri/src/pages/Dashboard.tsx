import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { addExpense, deleteExpense, updateExpense } from '../domain/edit'
import { summarize } from '../domain/insights'
import { formatMoney, formatNumber, parseAmount } from '../domain/money'
import { formatDay } from '../domain/period'
import { QUICK_CATEGORIES, categoryLabel, expenseWhen, type CategoryId, type Expense, type ExpenseWhen } from '../domain/types'
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
  const [when, setWhen] = useState<ExpenseWhen>('faite')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const defaultDate = today >= period.start && today <= period.end ? today : period.start
  const [date, setDate] = useState(defaultDate)
  const rows = space.expenses
    .filter((item) => item.date >= period.start && item.date <= period.end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'))
  const upcoming = rows.filter((item) => expenseWhen(item) === 'a_venir')
  const done = rows.filter((item) => expenseWhen(item) === 'faite').reverse()
  const openGoals = summary.goals.filter((item) => !item.reached && !item.goal.paused)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!editing) setDate(defaultDate)
  }, [defaultDate, editing])

  function beginEdit(row: Expense) {
    setEditing(row.id)
    setTitle(row.title)
    setAmount(formatNumber(row.amount, space.currency))
    setCategory(row.category)
    setWhen(expenseWhen(row))
    setDate(row.date)
    setError(null)
    amountRef.current?.focus()
  }

  function clearForm() {
    setEditing(null)
    setAmount('')
    setTitle('')
    setWhen('faite')
    setDate(defaultDate)
    setError(null)
    amountRef.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount, space.currency)
    if (parsed === null) {
      setError('Indique le montant, par exemple 100 ou 1500.')
      amountRef.current?.focus()
      return
    }
    if (!date) {
      setError('Indique la date.')
      return
    }
    const personId = space.people[0]?.id
    if (!personId) return
    const label = title.trim() || categoryLabel(category)
    const draft = {
      title: label,
      amount: parsed,
      date,
      personId,
      category,
      nature: category === 'plaisirs' || category === 'loisirs' ? 'envie' as const : 'besoin' as const,
      when,
      recurring: false,
    }
    commit((book) => editing ? updateExpense(book, editing, draft) : addExpense(book, draft))
    clearForm()
  }

  return (
    <div className="page">
      <section className="pair">
        <div>
          <p className="kicker">Dépensé</p>
          <p className="quiet-figure" data-testid="spent-total">{formatMoney(summary.expenses, space.currency)}</p>
        </div>
        <div>
          <p className="kicker">À venir</p>
          <p className="quiet-figure" data-testid="upcoming-total">{formatMoney(summary.upcoming, space.currency)}</p>
        </div>
        <div>
          <p className="kicker">Il reste</p>
          <p className={summary.leftover < 0 ? 'quiet-figure bad' : 'quiet-figure'} data-testid="dashboard-leftover">
            {formatMoney(summary.leftover, space.currency)}
          </p>
        </div>
      </section>

      <form className="quick" onSubmit={submit}>
        <div className="chips" role="group" aria-label="Déjà faite ou à venir">
          <button type="button" className={when === 'faite' ? 'on' : ''} onClick={() => setWhen('faite')}>Faite</button>
          <button type="button" className={when === 'a_venir' ? 'on' : ''} onClick={() => setWhen('a_venir')}>À venir</button>
        </div>
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
        <label className="field">
          <span>Date</span>
          <input data-testid="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
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
        <div className="hero-actions">
          {editing && <button type="button" className="btn btn-ghost" onClick={clearForm}>Annuler</button>}
          <button className="btn btn-primary" data-testid="expense-submit">{editing ? 'Enregistrer' : 'Noter'}</button>
        </div>
      </form>

      <section>
        <h2 className="section-title">À venir</h2>
        {upcoming.length === 0 ? (
          <p className="empty">Rien de prévu. Choisis « À venir » et la date.</p>
        ) : (
          <ul className="rows">
            {upcoming.map((row) => (
              <ExpenseRow
                key={row.id}
                row={row}
                currency={space.currency}
                onEdit={() => beginEdit(row)}
                onDone={() => commit((book) => updateExpense(book, row.id, {
                  title: row.title,
                  amount: row.amount,
                  date: row.date,
                  personId: row.personId,
                  category: row.category,
                  nature: row.nature,
                  when: 'faite',
                  note: row.note,
                }))}
                onDelete={() => commit((book) => deleteExpense(book, row.id))}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title">Faites</h2>
        {done.length === 0 ? (
          <p className="empty">Rien de payé sur ce mois.</p>
        ) : (
          <ul className="rows">
            {done.map((row) => (
              <ExpenseRow
                key={row.id}
                row={row}
                currency={space.currency}
                onEdit={() => beginEdit(row)}
                onDelete={() => commit((book) => deleteExpense(book, row.id))}
              />
            ))}
          </ul>
        )}
      </section>

      {summary.byCategory.length > 0 && (
        <section>
          <h2 className="section-title">Dans quoi, déjà payé</h2>
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

function ExpenseRow({
  row,
  currency,
  onEdit,
  onDone,
  onDelete,
}: {
  row: Expense
  currency: 'XOF' | 'EUR' | 'USD'
  onEdit: () => void
  onDone?: () => void
  onDelete: () => void
}) {
  return (
    <li className="row">
      <div>
        <strong>{row.title}</strong>
        <span className="muted">{formatDay(row.date)} · {categoryLabel(row.category)}</span>
      </div>
      <div className="row-actions">
        <span className="row-amt">{formatMoney(row.amount, currency)}</span>
        {onDone && <button type="button" className="text-btn" onClick={onDone}>C’est fait</button>}
        <button type="button" className="text-btn" onClick={onEdit}>Modifier</button>
        <button type="button" className="text-btn" onClick={onDelete}>Retirer</button>
      </div>
    </li>
  )
}
