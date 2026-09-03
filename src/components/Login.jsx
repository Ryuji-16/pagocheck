import { useState } from 'react'
import { getDemoAccounts, login } from '../services/authService'
import './css/Login.css'

function Login({ onLogin }) {
  const accounts = getDemoAccounts()
  const [username, setUsername] = useState('')
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
          Prototipo sin servidor. Estos usuarios están en el código para
          que cualquiera con el link pueda probarlos.
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

        <ul className="login-accounts">
          {accounts.map((account) => (
            <li key={account.username}>
              <button
                type="button"
                onClick={() => {
                  setUsername(account.username)
                  setPassword(account.password)
                  setError('')
                }}
              >
                <span>{account.label}</span>
                <strong>{account.username}</strong>
                <em>{account.password}</em>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default Login
