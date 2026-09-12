import { useState, useRef, useEffect } from 'react'
import { login } from '../services/authService'
import './css/Login.css'

function Login({ onLogin, theme: propTheme, onToggleTheme }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [localTheme, setLocalTheme] = useState(() => localStorage.getItem('pagocheck-theme') || 'dark')
  const toastTimerRef = useRef(null)

  const theme = propTheme || localTheme

  function toggleTheme() {
    if (onToggleTheme) {
      onToggleTheme()
    } else {
      const nextTheme = theme === 'dark' ? 'light' : 'dark'
      setLocalTheme(nextTheme)
      localStorage.setItem('pagocheck-theme', nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  function showToast(message) {
    setToastMessage(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('')
    }, 3200)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await login(username, password)
      if (!result.ok) {
        setError(result.message)
        setIsSubmitting(false)
        return
      }

      showToast(`Sesión iniciada con éxito [${username}]`)
      setTimeout(() => {
        onLogin(result.session)
      }, 350)
    } catch {
      setError('Error inesperado al iniciar sesión.')
      setIsSubmitting(false)
    }
  }

  return (
    <section className={`login-screen theme-${theme}`} data-theme={theme}>
      {/* Luces atmosféricas decorativas */}
      <div className="login-aura-top" aria-hidden="true"></div>
      <div className="login-aura-bottom" aria-hidden="true"></div>

      <div className="login-wrapper">
        {/* Cabecera flotante integrada */}
        <header className="login-top-header">
          <div className="login-brand-group">
            <div className="login-brand-icon">
              <span className="material-symbols-outlined icon-fill">check_circle</span>
            </div>
            <div className="login-brand-text">
              <div className="login-brand-title">
                PagoCheck
                <span className="login-version-badge">POS v3.2</span>
              </div>
              <span className="login-brand-subtitle">Punto de Validación</span>
            </div>
          </div>

          <div className="login-status-group">
            {/* Botón de alternancia de tema (Claro / Oscuro Mate) */}
            <button
              type="button"
              className="login-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro (Mate Anti-reflejo)'}
              aria-label="Alternar tema de pantalla"
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="login-theme-text">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
            </button>

            <div className="login-node-badge">
              <span className="login-ping-dot"></span>
              <span>Nodo Activo</span>
            </div>
          </div>
        </header>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="login-card">
          <div className="login-specular-flare" aria-hidden="true"></div>

          <div className="login-card-header">
            <div className="login-auth-badge">
              <span className="material-symbols-outlined">lock</span>
              Acceso Seguro
            </div>
            <h1 className="login-card-title">Iniciar sesión</h1>
            <p className="login-card-subtitle">
              Acceso a terminales de caja y administración del sistema.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Campo Usuario */}
            <div className="login-field-group">
              <label className="login-label" htmlFor="login-usuario">
                Usuario
              </label>
              <div className="login-input-wrapper">
                <span className="material-symbols-outlined login-input-icon">person</span>
                <input
                  id="login-usuario"
                  name="usuario"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError('')
                  }}
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="login-field-group">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-password">
                  Contraseña
                </label>
              </div>
              <div className="login-input-wrapper">
                <span className="material-symbols-outlined login-input-icon">lock</span>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                />
                <button
                  type="button"
                  className="login-toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Botón Submit */}
            <button
              type="submit"
              className="login-submit-button"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? 'Ingresando...' : 'Ingresar al sistema'}</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

            {/* Toast dinámico */}
            {toastMessage && (
              <div className="login-feedback-toast" role="status">
                <span className="material-symbols-outlined icon-fill">check_circle</span>
                <span>{toastMessage}</span>
              </div>
            )}
        </div>

        {/* Pie de página con copyright */}
        <footer className="login-footer">
          <span>PagoCheck Cloud POS © 2025</span>
          <span>•</span>
          <span>Conexión Encriptada TLS 1.3</span>
        </footer>
      </div>
    </section>
  )
}

export default Login
