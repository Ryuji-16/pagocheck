import { useState } from 'react'
import { changePassword } from '../services/authService'

function SettingsSecurityTab({ username }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setOk('')

    if (!currentPassword) {
      setError('Ingresa tu clave actual.')
      return
    }

    if (nextPassword !== confirmPassword) {
      setError('La nueva clave y la confirmación no coinciden.')
      return
    }

    if (nextPassword.length < 4) {
      setError('La nueva clave debe tener al menos 4 caracteres.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await changePassword(username, currentPassword, nextPassword)

      if (!result.ok) {
        setError(result.message || 'No se pudo actualizar la clave.')
        return
      }

      setCurrentPassword('')
      setNextPassword('')
      setConfirmPassword('')
      setOk('Clave actualizada correctamente.')
    } catch {
      setError('Error inesperado al intentar cambiar la clave.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="settings-tab-content">
      <div className="settings-tab-header">
        <h3 className="settings-tab-title">Seguridad de la cuenta</h3>
        <p className="settings-tab-desc">
          Usuario: <strong>{username}</strong>. Si hay base remota conectada, la nueva clave tendrá validez en todas las cajas y terminales.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {error && <p className="app-form-error">{error}</p>}
        {ok && <p className="app-form-ok">{ok}</p>}

        <label className="app-field">
          Clave actual
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Introduce tu clave actual"
            autoComplete="current-password"
            required
          />
        </label>

        <label className="app-field">
          Nueva clave
          <input
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            placeholder="Mínimo 4 caracteres"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="app-field">
          Confirmar nueva clave
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repite la nueva clave"
            autoComplete="new-password"
            required
          />
        </label>

        <button type="submit" className="app-button" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar nueva clave'}
        </button>
      </form>
    </div>
  )
}

export default SettingsSecurityTab
