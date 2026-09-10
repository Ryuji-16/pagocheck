import './css/Header.css'

function Header({ loggedIn, onGoMenu, onLogout, theme, onToggleTheme }) {
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

          <div className="header-status">
            <span className="status-dot"></span>
            Modo demo
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
