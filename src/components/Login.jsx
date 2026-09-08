import { useState, useRef, useEffect } from 'react'
import { getDemoAccounts, login, isRemoteAuthEnabled } from '../services/authService'
import './css/Login.css'

function Login({ onLogin }) {
  const accounts = getDemoAccounts()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [highlightInput, setHighlightInput] = useState(false)
  const toastTimerRef = useRef(null)

  const isRemote = isRemoteAuthEnabled()

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

  function handleSelectAccount(account) {
    setUsername(account.username)
    setPassword(account.password)
    setError('')
    setHighlightInput(true)
    setTimeout(() => setHighlightInput(false), 500)
    showToast(`Cargado: ${account.label} (${account.username})`)
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
    <section className="login-screen">
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
              <span className="login-brand-subtitle">Punto de Venta & Sistema Transaccional</span>
            </div>
          </div>

          <div className="login-status-group">
            <div className="login-node-badge">
              <span className="login-ping-dot"></span>
              <span>Nodo Activo</span>
            </div>
            <div className="login-demo-badge">
              <span className="login-demo-indicator">
                <span className="login-ping-pulse"></span>
                <span className="login-ping-solid"></span>
              </span>
              <span>Modo demo</span>
            </div>
          </div>
        </header>

        {/* Panel dual en grid */}
        <div className="login-dual-grid">
          {/* Columna Izquierda: Formulario de Autenticación */}
          <div className="login-card-left">
            <div className="login-specular-flare" aria-hidden="true"></div>

            <div className="login-card-header">
              <div className="login-auth-badge">
                <span className="material-symbols-outlined">lock_open</span>
                Acceso Autorizado
              </div>
              <h1 className="login-card-title">Iniciar sesión</h1>
              <p className="login-card-subtitle">
                Usuarios de prueba. Si la base está conectada, las tres cajas comparten la misma cuenta.
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
                <div className={`login-input-wrapper ${highlightInput ? 'input-highlight' : ''}`}>
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

              {/* Campo Clave */}
              <div className="login-field-group">
                <div className="login-label-row">
                  <label className="login-label" htmlFor="login-clave">
                    Clave
                  </label>
                  <button
                    type="button"
                    className="login-forgot-link"
                    onClick={() => showToast('Usa los accesos preconfigurados del panel derecho.')}
                  >
                    ¿Olvidaste la clave?
                  </button>
                </div>
                <div className={`login-input-wrapper ${highlightInput ? 'input-highlight' : ''}`}>
                  <span className="material-symbols-outlined login-input-icon">key</span>
                  <input
                    id="login-clave"
                    name="clave"
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
                    aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
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
                <span>{isSubmitting ? 'Iniciando terminal...' : 'Entrar'}</span>
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

            {/* Footer de estado dentro de la tarjeta */}
            <div className="login-card-footer">
              <div className="login-sync-status">
                <span className="login-sync-dot"></span>
                <span>Sync: {isRemote ? 'Nube Supabase' : 'Almacenamiento Local'}</span>
              </div>
              <span className="login-latency-text">Latencia: 18ms</span>
            </div>
          </div>

          {/* Columna Derecha: Cuentas Demo Preconfiguradas */}
          <div className="login-card-right">
            <div className="login-accounts-header">
              <div className="login-accounts-title">
                <span className="material-symbols-outlined">touch_app</span>
                <h2>Cuentas Demo Preconfiguradas</h2>
              </div>
              <span className="login-autofill-hint">Clic para autorellenar</span>
            </div>

            <div className="login-accounts-list">
              {accounts.map((account) => {
                const isAdmin = account.role === 'admin'
                return (
                  <div
                    key={account.username}
                    className={`login-account-item ${isAdmin ? 'account-item-admin' : ''}`}
                    onClick={() => handleSelectAccount(account)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectAccount(account)
                      }
                    }}
                  >
                    <div className="login-account-info">
                      <div className={`login-account-icon-box ${isAdmin ? 'icon-box-admin' : ''}`}>
                        <span className={`material-symbols-outlined ${isAdmin ? 'icon-fill' : ''}`}>
                          {account.icon || (isAdmin ? 'shield_person' : 'point_of_sale')}
                        </span>
                      </div>

                      <div className="login-account-details">
                        <div className="login-account-title-row">
                          <span className="login-account-label">{account.label}</span>
                          <span className="login-account-role-tag">
                            {account.subtitle || account.role}
                          </span>
                        </div>
                        <div className="login-account-creds">
                          <span>
                            Usuario: <strong>{account.username}</strong>
                          </span>
                          <span className="login-creds-sep">•</span>
                          <span>
                            Clave: <em>{account.password}</em>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="login-account-action">
                      <span className="login-account-load-label">Cargar datos</span>
                      <div className="login-account-load-icon">
                        <span className="material-symbols-outlined">
                          {isAdmin ? 'admin_panel_settings' : 'login'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tarjeta Informativa de Topología */}
            <div className="login-topology-card">
              <span className="material-symbols-outlined login-topology-icon">hub</span>
              <div className="login-topology-content">
                <strong>Topología Multiterminal Activa</strong>
                <p>
                  Las órdenes ingresadas en Caja 1, Caja 2 o Caja 3 se sincronizan en tiempo real
                  con el panel administrativo para balance de inventario y arqueo consolidado.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de página con copyright */}
        <footer className="login-footer">
          <span>PagoCheck Cloud POS © 2025</span>
          <span>•</span>
          <span>Conexión Encriptada TLS 1.3</span>
          <span>•</span>
          <button
            type="button"
            className="login-footer-link"
            onClick={() => showToast('Sistema en modo demostración para evaluación POS.')}
          >
            Términos de prueba
          </button>
        </footer>
      </div>
    </section>
  )
}

export default Login
