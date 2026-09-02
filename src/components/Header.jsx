import './css/Header.css'

function Header() {
  return (
    <header className="app-header">
      <div className="header-content">

        <div className="brand">
          <div className="brand-icon">
            ✓
          </div>

          PagoCheck
        </div>

        <div className="header-status">
          <span className="status-dot"></span>
          Modo demo
        </div>

      </div>
    </header>
  )
}

export default Header