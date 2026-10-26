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
          <a className="btn btn-primary" href="#/creer" data-testid="link-creer">Créer un espace</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">Cahier d’argent</p>
          <h1>Ce qui entre. Ce qui sort. Ce qui reste.</h1>
          <p className="lede">
            Cauri suit tes revenus, chaque dépense avec son titre, et les objectifs que tu veux payer.
            À la fin du mois, tu sais si tu as tenu — sans trou dans le cahier.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#/creer">Ouvrir mon cahier</a>
            <a className="btn btn-ghost" href="#/entrer">J’ai déjà un espace</a>
          </div>
          <ul className="facts">
            <li>Chiffré sur cet appareil</li>
            <li>Toi, et les personnes que tu suis</li>
            <li>Plusieurs objectifs en parallèle</li>
          </ul>
        </div>
        <aside className="preview" aria-label="Exemple de tableau, chiffres fictifs">
          <div className="preview-top">
            <span>Exemple · Octobre</span>
            <span>F CFA</span>
          </div>
          <p className="preview-kicker">Reste à vivre</p>
          <p className="preview-figure">67&nbsp;000</p>
          <div className="preview-row"><span>Revenus</span><span>225&nbsp;000</span></div>
          <div className="preview-row"><span>Dépenses</span><span>128&nbsp;000</span></div>
          <div className="preview-row"><span>Mis de côté</span><span>30&nbsp;000</span></div>
          <div className="preview-row preview-strong"><span>Aujourd’hui</span><span>3&nbsp;190</span></div>
          <div className="preview-goal">
            <span>Téléphone</span>
            <div className="bar"><span style={{ width: '33%' }} /></div>
            <span>30&nbsp;000 / 90&nbsp;000</span>
          </div>
        </aside>
      </section>

      <section className="band">
        <h2>Le mois en quatre gestes</h2>
        <ol className="band-grid">
          <li><span>1</span><strong>Tu crées un espace.</strong> Un mot de passe, et un code de secours à garder ailleurs.</li>
          <li><span>2</span><strong>Tu notes tes revenus.</strong> Salaire, activité, aide : tout ce qui entre, une fois ou chaque mois.</li>
          <li><span>3</span><strong>Tu notes chaque dépense.</strong> Un titre, un montant, pour toi ou pour une autre personne.</li>
          <li><span>4</span><strong>Tu lis le bilan.</strong> Gagné, dépensé, mis de côté, et si les objectifs du mois sont atteints.</li>
        </ol>
      </section>

      <section className="ideas">
        <h2>Ce que le cahier surveille pour toi</h2>
        <div className="idea-grid">
          <article>
            <p className="kicker">Pointage</p>
            <h3>Rien ne manque à la fin du mois</h3>
            <p>Le loyer, le forfait, le salaire : tu les marques « tous les mois ». Cauri te montre ce qui n’est pas encore noté, et un geste les pointe.</p>
          </article>
          <article className="idea-deep">
            <p className="kicker">Rythme</p>
            <h3>Ce que tu peux encore dépenser aujourd’hui</h3>
            <p>Le reste à vivre est divisé par les jours qui restent. Une projection dit où le mois finit si le rythme continue.</p>
          </article>
          <article>
            <p className="kicker">Objectifs</p>
            <h3>Plusieurs choses à payer, chacune à son rythme</h3>
            <p>École, téléphone, fonds d’urgence. Tu verses dessus sans mélanger ça avec les dépenses. Le mois dit si le versement prévu est fait.</p>
          </article>
        </div>
      </section>

      <footer className="foot">
        <Brand />
        <p>
          Les chiffres restent dans ce navigateur, chiffrés par ton mot de passe. Cauri ne les envoie nulle part.
          Sur un autre téléphone, emporte la sauvegarde depuis Réglages.
        </p>
      </footer>
    </div>
  )
}
