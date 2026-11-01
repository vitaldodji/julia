import { useMemo } from 'react'
import { Pointage } from '../bits'
import { closeMonth, reopenMonth } from '../domain/edit'
import { summarize, verdict } from '../domain/insights'
import { formatMoney } from '../domain/money'
import { categoryLabel } from '../domain/types'
import { usePeriod } from '../period'
import { useVault } from '../store'

export function Review() {
  const { session, commit } = useVault()
  const space = session!.space
  const { period, today, jump } = usePeriod()
  const summary = useMemo(() => summarize(space, period, today), [space, period, today])
  const word = verdict(summary)
  const closed = space.reviews.find((item) => item.periodKey === period.key)
  const history = space.reviews.slice().sort((a, b) => b.periodKey.localeCompare(a.periodKey))

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">Revue · {period.label}</p>
        <h1 className="page-title">{word.title}</h1>
        <p className="lede">{word.detail}</p>
      </header>

      <div className="kpis">
        <article className="kpi"><span>Gagné</span><strong>{formatMoney(summary.income, space.currency)}</strong></article>
        <article className="kpi"><span>Dépensé</span><strong>{formatMoney(summary.expenses, space.currency)}</strong></article>
        <article className="kpi"><span>Mis de côté</span><strong>{formatMoney(summary.contributions, space.currency)}</strong></article>
      </div>

      <section className="panel">
        <h2>Est-ce que les objectifs sont atteints ?</h2>
        {summary.goals.length === 0 ? <p className="muted">Pas d’objectif sur cet espace.</p> : (
          <ul className="rows">
            {summary.goals.map((item) => (
              <li key={item.goal.id} className="row">
                <div>
                  <strong>{item.goal.title}</strong>
                  <span className="muted">
                    {item.reached && 'Montant visé atteint.'}
                    {!item.reached && item.planned && (item.onTrack ? 'Versement du mois fait.' : `Il manque ${formatMoney(item.suggested - item.contributed, space.currency)} ce mois.`)}
                    {!item.reached && !item.planned && 'Sans rythme mensuel, le mois ne peut pas le juger.'}
                  </span>
                </div>
                <span className={item.reached || item.onTrack ? 'tag good' : 'tag'}>
                  {item.reached ? 'Atteint' : item.onTrack ? 'En cours' : 'Pas encore'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Pointage</h2>
        <Pointage items={summary.missing} hasTemplates={space.templates.some((item) => item.active)} />
      </section>

      <section className="panel">
        <h2>Plafonds</h2>
        {summary.byCategory.filter((item) => item.limit).length === 0 ? (
          <p className="muted">Aucun plafond. Tu peux en poser dans le bilan.</p>
        ) : (
          <ul className="rows">
            {summary.byCategory.filter((item) => item.limit).map((item) => (
              <li key={item.category} className="row">
                <strong>{categoryLabel(item.category)}</strong>
                <span className={item.over ? 'tag bad' : 'tag good'}>{item.over ? 'Dépassé' : 'Tenu'} · {formatMoney(item.spent, space.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel close-panel">
        {closed ? (
          <>
            <p>Clôture enregistrée le {new Date(closed.closedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}.</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={() => commit((book) => closeMonth(book, period, new Date().toISOString()))}>
                Mettre à jour la clôture
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => commit((book) => reopenMonth(book, period.key))}>
                Rouvrir le mois
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Quand le mois est complet, enregistre la clôture. Tu pourras y revenir.</p>
            <button type="button" className="btn btn-primary" data-testid="close-month" onClick={() => commit((book) => closeMonth(book, period, new Date().toISOString()))}>
              Clôturer {period.label}
            </button>
          </>
        )}
      </section>

      {history.length > 0 && (
        <section className="panel">
          <h2>Mois déjà clos</h2>
          <ul className="rows">
            {history.map((item) => (
              <li key={item.periodKey} className="row">
                <strong>{item.label}</strong>
                <button type="button" className="text-btn" onClick={() => jump(item.periodKey)}>Revoir</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
