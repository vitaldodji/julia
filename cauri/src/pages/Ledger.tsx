import { useMemo, useState, type FormEvent } from 'react'
import { addIncome, deleteIncome, updateIncome } from '../domain/edit'
import { formatMoney, formatNumber, parseAmount } from '../domain/money'
import { formatDay } from '../domain/period'
import { QUICK_INCOMES, incomeKindLabel, type Income, type IncomeKind } from '../domain/types'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Ledger() {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const [editing, setEditing] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const defaultDate = today >= period.start && today <= period.end ? today : period.start
  const editingIncome = space.incomes.find((item) => item.id === editing)
  const rows = useMemo(() => space.incomes
    .filter((item) => item.date >= period.start && item.date <= period.end)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'fr')), [period.end, period.start, space.incomes])

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">{period.label}</p>
        <h1 className="page-title">Revenus</h1>
        <p className="lede">Cours à domicile, cours au collège, ou autre chose reçue.</p>
      </header>

      <IncomeForm
        key={editingIncome?.id ?? `new-${formKey}`}
        currency={space.currency}
        initial={editingIncome}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSubmit={(draft) => {
          const personId = draft.personId || space.people[0]?.id
          if (!personId) return
          const next = { ...draft, personId, date: editingIncome?.date ?? defaultDate }
          commit((current) => editingIncome
            ? updateIncome(current, editingIncome.id, next)
            : addIncome(current, { ...next, recurring: false }))
          setEditing(null)
          setFormKey((value) => value + 1)
        }}
      />

      {rows.length === 0 ? (
        <p className="empty">Aucun revenu sur ce mois.</p>
      ) : (
        <ul className="rows">
          {rows.map((row) => (
            <IncomeRow
              key={row.id}
              row={row}
              currency={space.currency}
              onEdit={() => setEditing(row.id)}
              onDelete={() => commit((current) => deleteIncome(current, row.id))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function IncomeRow({
  row,
  currency,
  onEdit,
  onDelete,
}: {
  row: Income
  currency: 'XOF' | 'EUR' | 'USD'
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <li className="row">
      <div>
        <strong>{row.title}</strong>
        <span className="muted">{formatDay(row.date)} · {incomeKindLabel(row.kind)}</span>
      </div>
      <div className="row-actions">
        <span className="row-amt">{formatMoney(row.amount, currency)}</span>
        <button type="button" className="text-btn" onClick={onEdit}>Modifier</button>
        <button type="button" className="text-btn" onClick={onDelete}>Retirer</button>
      </div>
    </li>
  )
}

function IncomeForm({
  currency,
  initial,
  onSubmit,
  onCancel,
}: {
  currency: 'XOF' | 'EUR' | 'USD'
  initial?: Income
  onSubmit: (draft: Omit<Income, 'id' | 'templateId' | 'date'> & { date?: string }) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amount, setAmount] = useState(initial ? formatNumber(initial.amount, currency) : '')
  const [kind, setKind] = useState<IncomeKind>(initial?.kind ?? 'cours_maison')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount, currency)
    if (parsed === null) return setError('Indique le montant reçu.')
    const label = title.trim() || incomeKindLabel(kind)
    setError(null)
    onSubmit({ title: label, amount: parsed, personId: initial?.personId ?? '', kind, note: initial?.note })
  }

  return (
    <form className="quick" onSubmit={submit}>
      <label className="field">
        <span>Montant</span>
        <input className="amount-input" data-testid="income-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
      </label>
      <label className="field">
        <span>Quoi</span>
        <input data-testid="income-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Maison, collège…" />
      </label>
      <div className="chips" role="group" aria-label="Source">
        {QUICK_INCOMES.map((id) => (
          <button key={id} type="button" className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>
            {incomeKindLabel(id)}
          </button>
        ))}
      </div>
      {initial && !QUICK_INCOMES.includes(initial.kind as typeof QUICK_INCOMES[number]) && (
        <p className="muted">Source actuelle : {incomeKindLabel(initial.kind)}</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="hero-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className="btn btn-primary" data-testid="income-submit">{initial ? 'Enregistrer' : 'Noter le revenu'}</button>
      </div>
    </form>
  )
}
