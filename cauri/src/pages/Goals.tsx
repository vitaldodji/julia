import { useMemo, useState, type FormEvent } from 'react'
import { GoalMeter } from '../bits'
import { addContribution, addGoal, deleteGoal, updateGoal, type GoalDraft } from '../domain/edit'
import { goalProgress } from '../domain/insights'
import { formatMoney, formatNumber, parseAmount } from '../domain/money'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Goals() {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today } = usePeriod()
  const [editing, setEditing] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const current = space.goals.find((item) => item.id === editing)
  const progress = useMemo(
    () => space.goals.map((goal) => goalProgress(space, goal, period, today)),
    [period, space, today],
  )
  const defaultDate = today >= period.start && today <= period.end ? today : period.start

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">Mis de côté</p>
        <h1 className="page-title">Objectifs</h1>
        <p className="lede">Une chose à payer. L’argent mis de côté n’est pas une dépense.</p>
      </header>

      <GoalForm
        key={current?.id ?? `new-${formKey}`}
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
        <p className="empty">Aucun objectif.</p>
      ) : (
        <div className="goal-stack">
          {progress.map((item) => (
            <article key={item.goal.id} className="goal-card">
              <GoalMeter item={item} currency={space.currency} />
              <p className="muted">
                {item.reached
                  ? 'Atteint.'
                  : item.planned && !item.onTrack
                    ? 'Pas encore le versement de ce mois.'
                    : `Il manque ${formatMoney(item.remaining, space.currency)}.`}
              </p>
              {!item.reached && (
                <form className="inline-form" onSubmit={(event) => {
                  event.preventDefault()
                  const input = event.currentTarget.elements.namedItem('versement') as HTMLInputElement
                  const parsed = parseAmount(input.value, space.currency)
                  if (parsed === null) return
                  commit((book) => addContribution(book, item.goal.id, parsed, defaultDate))
                  input.value = ''
                }}>
                  <input name="versement" inputMode="numeric" placeholder="Montant mis de côté" aria-label={`Versement pour ${item.goal.title}`} />
                  <button className="btn btn-tiny">Mettre de côté</button>
                </form>
              )}
              <div className="row-actions">
                <button type="button" className="text-btn" onClick={() => setEditing(item.goal.id)}>Modifier</button>
                <button type="button" className="text-btn" onClick={() => commit((book) => deleteGoal(book, item.goal.id))}>Retirer</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function GoalForm({
  currency,
  initial,
  onSubmit,
  onCancel,
}: {
  currency: 'XOF' | 'EUR' | 'USD'
  initial?: { title: string; target: number; monthlyPlan?: number }
  onSubmit: (draft: GoalDraft) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [target, setTarget] = useState(initial ? formatNumber(initial.target, currency) : '')
  const [monthly, setMonthly] = useState(initial?.monthlyPlan ? formatNumber(initial.monthlyPlan, currency) : '')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedTarget = parseAmount(target, currency)
    const parsedMonthly = monthly.trim() ? parseAmount(monthly, currency) : undefined
    if (!title.trim()) return setError('Nomme la chose à payer.')
    if (parsedTarget === null) return setError('Indique le montant à atteindre.')
    if (monthly.trim() && parsedMonthly === null) return setError('Le versement du mois n’est pas lisible.')
    setError(null)
    onSubmit({ title, target: parsedTarget, monthlyPlan: parsedMonthly ?? undefined })
  }

  return (
    <form className="quick" onSubmit={submit}>
      <label className="field">
        <span>Pour payer</span>
        <input data-testid="goal-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Téléphone, études…" />
      </label>
      <label className="field">
        <span>Montant visé</span>
        <input data-testid="goal-target" inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0" />
      </label>
      <label className="field">
        <span>À mettre de côté chaque mois</span>
        <input data-testid="goal-plan" inputMode="numeric" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="Facultatif" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="hero-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className="btn btn-primary" data-testid="goal-submit">{initial ? 'Enregistrer' : 'Créer l’objectif'}</button>
      </div>
    </form>
  )
}
