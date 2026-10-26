import { useState, type FormEvent, type ReactNode } from 'react'
import { useVault } from '../store'
import { Brand, downloadText, Field } from '../ui'

export function CreateScreen() {
  const { createSpace, storageError } = useVault()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recovery, setRecovery] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('Indique ton prénom, ou le nom de l’espace.')
      return
    }
    if (password.length < 6) {
      setError('Choisis un mot de passe d’au moins 6 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne se correspondent pas.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setRecovery(await createSpace(name, password))
    } catch {
      setError(storageError ?? 'Impossible de créer l’espace sur cet appareil.')
    } finally {
      setBusy(false)
    }
  }

  if (recovery) {
    return (
      <AuthFrame>
        <p className="kicker">Code de secours</p>
        <h1>Note-le avant de continuer.</h1>
        <p className="lede">
          Il retrouve l’espace si le mot de passe est oublié. Cauri ne peut pas le régénérer sans le mot de passe,
          et cette page ne le réaffichera pas.
        </p>
        <input className="recovery-code" readOnly value={recovery} aria-label="Code de secours" onFocus={(event) => event.target.select()} />
        <div className="hero-actions">
          <button type="button" className="btn btn-ghost" onClick={() => downloadText('cauri-code-secours.txt', `Cauri\nCode de secours : ${recovery}\n\nCe code ouvre l’espace si le mot de passe est oublié.\n`)}>
            Télécharger
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { window.location.hash = '#/revenus' }}>
            C’est noté, je commence
          </button>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <p className="kicker">Nouvel espace</p>
      <h1>Ouvre ton cahier.</h1>
      <p className="lede">Ensuite tu notes les revenus, puis les dépenses. Les chiffres ne quittent pas cet appareil.</p>
      <form onSubmit={onSubmit} className="stack">
        <Field label="Ton prénom">
          <input data-testid="input-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" required />
        </Field>
        <Field label="Mot de passe">
          <input data-testid="input-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Encore le mot de passe">
          <input data-testid="input-password-2" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        {storageError && <p className="form-error">{storageError}</p>}
        <button className="btn btn-primary" data-testid="submit-create" disabled={busy}>
          {busy ? 'Création du coffre…' : 'Créer l’espace'}
        </button>
      </form>
      <p className="switch-auth">Déjà un espace ? <a href="#/entrer">Entrer</a></p>
    </AuthFrame>
  )
}

export function EnterScreen() {
  const { spaces, unlock, storageError, removeSpace } = useVault()
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? '')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDrop, setConfirmDrop] = useState(false)
  const selected = spaces.find((item) => item.id === spaceId) ?? spaces[0]

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    const ok = await unlock(selected.id, secret)
    setBusy(false)
    if (!ok) {
      setError('Ce mot de passe, ou ce code, n’ouvre pas cet espace.')
      return
    }
    const next = sessionStorage.getItem('cauri.next')
    sessionStorage.removeItem('cauri.next')
    window.location.hash = next && next.startsWith('#/') && next !== '#/' && next !== '#/creer' && next !== '#/entrer'
      ? next
      : '#/tableau'
  }

  return (
    <AuthFrame>
      <p className="kicker">Entrée</p>
      <h1>Rouvre le coffre.</h1>
      {spaces.length === 0 ? (
        <p className="lede">Aucun espace sur cet appareil. <a href="#/creer">Créer le premier</a>.</p>
      ) : (
        <form onSubmit={onSubmit} className="stack">
          {spaces.length > 1 && (
            <Field label="Espace">
              <select value={selected?.id} onChange={(event) => { setSpaceId(event.target.value); setConfirmDrop(false) }}>
                {spaces.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </select>
            </Field>
          )}
          {spaces.length === 1 && <p className="space-pill">{selected?.displayName}</p>}
          <Field label="Mot de passe ou code de secours">
            <input data-testid="input-secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          {storageError && <p className="form-error">{storageError}</p>}
          <button className="btn btn-primary" data-testid="submit-unlock" disabled={busy}>
            {busy ? 'Ouverture…' : 'Entrer'}
          </button>
          {selected && (
            confirmDrop ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  removeSpace(selected.id)
                  setConfirmDrop(false)
                  setSpaceId('')
                }}
              >
                Retirer {selected.displayName} de cet appareil
              </button>
            ) : (
              <button type="button" className="text-btn" onClick={() => setConfirmDrop(true)}>
                Retirer cet espace de l’appareil
              </button>
            )
          )}
        </form>
      )}
      <p className="switch-auth">Pas encore de cahier ? <a href="#/creer">Créer un espace</a></p>
    </AuthFrame>
  )
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="site auth-site">
      <header className="site-bar"><Brand /></header>
      <main className="auth-card">{children}</main>
    </div>
  )
}
