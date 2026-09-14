import { isRemoteDbEnabled } from '../services/supabaseClient'
import './css/Header.css'

function Header({ loggedIn, session, onGoMenu, onOpenDrawer, theme, onToggleTheme }) {
  const isCloud = isRemoteDbEnabled()
  const statusLabel = isCloud ? 'En línea' : 'Modo local'
  const userName = session?.label || session?.username || 'Usuario'

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left-group">
          {loggedIn && onOpenDrawer && (
            <button
              type="button"
              className="header-menu-button"
              onClick={onOpenDrawer}
              title="Abrir menú de opciones"
              aria-label="Abrir menú de opciones"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          )}

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
        </div>

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

          {loggedIn && onOpenDrawer && (
            <button
              type="button"
              className="header-user-btn"
              onClick={onOpenDrawer}
              title="Ver perfil y menú de opciones"
              aria-label="Abrir menú de usuario"
            >
              <span className="header-user-avatar">
                {userName.charAt(0).toUpperCase()}
              </span>
              <span className="header-user-name">
                {userName}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
