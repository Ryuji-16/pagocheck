import { useState } from 'react'
import Header from './components/Header'
import Login from './components/Login'
import Menu from './components/Menu'
import Vuelto from './components/Vuelto'
import Settings from './components/Settings'
import UploadZone from './components/UploadZone'
import { getSession, logout } from './services/authService'
import './App.css'
import './components/css/Modals.css'

function App() {
  const [session, setSession] = useState(() => getSession())
  const [screen, setScreen] = useState(() => (getSession() ? 'menu' : 'login'))

  function handleLogin(nextSession) {
    setSession(nextSession)
    setScreen('menu')
  }

  function handleLogout() {
    logout()
    setSession(null)
    setScreen('login')
  }

  function goMenu() {
    setScreen('menu')
  }

  return (
    <>
      <Header
        loggedIn={Boolean(session)}
        onGoMenu={session ? goMenu : undefined}
        onLogout={session ? handleLogout : undefined}
      />

      <main>
        {screen === 'login' && (
          <Login onLogin={handleLogin} />
        )}

        {screen === 'menu' && session && (
          <Menu
            username={session.username}
            label={session.label}
            onOpenVerify={() => setScreen('verify')}
            onOpenVuelto={() => setScreen('vuelto')}
            onOpenSettings={() => setScreen('settings')}
            onLogout={handleLogout}
          />
        )}

        {screen === 'verify' && (
          <>
            <button
              type="button"
              className="modal-back-button"
              onClick={goMenu}
            >
              ← Menú
            </button>

            <p className="demo-banner" role="status">
              Prototipo de prueba. Los resultados aún no consultan un banco real.
            </p>

            <h1>Verifica tu pago</h1>

            <p>
              Comprueba que el pago fue recibido correctamente.
            </p>

            <UploadZone />
          </>
        )}

        {screen === 'vuelto' && (
          <Vuelto onBack={goMenu} />
        )}

        {screen === 'settings' && session && (
          <Settings username={session.username} onBack={goMenu} />
        )}
      </main>
    </>
  )
}

export default App
