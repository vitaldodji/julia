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
      setError('Indique le nom du compte.')
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de créer le compte. Réessaie.')
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
      <p className="kicker">Nouveau compte</p>
      <h1>Ouvre ton cahier.</h1>
      <p className="lede">Ce nom et ce mot de passe rouvrent le cahier sur un autre téléphone. Les montants partent chiffrés.</p>
      <form onSubmit={onSubmit} className="stack">
        <Field label="Nom du compte">
          <input data-testid="input-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" required />
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
          {busy ? 'Création du compte…' : 'Créer le compte'}
        </button>
      </form>
      <p className="switch-auth">Déjà un compte ? <a href="#/entrer">Entrer</a></p>
    </AuthFrame>
  )
}

export function EnterScreen() {
  const { spaces, openAccount, storageError, removeSpace } = useVault()
  const [name, setName] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDrop, setConfirmDrop] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await openAccount(name, secret)
      if (result !== 'opened') {
        setError(result === 'denied'
          ? 'Ce mot de passe, ou ce code, n’ouvre pas ce compte.'
          : 'Aucun compte sous ce nom. Vérifie l’orthographe, ou crée-le.')
        return
      }
      const next = sessionStorage.getItem('cauri.next')
      sessionStorage.removeItem('cauri.next')
      window.location.hash = next && next.startsWith('#/') && next !== '#/' && next !== '#/creer' && next !== '#/entrer'
        ? next
        : '#/tableau'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connexion impossible. Réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame>
      <p className="kicker">Entrée</p>
      <h1>Rouvre le compte.</h1>
      <p className="lede">Le même nom et le même mot de passe, sur ce téléphone ou un autre.</p>
      <form onSubmit={onSubmit} className="stack">
        <Field label="Nom du compte">
          <input data-testid="input-login" value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Mot de passe ou code de secours">
          <input data-testid="input-secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        {storageError && <p className="form-error">{storageError}</p>}
        <button className="btn btn-primary" data-testid="submit-unlock" disabled={busy}>
          {busy ? 'Ouverture…' : 'Entrer'}
        </button>
      </form>
      {spaces.length > 0 && (
        <div className="stack local-copies">
          <p className="muted">Déjà copiés sur cet appareil</p>
          {spaces.map((item) => (
            confirmDrop === item.id ? (
              <button key={item.id} type="button" className="btn btn-danger" onClick={() => { removeSpace(item.id); setConfirmDrop(null) }}>
                Retirer {item.displayName} de cet appareil
              </button>
            ) : (
              <button key={item.id} type="button" className="text-btn" onClick={() => setConfirmDrop(item.id)}>
                Retirer {item.displayName} de cet appareil
              </button>
            )
          ))}
        </div>
      )}
      <p className="switch-auth">Pas encore de cahier ? <a href="#/creer">Créer un compte</a></p>
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
