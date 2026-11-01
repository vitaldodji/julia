import { Brand } from '../ui'
import { useVault } from '../store'

export function Landing() {
  const { session } = useVault()
  return (
    <div className="site">
      <header className="site-bar">
        <Brand />
        <nav className="site-nav">
          {session && <a className="btn btn-ghost" href="#/tableau">Revenir au mois</a>}
          <a className="btn btn-ghost" href="#/entrer">Entrer</a>
            <a className="btn btn-primary" href="#/creer" data-testid="link-creer">Créer un compte</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">Cahier d’argent</p>
          <h1>Note. Regarde ce qui reste.</h1>
          <p className="lede">
            Un biscuit à 100 F, l’essence, un cours au collège. Tu le notes tout de suite.
            Le mois dit combien est parti, dans quoi, et quels objectifs ne sont pas tenus.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#/creer">Ouvrir mon cahier</a>
            <a className="btn btn-ghost" href="#/entrer">J’ai déjà un compte</a>
          </div>
        </div>
      </section>

      <footer className="foot">
        <Brand />
        <p>
          Les montants restent chiffrés. Le même nom de compte et le même mot de passe rouvrent le cahier sur un autre téléphone.
        </p>
      </footer>
    </div>
  )
}
