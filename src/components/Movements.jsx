import { useEffect, useMemo, useState } from 'react'
import { listMovements } from '../services/historyService'
import { exportMovementsToExcel } from '../services/exportService'
import MovementsFilter from './MovementsFilter'
import './css/Movements.css'

function statusLabel(status) {
  if (status === 'confirmed') return 'Confirmado'
  if (status === 'not-found') return 'No encontrado'
  if (status === 'error') return 'Error'
  if (status === 'simulado') return 'Simulado'
  return status || ''
}

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

const INITIAL_FILTERS = {
  caja: '',
  type: '',
  status: '',
  search: ''
}

function Movements({ session, onBack }) {
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [exporting, setExporting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    let cancelled = false
    listMovements(session).then((rows) => {
      if (!cancelled) setItems(rows)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  const cajasOptions = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const key = item.username || item.label
      if (key && !map.has(key)) {
        map.set(key, item.label || item.username)
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [items])

  const filteredItems = useMemo(() => {
    if (!isAdmin) return items

    return items.filter((item) => {
      if (filters.caja) {
        const itemKey = item.username || item.label
        if (itemKey !== filters.caja) return false
      }

      if (filters.type && item.type !== filters.type) {
        return false
      }

      if (filters.status && item.status !== filters.status) {
        return false
      }

      if (filters.search) {
        const query = filters.search.trim().toLowerCase()
        const text = [
          item.label,
          item.username,
          item.reference,
          item.phone,
          item.bank,
          item.cedula,
          item.note
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!text.includes(query)) return false
      }

      return true
    })
  }, [items, isAdmin, filters])

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleResetFilters() {
    setFilters(INITIAL_FILTERS)
  }

  async function handleExport() {
    if (filteredItems.length === 0) {
      setFeedback({ type: 'error', text: 'No hay validaciones ni vueltos para exportar con los filtros seleccionados.' })
      return
    }

    setExporting(true)
    setFeedback(null)

    try {
      const result = await exportMovementsToExcel(filteredItems, { onlyToday: true })
      const valids = result.validacionesCount ?? 0
      const vueltos = result.vueltosCount ?? 0
      const cajasCount = result.sheetsCount ?? 1
      const totalRecords = result.totalRecords ?? (valids + vueltos)

      let detail = ''
      if (valids > 0 && vueltos > 0) {
        detail = `${valids} validación${valids > 1 ? 'es' : ''} y ${vueltos} vuelto${vueltos > 1 ? 's' : ''}`
      } else if (valids > 0) {
        detail = `${valids} validación${valids > 1 ? 'es' : ''}`
      } else if (vueltos > 0) {
        detail = `${vueltos} vuelto${vueltos > 1 ? 's' : ''}`
      } else {
        detail = `${totalRecords} registro${totalRecords > 1 ? 's' : ''}`
      }

      setFeedback({
        type: 'success',
        text: `Excel descargado con éxito: ${detail} del día de hoy en ${cajasCount} caja${cajasCount > 1 ? 's' : ''}.`
      })
    } catch (err) {
      console.error('Error al exportar movimientos:', err)
      setFeedback({
        type: 'error',
        text: err.message || 'Ocurrió un error al generar el archivo Excel.'
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="movements-screen">
      <button type="button" className="modal-back-button" onClick={onBack}>
        ← Menú
      </button>

      <div className="movements-header">
        <div className="movements-header-text">
          <h1>Movimientos</h1>
          <p>
            {isAdmin
              ? 'Admin: ves las cajas conectadas a la misma base.'
              : `Solo ves lo hecho por ${session.label || session.username}.`}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="movements-export-button"
            onClick={handleExport}
            disabled={exporting || items.length === 0}
            title="Exportar a Excel los movimientos del día organizados por caja"
          >
            <span>📊</span> {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </button>
        )}
      </div>

      {feedback && (
        <div className={`movements-feedback ${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      {isAdmin && (
        <MovementsFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          cajas={cajasOptions}
          filteredCount={filteredItems.length}
          totalCount={items.length}
        />
      )}

      {items.length === 0 ? (
        <p className="movements-empty">Aún no hay movimientos en este navegador.</p>
      ) : filteredItems.length === 0 ? (
        <p className="movements-empty">No se encontraron movimientos con los filtros aplicados.</p>
      ) : (
        <ul className="movements-list">
          {filteredItems.map((item) => (
            <li key={item.id} className={`movements-item ${item.status}`}>
              <div>
                <strong>
                  {item.type === 'vuelto' ? 'Vuelto' : 'Validación'}
                </strong>
                <span>{formatWhen(item.at)}</span>
              </div>
              <p>
                {item.label} · {statusLabel(item.status)}
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
