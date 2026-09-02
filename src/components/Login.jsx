import { useState } from 'react'
import { getDemoCredentials, login } from '../services/authService'
import './css/Login.css'

function Login({ onLogin }) {
  const demo = getDemoCredentials()
  const [username, setUsername] = useState(demo.username)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const result = login(username, password)

    if (!result.ok) {
      setError(result.message)
      return
    }

    onLogin(result.session)
  }

  return (
    <section className="login-screen">
      <div className="app-panel">
        <h1>Iniciar sesión</h1>
        <p className="panel-copy">
          Entra para validar pagos o dar vuelto. Prototipo local, sin servidor.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <p className="app-form-error">{error}</p>}

          <label className="app-field">
            Usuario
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setError('')
              }}
            />
          </label>

          <label className="app-field">
            Clave
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
            />
          </label>

          <button type="submit" className="app-button">
            Entrar
          </button>
        </form>

        <p className="login-hint">
          Demo: usuario <strong>{demo.username}</strong> · clave <strong>{demo.password}</strong>
        </p>
      </div>
    </section>
  )
}

export default Login
