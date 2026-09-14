import { useEffect, useRef } from 'react'
import './css/NavigationDrawer.css'

function NavigationDrawer({
  isOpen,
  onClose,
  session,
  currentScreen,
  onNavigate,
  theme,
  onToggleTheme,
  onLogout
}) {
  const panelRef = useRef(null)

  // Cerrar al presionar Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isAdmin =
    session?.role === 'admin' ||
    session?.role === 'admin_sucursal' ||
    session?.role === 'admin_tienda'

  const roleLabel =
    session?.role === 'admin'
      ? 'Dueño'
      : session?.role?.startsWith('admin')
        ? 'Supervisor'
        : 'Cajero'

  const resolvedName = session?.label || session?.username || 'Usuario'
  const branchName = session?.branch || 'General'

  function handleItemClick(screen) {
    onNavigate(screen)
    onClose()
  }

  function handleLogoutClick() {
    onClose()
    onLogout()
  }

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de opciones de usuario y navegación"
    >
      <div
        className="drawer-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera: Perfil de Operador y Botón Cerrar */}
        <header className="drawer-header">
          <div className="drawer-header-top">
            <div className="drawer-brand">
              <span className="drawer-brand-icon">✓</span>
              <span>PagoCheck</span>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={onClose}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <div className="drawer-user-card">
            <div className="drawer-user-avatar">
              <span>{resolvedName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="drawer-user-info">
              <span className="drawer-user-name" title={resolvedName}>
                {resolvedName}
              </span>
              <div className="drawer-user-meta">
                <span className="drawer-role-pill">{roleLabel}</span>
                <span className="drawer-branch-label" title={branchName}>
                  📍 {branchName}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Cuerpo de Navegación */}
        <nav className="drawer-body">
          <p className="drawer-section-title">Operaciones</p>

          <button
            type="button"
            className={`drawer-nav-item ${currentScreen === 'menu' ? 'active' : ''}`}
            onClick={() => handleItemClick('menu')}
          >
            <span className="drawer-nav-icon">🏠</span>
            <span className="drawer-nav-label">Inicio / Menú</span>
          </button>

          <button
            type="button"
            className={`drawer-nav-item ${currentScreen === 'verify' ? 'active' : ''}`}
            onClick={() => handleItemClick('verify')}
          >
            <span className="drawer-nav-icon">✓</span>
            <span className="drawer-nav-label">Validar Pago Móvil</span>
          </button>

          <button
            type="button"
            className={`drawer-nav-item ${currentScreen === 'vuelto' ? 'active' : ''}`}
            onClick={() => handleItemClick('vuelto')}
          >
            <span className="drawer-nav-icon">⇄</span>
            <span className="drawer-nav-label">Dar Vuelto</span>
          </button>

          <button
            type="button"
            className={`drawer-nav-item ${currentScreen === 'movements' ? 'active' : ''}`}
            onClick={() => handleItemClick('movements')}
          >
            <span className="drawer-nav-icon">☰</span>
            <span className="drawer-nav-label">Historial de Movimientos</span>
          </button>

          <div className="drawer-divider" />

          <p className="drawer-section-title">Ajustes del Sistema</p>

          <button
            type="button"
            className={`drawer-nav-item ${currentScreen === 'settings' ? 'active' : ''}`}
            onClick={() => handleItemClick('settings')}
          >
            <span className="drawer-nav-icon">⚙️</span>
            <span className="drawer-nav-label">
              {isAdmin ? 'Configuración & Auditoría' : 'Configuración de Clave'}
            </span>
          </button>

          <button
            type="button"
            className="drawer-nav-item"
            onClick={onToggleTheme}
          >
            <span className="drawer-nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="drawer-nav-label">
              {theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            </span>
          </button>
        </nav>

        {/* Pie del Drawer: Cerrar Sesión */}
        <footer className="drawer-footer">
          <button
            type="button"
            className="drawer-logout-btn"
            onClick={handleLogoutClick}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            <span>Cerrar sesión</span>
          </button>

          <div className="drawer-footer-version">
            <span>PagoCheck Cloud POS · v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default NavigationDrawer
