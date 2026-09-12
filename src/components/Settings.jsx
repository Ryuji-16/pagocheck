import { useState } from 'react'
import SettingsSecurityTab from './SettingsSecurityTab'
import SettingsBusinessTab from './SettingsBusinessTab'
import SettingsStorageTab from './SettingsStorageTab'
import './css/Modals.css'
import './css/Settings.css'

function Settings({ session, username, onBack }) {
  const [activeTab, setActiveTab] = useState('security')
  const isAdmin = session?.role === 'admin'
  const resolvedUsername = username || session?.username || 'usuario'

  const tabs = [
    { id: 'security', label: 'Seguridad', icon: '🔑' },
    ...(isAdmin
      ? [
          { id: 'business', label: 'Negocio', icon: '🏢' },
          { id: 'storage', label: 'Almacenamiento', icon: '💾' }
        ]
      : [])
  ]

  return (
    <section className="settings-screen">
      <div className="settings-top-bar">
        <button type="button" className="modal-back-button" onClick={onBack}>
          ← Menú
        </button>

        <div className="settings-user-badge">
          <span className="settings-user-role-pill">
            {isAdmin ? '🛡️ Administrador' : '👤 Cajero'}
          </span>
          <span className="settings-username-label">{resolvedUsername}</span>
        </div>
      </div>

      <div className="settings-main-container">
        <header className="settings-header">
          <h2>{isAdmin ? 'Panel de Administración' : 'Configuración de Usuario'}</h2>
          <p className="settings-header-subtitle">
            {isAdmin
              ? 'Gestiona la seguridad, perfil de negocio y políticas de retención del sistema'
              : 'Administra tus credenciales de acceso y preferencias'}
          </p>
        </header>

        {tabs.length > 1 && (
          <nav className="settings-nav-tabs" role="tablist" aria-label="Secciones de configuración">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`settings-nav-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="settings-nav-tab-icon">{tab.icon}</span>
                  <span className="settings-nav-tab-label">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        )}

        <div className="app-panel settings-panel">
          {activeTab === 'security' && (
            <SettingsSecurityTab username={resolvedUsername} />
          )}

          {activeTab === 'business' && isAdmin && (
            <SettingsBusinessTab />
          )}

          {activeTab === 'storage' && isAdmin && (
            <SettingsStorageTab session={session} />
          )}
        </div>
      </div>
    </section>
  )
}

export default Settings
