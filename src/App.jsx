import { useState, useEffect } from 'react'
import Header from './components/Header'
import Login from './components/Login'
import Menu from './components/Menu'
import Vuelto from './components/Vuelto'
import Settings from './components/Settings'
import UploadZone from './components/UploadZone'
import Movements from './components/Movements'
import { getSession, logout } from './services/authService'
import './App.css'
import './components/css/Modals.css'

function App() {
  const [session, setSession] = useState(() => getSession())
  const [screen, setScreen] = useState(() => (getSession() ? 'menu' : 'login'))
  const [theme, setTheme] = useState(() => localStorage.getItem('pagocheck-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pagocheck-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

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
      {session && (
        <Header
          loggedIn={Boolean(session)}
          onGoMenu={goMenu}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      <main>
        {screen === 'login' && (
          <Login
            onLogin={handleLogin}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {screen === 'menu' && session && (
          <Menu
            username={session.username}
            label={session.label}
            branch={session.branch}
            onOpenVerify={() => setScreen('verify')}
            onOpenVuelto={() => setScreen('vuelto')}
            onOpenMovements={() => setScreen('movements')}
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

            <UploadZone onBack={goMenu} />
          </>
        )}

        {screen === 'vuelto' && (
          <Vuelto onBack={goMenu} />
        )}

        {screen === 'movements' && session && (
          <Movements session={session} onBack={goMenu} />
        )}

        {screen === 'settings' && session && (
          <Settings session={session} username={session.username} onBack={goMenu} />
        )}
      </main>
    </>
  )
}

export default App
