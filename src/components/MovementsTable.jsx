import { useState } from 'react'
import {
  getBankInfo,
  formatMovementDate,
  formatRelativeTime,
  formatBs,
  formatPhoneOrDetail
} from '../utils/formatters'

function statusConfig(status) {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmado', className: 'status-confirmed' }
    case 'simulado':
      return { label: 'Simulado', className: 'status-simulado' }
    case 'not-found':
      return { label: 'No encontrado', className: 'status-not-found' }
    case 'error':
      return { label: 'Error', className: 'status-error' }
    default:
      return { label: status || 'Pendiente', className: 'status-default' }
  }
}

function MovementsTable({
  items = [],
  sortField,
  sortOrder,
  onSortChange,
  onViewReceipt,
  emptyMessage = 'No hay movimientos para mostrar.'
}) {
  const [copiedId, setCopiedId] = useState(null)

  function handleCopyReference(ref, id) {
    if (!ref || ref === '-') return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ref)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    }
  }

  function handleSort(field) {
    if (onSortChange) {
      onSortChange(field)
    }
  }

  function renderSortIndicator(field) {
    if (sortField !== field) {
      return <span className="sort-icon inactive">⇅</span>
    }
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  if (items.length === 0) {
    return (
      <div className="movements-table-empty">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="movements-table-card">
      <div className="movements-table-scroll">
        <table className="movements-data-table">
          <thead>
            <tr>
              <th className="th-tipo">TIPO</th>
              <th className="th-caja">CAJA / TERMINAL</th>
              <th className="th-banco">BANCO / ENTIDAD</th>
              <th className="th-detalle">TELÉFONO / DETALLE</th>
              <th
                className="th-fecha sortable"
                onClick={() => handleSort('date')}
                title="Ordenar por fecha"
              >
                <span>FECHA</span>
                {renderSortIndicator('date')}
              </th>
              <th
                className="th-monto sortable"
                onClick={() => handleSort('amount')}
                title="Ordenar por monto"
              >
                <span>MONTO</span>
                {renderSortIndicator('amount')}
              </th>
              <th className="th-estado">ESTADO</th>
              <th className="th-referencia">REFERENCIA</th>
              <th className="th-recibo">RECIBO</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isVal = item.type === 'validacion'
              const bankInfo = getBankInfo(item.bank)
              const statusInfo = statusConfig(item.status)
              const rawDate = item.at || item.created_at || item.date || item.timestamp
              const displayDate = formatMovementDate(rawDate)
              const relTime = formatRelativeTime(rawDate)
              const displayPhone = formatPhoneOrDetail(item.phone, item.cedula, item.note)
              const displayAmount = formatBs(item.amount)
              const refNumber = item.reference || '-'
              const isCopied = copiedId === item.id

              return (
                <tr key={item.id} className="movements-row">
                  {/* TIPO */}
                  <td className="td-tipo">
                    <div className="type-badge-container">
                      <span className={`type-circle ${isVal ? 'val' : 'vuelto'}`}>
                        {isVal ? '✓' : '⇄'}
                      </span>
                      <span className="type-label">
                        {isVal ? 'Validación' : 'Vuelto'}
                      </span>
                    </div>
                  </td>

                  {/* CAJA / TERMINAL */}
                  <td className="td-caja">
                    <span className="terminal-pill">
                      {item.label || item.username || 'Caja'}
                    </span>
                  </td>

                  {/* BANCO / ENTIDAD */}
                  <td className="td-banco">
                    <div className="bank-info-cell">
                      <span className="bank-name">{bankInfo.name}</span>
                      <span className="bank-code">{bankInfo.code}</span>
                    </div>
                  </td>

                  {/* TELÉFONO / DETALLE */}
                  <td className="td-detalle">
                    <span className="detail-text">{displayPhone}</span>
                  </td>

                  {/* FECHA */}
                  <td className="td-fecha">
                    <div className="date-info-cell">
                      <span className="date-primary">{displayDate}</span>
                      {relTime && <span className="date-relative">{relTime}</span>}
                    </div>
                  </td>

                  {/* MONTO */}
                  <td className="td-monto">
                    <span className="amount-bold">{displayAmount}</span>
                  </td>

                  {/* ESTADO */}
                  <td className="td-estado">
                    <span className={`status-pill ${statusInfo.className}`}>
                      <span className="status-dot" />
                      {statusInfo.label}
                    </span>
                  </td>

                  {/* REFERENCIA (Sustituye a Acciones) */}
                  <td className="td-referencia">
                    <button
                      type="button"
                      className={`reference-cell-btn ${isCopied ? 'copied' : ''}`}
                      onClick={() => handleCopyReference(refNumber, item.id)}
                      title="Copiar número de referencia"
                    >
                      <span className="ref-number">{refNumber}</span>
                      {refNumber !== '-' && (
                        <span className="ref-icon">
                          {isCopied ? '✓' : '📋'}
                        </span>
                      )}
                    </button>
                  </td>

                  {/* RECIBO AUDITADO (El "Ojo") */}
                  <td className="td-recibo">
                    {item.receipt_image ? (
                      <button
                        type="button"
                        className="receipt-eye-btn"
                        onClick={() => onViewReceipt && onViewReceipt(item)}
                        title="Ver comprobante original"
                        aria-label={`Ver comprobante original de referencia ${refNumber}`}
                      >
                        👁️
                      </button>
                    ) : (
                      <span className="no-receipt-dash">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MovementsTable
