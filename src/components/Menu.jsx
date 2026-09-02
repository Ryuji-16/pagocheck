import './css/Menu.css'

function Menu({ username, onOpenVerify, onOpenVuelto, onOpenSettings, onLogout }) {
  return (
    <section className="menu-screen">
      <h1>Menú</h1>
      <p>Hola, {username}. ¿Qué quieres hacer?</p>

      <div className="menu-grid">
        <button type="button" className="menu-card" onClick={onOpenVerify}>
          <span className="menu-icon">✓</span>
          <strong>Validar pago</strong>
          <span>Comprueba un pago móvil o transferencia.</span>
        </button>

        <button type="button" className="menu-card" onClick={onOpenVuelto}>
          <span className="menu-icon">⇄</span>
          <strong>Dar vuelto</strong>
          <span>Envía vuelto por pago móvil. Simulación por ahora.</span>
        </button>
      </div>

      <div className="menu-toolbar">
        <button type="button" className="menu-settings" onClick={onOpenSettings}>
          ⚙ Cambiar clave
        </button>
        <button type="button" className="menu-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </section>
  )
}

export default Menu
