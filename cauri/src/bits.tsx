import { formatMoney } from './domain/money'
import { pointTemplate } from './domain/edit'
import type { GoalProgress } from './domain/insights'
import type { Currency, Template } from './domain/types'
import { usePeriod } from './period'
import { useVault } from './store'

export function Pointage({ items, hasTemplates }: { items: Template[]; hasTemplates: boolean }) {
  const { commit } = useVault()
  const { period } = usePeriod()
  if (!hasTemplates) {
    return <p className="muted">Rien n’est encore prévu chaque mois. Sur un salaire ou un loyer, coche « Tous les mois ».</p>
  }
  if (items.length === 0) return <p className="ok-line">Tous les prévus de ce mois sont pointés.</p>
  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.kind === 'income' ? 'Revenu à encaisser' : 'Dépense à noter'} · jour {item.dayOfMonth}</span>
          </div>
          <button
            type="button"
            className="btn btn-tiny"
            onClick={() => commit((space) => pointTemplate(space, item, period))}
          >
            Pointer
          </button>
        </li>
      ))}
    </ul>
  )
}

export function GoalMeter({ item, currency }: { item: GoalProgress; currency: Currency }) {
  const ratio = item.goal.target > 0 ? Math.min(1, item.saved / item.goal.target) : 0
  return (
    <article className="goal-line">
      <div className="goal-line-top">
        <strong>{item.goal.title}</strong>
        <span>{formatMoney(item.saved, currency)} / {formatMoney(item.goal.target, currency)}</span>
      </div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></div>
      <p className="muted">
        {item.reached && 'Objectif atteint.'}
        {!item.reached && item.planned && (item.onTrack
          ? `Versement du mois fait : ${formatMoney(item.contributed, currency)}.`
          : `Ce mois, vise ${formatMoney(item.suggested, currency)}. Déjà versé : ${formatMoney(item.contributed, currency)}.`)}
        {!item.reached && !item.planned && 'Pas encore de rythme. Ajoute une échéance ou un montant par mois.'}
      </p>
    </article>
  )
}
