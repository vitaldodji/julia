import { useState, type FormEvent } from 'react'
import { normalizeLogin } from '../domain/cloud'
import { monthCsv } from '../domain/csv'
import { addPerson, removePerson, renamePerson } from '../domain/edit'
import { clampMonthStart } from '../domain/period'
import type { Currency } from '../domain/types'
import { isVaultRecord, type VaultRecord } from '../domain/vault'
import { usePeriod } from '../period'
import { useVault } from '../store'
import { downloadText } from '../ui'

export function Settings() {
  const { session, commit, changePassword, rotateRecovery, relink, removeSpace, exportRecord, importRecord } = useVault()
  const space = session!.space
  const { period } = usePeriod()
  const [name, setName] = useState(space.displayName)
  const [login, setLogin] = useState(space.loginName || normalizeLogin(space.displayName))
  const [day, setDay] = useState(String(space.monthStartsOn))
  const [rule, setRule] = useState(space.rule)
  const [person, setPerson] = useState('')
  const [renames, setRenames] = useState<Record<string, string>>({})
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hasMoney = space.incomes.length + space.expenses.length + space.contributions.length > 0

  function flash(text: string) {
    setError(null)
    setMessage(text)
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault()
    if (nextPassword.length < 6) {
      setError('Le nouveau mot de passe doit faire au moins 6 caractères.')
      return
    }
    setBusy(true)
    const ok = await changePassword(currentPassword, nextPassword)
    setBusy(false)
    if (!ok) {
      setError('Le mot de passe actuel ne correspond pas.')
      return
    }
    setCurrentPassword('')
    setNextPassword('')
    flash('Mot de passe changé.')
  }

  async function onRecovery(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const code = await rotateRecovery(recoveryPassword)
    setBusy(false)
    if (!code) {
      setError('Le mot de passe ne correspond pas. L’ancien code de secours reste valable.')
      return
    }
    setRecoveryPassword('')
    setRecovery(code)
    flash('Nouveau code de secours. L’ancien ne fonctionne plus.')
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="kicker">Réglages</p>
        <h1 className="page-title">L’espace</h1>
        <p className="lede">Le même nom de compte et le même mot de passe rouvrent le cahier sur un autre téléphone. Les montants restent chiffrés.</p>
      </header>
      {message && <p className="ok-line">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="panel stack">
        <h2>Nom du compte</h2>
        <p className="muted">C’est ce nom, avec le mot de passe, qui ouvre le cahier sur un autre téléphone.</p>
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault()
          if (normalizeLogin(login).length < 2) return setError('Le nom du compte est trop court.')
          setBusy(true)
          void relink(login).then(() => {
            flash('Nom de compte enregistré.')
          }).catch((caught: unknown) => {
            setMessage(null)
            setError(caught instanceof Error ? caught.message : 'Impossible de changer le nom du compte.')
          }).finally(() => setBusy(false))
        }}>
          <input data-testid="input-account" value={login} onChange={(event) => setLogin(event.target.value)} aria-label="Nom du compte" autoComplete="username" />
          <button className="btn btn-tiny" disabled={busy}>Enregistrer</button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Nom affiché</h2>
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault()
          if (name.trim().length < 2) return setError('Le nom est trop court.')
          commit((book) => ({ ...book, displayName: name.trim() }))
          flash('Nom enregistré.')
        }}>
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Nom de l’espace" />
          <button className="btn btn-tiny">Enregistrer</button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Mois comptable</h2>
        <p className="muted">Le jour où ton mois commence. 1 pour le mois civil. Utile si le salaire tombe le 25.</p>
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault()
          const value = clampMonthStart(Number(day))
          setDay(String(value))
          commit((book) => ({ ...book, monthStartsOn: value }))
          flash('Début de mois enregistré.')
        }}>
          <input type="number" min={1} max={28} value={day} onChange={(event) => setDay(event.target.value)} aria-label="Jour de début du mois" />
          <button className="btn btn-tiny">Enregistrer</button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Devise</h2>
        {hasMoney ? (
          <p className="muted">Les montants sont en {space.currency === 'XOF' ? 'francs CFA' : space.currency}. Changer la devise ne les convertirait pas, alors elle reste fixe.</p>
        ) : (
          <select value={space.currency} aria-label="Devise" onChange={(event) => commit((book) => ({ ...book, currency: event.target.value as Currency }))}>
            <option value="XOF">Franc CFA (F CFA)</option>
            <option value="EUR">Euro</option>
            <option value="USD">Dollar</option>
          </select>
        )}
      </section>

      <section className="panel stack">
        <h2>Règle du mois</h2>
        <p className="muted">Parts visées des revenus. Le total doit faire 100. Le départ est 50 / 30 / 20.</p>
        <div className="rule-edit">
          <label>Besoins<input type="number" min={0} max={100} value={rule.needs} onChange={(event) => setRule({ ...rule, needs: Number(event.target.value) })} /></label>
          <label>Envies<input type="number" min={0} max={100} value={rule.wants} onChange={(event) => setRule({ ...rule, wants: Number(event.target.value) })} /></label>
          <label>Épargne<input type="number" min={0} max={100} value={rule.savings} onChange={(event) => setRule({ ...rule, savings: Number(event.target.value) })} /></label>
        </div>
        <p className="muted">Total {rule.needs + rule.wants + rule.savings}</p>
        <button type="button" className="btn btn-tiny" onClick={() => {
          if (rule.needs + rule.wants + rule.savings !== 100) {
            setError('Besoins, envies et épargne doivent faire 100.')
            return
          }
          commit((book) => ({ ...book, rule }))
          flash('Règle enregistrée.')
        }}>Enregistrer la règle</button>
      </section>

      <section className="panel stack">
        <h2>Personnes</h2>
        <p className="muted">Ajoute quelqu’un pour suivre ses revenus et ses dépenses à part, dans le même espace.</p>
        <ul className="rows">
          {space.people.map((item) => (
            <li key={item.id} className="row">
              <input
                value={renames[item.id] ?? item.name}
                aria-label={`Nom de ${item.name}`}
                onChange={(event) => setRenames({ ...renames, [item.id]: event.target.value })}
              />
              <button type="button" className="text-btn" onClick={() => {
                const next = (renames[item.id] ?? item.name).trim()
                if (next.length < 2) return setError('Le prénom est trop court.')
                commit((book) => renamePerson(book, item.id, next))
                flash('Personne renommée.')
              }}>Renommer</button>
              <button type="button" className="text-btn" onClick={() => {
                const next = removePerson(space, item.id)
                if (!next) return setError('Garde au moins une personne.')
                commit(() => next)
                flash(`Mouvements repris par ${next.people.find((person) => person.id !== item.id)?.name ?? 'l’autre personne'}.`)
              }}>Retirer</button>
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault()
          if (person.trim().length < 2) return setError('Indique un prénom.')
          commit((book) => addPerson(book, person))
          setPerson('')
          flash('Personne ajoutée.')
        }}>
          <input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Prénom" aria-label="Nouvelle personne" />
          <button className="btn btn-tiny">Ajouter</button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Mot de passe</h2>
        <form className="stack" onSubmit={onPassword}>
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" autoComplete="current-password" />
          <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" autoComplete="new-password" />
          <button className="btn btn-tiny" disabled={busy}>Changer</button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Code de secours</h2>
        <p className="muted">En générer un nouveau annule l’ancien. Note-le tout de suite.</p>
        <form className="inline-form" onSubmit={onRecovery}>
          <input type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} placeholder="Mot de passe" aria-label="Mot de passe pour le code de secours" />
          <button className="btn btn-tiny" disabled={busy}>Nouveau code</button>
        </form>
        {recovery && (
          <input className="recovery-code" readOnly value={recovery} aria-label="Nouveau code de secours" onFocus={(event) => event.target.select()} />
        )}
      </section>

      <section className="panel stack">
        <h2>Emporter les chiffres</h2>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => void exportRecord().then((record) => {
            if (!record) return
            downloadText(`cauri-${space.displayName}.json`, JSON.stringify({ cauri: 1, record }, null, 2), 'application/json')
          })}>Sauvegarde chiffrée</button>
          <button type="button" className="btn btn-ghost" onClick={() => downloadText(`cauri-${period.key}.csv`, monthCsv(space, period), 'text/csv;charset=utf-8')}>
            CSV du mois
          </button>
          <label className="btn btn-ghost file-btn">
            Importer une sauvegarde
            <input type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const parsed: unknown = JSON.parse(String(reader.result))
                  const record = recordFrom(parsed)
                  if (!record) return setError('Ce fichier n’est pas une sauvegarde Cauri.')
                  const result = importRecord(record)
                  if (result) setError(result)
                  else flash('Sauvegarde importée. Ferme le coffre, puis ouvre cet espace.')
                } catch {
                  setError('Fichier illisible.')
                }
              }
              reader.readAsText(file)
            }} />
          </label>
        </div>
      </section>

      <section className="panel danger-zone">
        <h2>Retirer cet espace</h2>
        <p className="muted">Ça retire le cahier de cet appareil. Le compte reste : le même nom et le même mot de passe l’ouvrent ailleurs.</p>
        {confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={() => {
            removeSpace(space.id)
            window.location.hash = '#/'
          }}>Oui, retirer {space.displayName}</button>
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Retirer de cet appareil</button>
        )}
      </section>
    </div>
  )
}

function recordFrom(value: unknown): VaultRecord | null {
  if (!value || typeof value !== 'object') return null
  const wrapped = value as { record?: unknown }
  const record = wrapped.record ?? value
  return isVaultRecord(record) ? record : null
}
