import './css/Menu.css'

function Menu({ username, label, branch, role, onOpenVerify, onOpenVuelto, onOpenMovements, onOpenSettings, onLogout }) {
  const isAdmin = role === 'admin' || role === 'admin_sucursal' || role === 'admin_tienda'

  return (
    <section className="menu-screen">
      <h1>Menú</h1>
      <p>
        Hola, {label || username}
        {branch ? <span> · 📍 {branch}</span> : ''}. ¿Qué quieres hacer?
      </p>

      <div className="menu-grid">
        <button type="button" className="menu-card" onClick={onOpenVerify}>
          <span className="menu-icon">✓</span>
          <strong>Validar pago</strong>
          <span>Comprueba un pago móvil o transferencia.</span>
        </button>

        <button type="button" className="menu-card" onClick={onOpenVuelto}>
          <span className="menu-icon">⇄</span>
          <strong>Dar vuelto</strong>
          <span>Emite vueltos de forma rápida y genera comprobante.</span>
        </button>

        <button type="button" className="menu-card" onClick={onOpenMovements}>
          <span className="menu-icon">☰</span>
          <strong>Movimientos</strong>
          <span>
            {isAdmin
              ? 'Consulta el historial consolidado de operaciones.'
              : 'Revisa validaciones y vueltos de esta caja.'}
          </span>
        </button>
      </div>

      <div className="menu-toolbar">
        <button type="button" className="menu-settings" onClick={onOpenSettings}>
          {isAdmin ? '⚙️ Panel de Administración y Auditoría' : '⚙️ Configuración y Clave'}
        </button>
        <button type="button" className="menu-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </section>
  )
}

export default Menu
