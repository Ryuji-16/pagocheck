import { listMovements } from '../services/historyService'
import './css/Movements.css'

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return value
  }
}

function Movements({ session, onBack }) {
  const items = listMovements(session)

  return (
    <section className="movements-screen">
      <button type="button" className="modal-back-button" onClick={onBack}>
        ← Menú
      </button>

      <h1>Movimientos</h1>
      <p>
        {session.role === 'admin'
          ? 'Admin: ves las cajas de este dispositivo.'
          : `Solo ves lo hecho por ${session.label || session.username}.`}
      </p>

      {items.length === 0 ? (
        <p className="movements-empty">Aún no hay movimientos en este navegador.</p>
      ) : (
        <ul className="movements-list">
          {items.map((item) => (
            <li key={item.id} className={`movements-item ${item.status}`}>
              <div>
                <strong>
                  {item.type === 'vuelto' ? 'Vuelto' : 'Validación'}
                </strong>
                <span>{formatWhen(item.at)}</span>
              </div>
              <p>
                {item.label} · {item.status}
                {item.amount ? ` · ${item.amount}` : ''}
              </p>
              <p>
                {[item.bank, item.phone, item.reference, item.cedula]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Movements
