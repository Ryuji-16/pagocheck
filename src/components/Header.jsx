import './css/Header.css'

function Header({ loggedIn, onGoMenu, onLogout }) {
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
