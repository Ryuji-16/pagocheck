import { useState } from 'react'
import { changePassword } from '../services/authService'
import './css/Modals.css'
import './css/Settings.css'

function Settings({ username, onBack }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setOk('')

    if (nextPassword !== confirmPassword) {
      setError('La nueva clave y la confirmación no coinciden.')
      return
    }

    const result = changePassword(username, currentPassword, nextPassword)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setCurrentPassword('')
    setNextPassword('')
    setConfirmPassword('')
    setOk('Clave actualizada en este dispositivo.')
  }

  return (
    <section className="settings-screen">
      <button type="button" className="modal-back-button" onClick={onBack}>
        ← Menú
      </button>

      <div className="app-panel">
        <h2>Cambiar clave</h2>
        <p className="panel-copy">
          Usuario: {username}. La clave se guarda solo en este navegador.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <p className="app-form-error">{error}</p>}
          {ok && <p className="app-form-ok">{ok}</p>}

          <label className="app-field">
            Clave actual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>

          <label className="app-field">
            Nueva clave
            <input
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
            />
          </label>

          <label className="app-field">
            Confirmar clave
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          <button type="submit" className="app-button">
            Guardar clave
          </button>
        </form>
      </div>
    </section>
  )
}

export default Settings
