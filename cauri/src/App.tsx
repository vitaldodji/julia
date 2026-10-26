import { useEffect } from 'react'
import { PeriodProvider } from './period'
import { CreateScreen, EnterScreen } from './pages/Auth'
import { Landing } from './pages/Landing'
import { Shell } from './pages/Shell'
import { useVault, VaultProvider } from './store'
import { useHash } from './ui'

const PRIVATE = new Set(['#/tableau', '#/revenus', '#/depenses', '#/objectifs', '#/bilan', '#/revue', '#/reglages'])

export function App() {
  return (
    <VaultProvider>
      <Routes />
    </VaultProvider>
  )
}

function Routes() {
  const hash = useHash()
  const { ready, session } = useVault()

  useEffect(() => {
    if (!ready || session || !PRIVATE.has(hash)) return
    sessionStorage.setItem('cauri.next', hash)
    if (window.location.hash !== '#/entrer') window.location.hash = '#/entrer'
  }, [hash, ready, session])

  if (!ready) return <p className="boot">Ouverture…</p>
  if (session && PRIVATE.has(hash)) {
    return (
      <PeriodProvider>
        <Shell hash={hash} />
      </PeriodProvider>
    )
  }
  if (hash === '#/creer') return <CreateScreen />
  if (hash === '#/entrer') return <EnterScreen />
  return <Landing />
}
