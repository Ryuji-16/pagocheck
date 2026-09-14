import { isRemoteDbEnabled } from '../services/supabaseClient'
import './css/Header.css'

function Header({ loggedIn, session, onGoMenu, onLogout, theme, onToggleTheme }) {
  const isCloud = isRemoteDbEnabled()
  const statusLabel = isCloud ? 'En línea' : 'Modo local'

  return (
    <header className="app-header">
      <div className="header-content">
        <button
          type="button"
          className="brand"
          onClick={loggedIn ? onGoMenu : undefined}
        >
          <div className="brand-icon">
            ✓
          </div>
          PagoCheck
        </button>

        <div className="header-actions">
          <button
            type="button"
            className="header-theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Cambiar tema"
          >
            <span className="header-theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="header-theme-text">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>

          <div
            className="header-status"
            title={isCloud ? `Conectado a la nube (Supabase)${session?.branch ? ` · ${session.branch}` : ''}` : 'Modo local (sin conexión)'}
          >
            <span className="status-dot"></span>
            <span>{statusLabel}{session?.branch ? ` · ${session.branch}` : ''}</span>
          </div>

          {loggedIn && (
            <button
              type="button"
              className="header-logout"
              onClick={onLogout}
            >
              Salir
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
