import { useState } from 'react'
import { getTenantConfig, setTenantConfig } from '../config/tenantConfig'

function SettingsBusinessTab() {
  const [config, setConfig] = useState(() => getTenantConfig())
  const [businessName, setBusinessName] = useState(() => config.businessName || '')
  const [botAlias, setBotAlias] = useState(() => config.bot?.alias || '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setOk('')

    const cleanBusinessName = businessName.trim()
    const cleanBotAlias = botAlias.trim()

    if (!cleanBusinessName) {
      setError('El nombre del negocio es obligatorio.')
      return
    }

    setIsSaving(true)
    try {
      const updated = setTenantConfig({
        businessName: cleanBusinessName,
        bot: {
          alias: cleanBotAlias
        }
      })

      setConfig(updated)
      setBusinessName(updated.businessName || '')
      setBotAlias(updated.bot?.alias || '')
      setOk('Perfil de negocio y asistente virtual actualizados correctamente.')
    } catch {
      setError('Error al guardar la configuración del negocio.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-tab-content">
      <div className="settings-tab-header">
        <h3 className="settings-tab-title">Perfil de Negocio & Marca Blanca</h3>
        <p className="settings-tab-desc">
          Configura los datos de identidad corporativa y la personalización del asistente virtual para todos los canales de venta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {error && <p className="app-form-error">{error}</p>}
        {ok && <p className="app-form-ok">{ok}</p>}

        <label className="app-field">
          Nombre del Comercio o Negocio
          <input
            type="text"
            value={businessName}
            onChange={(event) => {
              setBusinessName(event.target.value)
              setError('')
              setOk('')
            }}
            placeholder="Ej. Pitapollo"
            required
          />
          <span className="settings-field-hint">
            Aparece en reportes de caja, comprobantes de pago y exportaciones.
          </span>
        </label>

        <label className="app-field">
          Alias del Asistente Virtual / Bot
          <input
            type="text"
            value={botAlias}
            onChange={(event) => {
              setBotAlias(event.target.value)
              setError('')
              setOk('')
            }}
            placeholder="Ej. Pitín"
          />
          <span className="settings-field-hint">
            Nombre con el que se identifica el bot automatizado en canales conversacionales como WhatsApp.
          </span>
        </label>

        <div className="settings-info-card">
          <div className="settings-info-icon">🏢</div>
          <div className="settings-info-text">
            <strong>Identificador del Tenant:</strong> {config.tenantId || 'pitapollo-01'}
            <br />
            <strong>Sucursal por defecto del bot:</strong> {config.bot?.branch || 'WhatsApp / Delivery'}
          </div>
        </div>

        <button type="submit" className="app-button" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar perfil de negocio'}
        </button>
      </form>
    </div>
  )
}

export default SettingsBusinessTab
