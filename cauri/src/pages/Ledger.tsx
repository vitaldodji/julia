import { useMemo, useState, type FormEvent } from 'react'
import {
  addExpense,
  addIncome,
  deleteExpense,
  deleteIncome,
  deleteTemplate,
  updateExpense,
  updateIncome,
} from '../domain/edit'
import { formatDay } from '../domain/period'
import { formatMoney, formatNumber, parseAmount } from '../domain/money'
import { CATEGORIES, INCOME_KINDS, categoryLabel, incomeKindLabel, type CategoryId, type Expense, type Income, type IncomeKind } from '../domain/types'
import { usePeriod } from '../period'
import { useVault } from '../store'
import { personName } from '../ui'

export function Ledger({ mode }: { mode: 'income' | 'expense' }) {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const [editing, setEditing] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [formKey, setFormKey] = useState(0)
  const defaultDate = today >= period.start && today <= period.end ? today : period.start

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (mode === 'income') {
      return space.incomes
        .filter((item) => item.date >= period.start && item.date <= period.end)
        .filter((item) => !needle || item.title.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'fr'))
    }
    return space.expenses
      .filter((item) => item.date >= period.start && item.date <= period.end)
      .filter((item) => !needle || item.title.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'fr'))
  }, [mode, period.end, period.start, query, space.expenses, space.incomes])

  const templates = space.templates.filter((item) => item.active && item.kind === (mode === 'income' ? 'income' : 'expense'))
  const editingIncome = mode === 'income' ? space.incomes.find((item) => item.id === editing) : undefined
  const editingExpense = mode === 'expense' ? space.expenses.find((item) => item.id === editing) : undefined

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">{period.label}</p>
        <h1 className="page-title">{mode === 'income' ? 'Revenus' : 'Dépenses'}</h1>
        <p className="lede">
          {mode === 'income'
            ? 'Tout ce qui entre : salaire, activité, aide. Coche « Tous les mois » pour le retrouver au pointage.'
            : 'Chaque sortie a un titre. Besoin ou envie, pour toi ou pour quelqu’un d’autre.'}
        </p>
      </header>

      {mode === 'income' ? (
        <IncomeForm
          key={editingIncome?.id ?? `new-${formKey}`}
          people={space.people}
          currency={space.currency}
          initial={editingIncome}
          defaultDate={defaultDate}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={(draft, recurring) => {
            commit((current) => editingIncome
              ? updateIncome(current, editingIncome.id, draft)
              : addIncome(current, { ...draft, recurring }))
            setEditing(null)
            setFormKey((value) => value + 1)
          }}
        />
      ) : (
        <ExpenseForm
          key={editingExpense?.id ?? `new-${formKey}`}
          people={space.people}
          currency={space.currency}
          initial={editingExpense}
          defaultDate={defaultDate}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={(draft, recurring) => {
            commit((current) => editingExpense
              ? updateExpense(current, editingExpense.id, draft)
              : addExpense(current, { ...draft, recurring }))
            setEditing(null)
            setFormKey((value) => value + 1)
          }}
        />
      )}

      <div className="list-tools">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === 'income' ? 'Chercher un revenu' : 'Chercher une dépense'}
          aria-label="Recherche"
        />
        <span className="muted">{rows.length} ce mois</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty">{query ? 'Aucun mouvement ne correspond.' : 'Rien sur ce mois pour l’instant.'}</p>
      ) : (
        <ul className="rows">
          {rows.map((row) => (
            <LedgerRow
              key={row.id}
              mode={mode}
              row={row}
              currency={space.currency}
              person={personName(space, row.personId)}
              onEdit={() => setEditing(row.id)}
              onDelete={() => commit((current) => mode === 'income' ? deleteIncome(current, row.id) : deleteExpense(current, row.id))}
            />
          ))}
        </ul>
      )}

      <section className="panel">
        <h2>Prévu chaque mois</h2>
        {templates.length === 0 ? (
          <p className="muted">Les cases « Tous les mois » apparaîtront ici, pour le pointage de fin de mois.</p>
        ) : (
          <ul className="rows">
            {templates.map((item) => (
              <li key={item.id} className="row">
                <div>
                  <strong>{item.title}</strong>
                  <span className="muted">Jour {item.dayOfMonth} · {formatMoney(item.amount, space.currency)} · {personName(space, item.personId)}</span>
                </div>
                <button type="button" className="text-btn" onClick={() => commit((current) => deleteTemplate(current, item.id))}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function LedgerRow({
  mode,
  row,
  currency,
  person,
  onEdit,
  onDelete,
}: {
  mode: 'income' | 'expense'
  row: Income | Expense
  currency: 'XOF' | 'EUR' | 'USD'
  person: string
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const detail = mode === 'income' && 'kind' in row
    ? incomeKindLabel(row.kind)
    : 'category' in row
      ? `${categoryLabel(row.category)} · ${row.nature === 'besoin' ? 'Besoin' : 'Envie'}`
      : ''
  return (
    <li className="row">
      <div>
        <strong>{row.title}</strong>
        <span className="muted">{formatDay(row.date)} · {detail} · {person}{row.note ? ` · ${row.note}` : ''}</span>
      </div>
      <div className="row-actions">
        <span className="row-amt">{formatMoney(row.amount, currency)}</span>
        <button type="button" className="text-btn" onClick={onEdit}>Modifier</button>
        {confirm ? (
          <button type="button" className="text-btn danger" onClick={onDelete}>Confirmer</button>
        ) : (
          <button type="button" className="text-btn" onClick={() => setConfirm(true)}>Supprimer</button>
        )}
      </div>
    </li>
  )
}

function IncomeForm({
  people,
  currency,
  initial,
  defaultDate,
  onSubmit,
  onCancel,
}: {
  people: { id: string; name: string }[]
  currency: 'XOF' | 'EUR' | 'USD'
  initial?: Income
  defaultDate: string
  onSubmit: (draft: Omit<Income, 'id' | 'templateId'>, recurring: boolean) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amount, setAmount] = useState(initial ? formatNumber(initial.amount, currency) : '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [personId, setPersonId] = useState(initial?.personId ?? people[0]?.id ?? '')
  const [kind, setKind] = useState<IncomeKind>(initial?.kind ?? 'salaire')
  const [note, setNote] = useState(initial?.note ?? '')
  const [recurring, setRecurring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount, currency)
    if (!title.trim()) return setError('Donne un titre à ce revenu.')
    if (parsed === null) return setError('Indique un montant supérieur à zéro.')
    if (!personId) return setError('Choisis une personne.')
    setError(null)
    onSubmit({ title, amount: parsed, date, personId, kind, note }, recurring)
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label className="field grow">
        <span>Titre</span>
        <input data-testid="income-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Salaire, coiffure, aide…" />
      </label>
      <label className="field">
        <span>Montant</span>
        <input data-testid="income-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
      </label>
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <label className="field">
        <span>Personne</span>
        <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Nature</span>
        <select value={kind} onChange={(event) => setKind(event.target.value as IncomeKind)}>
          {INCOME_KINDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="field grow">
        <span>Note, facultatif</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {!initial && (
        <label className="check">
          <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />
          <span>Tous les mois, le même jour (au plus tard le 28)</span>
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="composer-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className="btn btn-primary" data-testid="income-submit">{initial ? 'Enregistrer' : 'Ajouter le revenu'}</button>
      </div>
    </form>
  )
}

function ExpenseForm({
  people,
  currency,
  initial,
  defaultDate,
  onSubmit,
  onCancel,
}: {
  people: { id: string; name: string }[]
  currency: 'XOF' | 'EUR' | 'USD'
  initial?: Expense
  defaultDate: string
  onSubmit: (draft: Omit<Expense, 'id' | 'templateId'>, recurring: boolean) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amount, setAmount] = useState(initial ? formatNumber(initial.amount, currency) : '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [personId, setPersonId] = useState(initial?.personId ?? people[0]?.id ?? '')
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'nourriture')
  const [nature, setNature] = useState<'besoin' | 'envie'>(initial?.nature ?? 'besoin')
  const [note, setNote] = useState(initial?.note ?? '')
  const [recurring, setRecurring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount, currency)
    if (!title.trim()) return setError('Donne un titre à cette dépense.')
    if (parsed === null) return setError('Indique un montant supérieur à zéro.')
    if (!personId) return setError('Choisis une personne.')
    setError(null)
    onSubmit({ title, amount: parsed, date, personId, category, nature, note }, recurring)
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label className="field grow">
        <span>Titre</span>
        <input data-testid="expense-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Loyer, marché, transport…" />
      </label>
      <label className="field">
        <span>Montant</span>
        <input data-testid="expense-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
      </label>
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <label className="field">
        <span>Personne</span>
        <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Catégorie</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as CategoryId)}>
          {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="field">
        <span>Type</span>
        <div className="seg">
          <button type="button" className={nature === 'besoin' ? 'on' : ''} onClick={() => setNature('besoin')}>Besoin</button>
          <button type="button" className={nature === 'envie' ? 'on' : ''} onClick={() => setNature('envie')}>Envie</button>
        </div>
      </div>
      <label className="field grow">
        <span>Note, facultatif</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {!initial && (
        <label className="check">
          <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />
          <span>Tous les mois, le même jour (au plus tard le 28)</span>
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="composer-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className="btn btn-primary" data-testid="expense-submit">{initial ? 'Enregistrer' : 'Ajouter la dépense'}</button>
      </div>
    </form>
  )
}
