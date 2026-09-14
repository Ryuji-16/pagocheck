import { formatBranchDisplayName } from '../utils/formatters'
import './css/Menu.css'

function Menu({ username, label, branch, role, onOpenVerify, onOpenVuelto, onOpenMovements }) {
  const isAdmin = role === 'admin' || role === 'admin_sucursal' || role === 'admin_tienda'
  const branchDisplayName = formatBranchDisplayName(branch)

  return (
    <section className="menu-screen">
      <h1>Menú</h1>
      <p>
        Hola, {label || username}
        {branchDisplayName ? <span> · {branchDisplayName}</span> : ''}. ¿Qué quieres hacer?
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
    </section>
  )
}

export default Menu
