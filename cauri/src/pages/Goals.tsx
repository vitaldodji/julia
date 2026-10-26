import { useMemo, useState, type FormEvent } from 'react'
import { GoalMeter } from '../bits'
import {
  addContribution,
  addGoal,
  deleteContribution,
  deleteGoal,
  featureGoal,
  setGoalPaused,
  updateGoal,
  type GoalDraft,
} from '../domain/edit'
import { goalProgress } from '../domain/insights'
import { formatMoney, formatNumber, parseAmount } from '../domain/money'
import { formatDay } from '../domain/period'
import { usePeriod } from '../period'
import { useVault } from '../store'
import { personName } from '../ui'

export function Goals() {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const current = space.goals.find((item) => item.id === editing)
  const progress = useMemo(
    () => space.goals.map((goal) => goalProgress(space, goal, period, today)),
    [period, space, today],
  )

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">À payer</p>
        <h1 className="page-title">Objectifs</h1>
        <p className="lede">
          Plusieurs choses en même temps. Un versement n’est pas une dépense : c’est de l’argent mis de côté pour payer plus tard.
        </p>
      </header>

      <GoalForm
        key={current?.id ?? `new-${formKey}`}
        people={space.people}
        currency={space.currency}
        initial={current}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSubmit={(draft) => {
          commit((book) => current ? updateGoal(book, current.id, draft) : addGoal(book, draft, today))
          setEditing(null)
          setFormKey((value) => value + 1)
        }}
      />

      {progress.length === 0 ? (
        <p className="empty">Aucun objectif. Le premier peut être un fonds d’un mois de dépenses, ou une chose précise à payer.</p>
      ) : (
        <div className="goal-stack">
          {progress.map((item) => (
            <article key={item.goal.id} className="panel goal-card">
              <GoalMeter item={item} currency={space.currency} />
              <p className="muted">
                {item.goal.personId ? personName(space, item.goal.personId) : 'Tout l’espace'}
                {item.goal.deadline ? ` · échéance ${formatDay(item.goal.deadline)}` : ''}
                {item.goal.note ? ` · ${item.goal.note}` : ''}
                {item.goal.paused ? ' · en pause' : ''}
              </p>
              <ContributionForm
                currency={space.currency}
                defaultDate={today >= period.start && today <= period.end ? today : period.start}
                onAdd={(amount, date, note) => commit((book) => addContribution(book, item.goal.id, amount, date, note))}
              />
              <ul className="mini-list">
                {space.contributions.filter((entry) => entry.goalId === item.goal.id).slice().reverse().map((entry) => (
                  <li key={entry.id}>
                    <span>{formatDay(entry.date)} · {formatMoney(entry.amount, space.currency)}{entry.note ? ` · ${entry.note}` : ''}</span>
                    <button type="button" className="text-btn" onClick={() => commit((book) => deleteContribution(book, entry.id))}>Retirer</button>
                  </li>
                ))}
              </ul>
              <div className="row-actions">
                <button type="button" className="text-btn" onClick={() => commit((book) => featureGoal(book, item.goal.id))}>
                  {item.goal.featured ? 'Mis en avant' : 'Mettre en avant'}
                </button>
                <button type="button" className="text-btn" onClick={() => setEditing(item.goal.id)}>Modifier</button>
                <button type="button" className="text-btn" onClick={() => commit((book) => setGoalPaused(book, item.goal.id, !item.goal.paused))}>
                  {item.goal.paused ? 'Reprendre' : 'Pause'}
                </button>
                <button type="button" className="text-btn danger" onClick={() => {
                  if (confirmId !== item.goal.id) {
                    setConfirmId(item.goal.id)
                    return
                  }
                  commit((book) => deleteGoal(book, item.goal.id))
                }}>
                  {confirmId === item.goal.id ? 'Confirmer' : 'Supprimer'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function GoalForm({
  people,
  currency,
  initial,
  onSubmit,
  onCancel,
}: {
  people: { id: string; name: string }[]
  currency: 'XOF' | 'EUR' | 'USD'
  initial?: { title: string; target: number; deadline?: string; monthlyPlan?: number; personId?: string; note?: string }
  onSubmit: (draft: GoalDraft) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [target, setTarget] = useState(initial ? formatNumber(initial.target, currency) : '')
  const [monthly, setMonthly] = useState(initial?.monthlyPlan ? formatNumber(initial.monthlyPlan, currency) : '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [personId, setPersonId] = useState(initial?.personId ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedTarget = parseAmount(target, currency)
    const parsedMonthly = monthly.trim() ? parseAmount(monthly, currency) : undefined
    if (!title.trim()) return setError('Nomme la chose à payer.')
    if (parsedTarget === null) return setError('Indique le montant à atteindre.')
    if (monthly.trim() && parsedMonthly === null) return setError('Le versement mensuel n’est pas lisible.')
    setError(null)
    onSubmit({
      title,
      target: parsedTarget,
      monthlyPlan: parsedMonthly ?? undefined,
      deadline: deadline || undefined,
      personId: personId || undefined,
      note,
    })
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label className="field grow">
        <span>Pour payer</span>
        <input data-testid="goal-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Scolarité, téléphone, fonds d’urgence…" />
      </label>
      <label className="field">
        <span>Montant visé</span>
        <input data-testid="goal-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0" />
      </label>
      <label className="field">
        <span>Par mois, facultatif</span>
        <input data-testid="goal-plan" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="0" />
      </label>
      <label className="field">
        <span>Échéance, facultatif</span>
        <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </label>
      <label className="field">
        <span>Pour</span>
        <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
          <option value="">Tout l’espace</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <label className="field grow">
        <span>Note</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="composer-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className="btn btn-primary" data-testid="goal-submit">{initial ? 'Enregistrer' : 'Créer l’objectif'}</button>
      </div>
    </form>
  )
}

function ContributionForm({
  currency,
  defaultDate,
  onAdd,
}: {
  currency: 'XOF' | 'EUR' | 'USD'
  defaultDate: string
  onAdd: (amount: number, date: string, note: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount, currency)
    if (parsed === null) {
      setError('Indique le montant versé.')
      return
    }
    setError(null)
    onAdd(parsed, date, note)
    setAmount('')
    setNote('')
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Versement" aria-label="Montant du versement" />
      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Date du versement" required />
      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Déjà de côté, ou ce mois" aria-label="Note du versement" />
      <button className="btn btn-tiny">Verser</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}
