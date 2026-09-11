import { useEffect } from 'react'
import {
  getBankInfo,
  formatMovementDate,
  formatBs
} from '../utils/formatters'
import './css/ReceiptViewerModal.css'

function ReceiptViewerModal({ item, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!item) return null

  const bankInfo = getBankInfo(item.bank)
  const rawDate = item.at || item.created_at || item.date || item.timestamp
  const displayDate = formatMovementDate(rawDate)
  const displayAmount = formatBs(item.amount)
  const terminalName = item.label || item.username || 'Caja'

  return (
    <div
      className="receipt-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="receipt-viewer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="receipt-viewer-header">
          <div className="receipt-viewer-title-group">
            <h3>
              <span>👁️</span> Comprobante Original
            </h3>
            <span className="receipt-viewer-subtitle">
              Ref #{item.reference || '-'} • {displayDate}
            </span>
          </div>

          <button
            type="button"
            className="receipt-viewer-close-btn"
            onClick={onClose}
            aria-label="Cerrar visor de comprobante"
          >
            ✕
          </button>
        </div>

        <div className="receipt-viewer-body">
          {item.receipt_image ? (
            <div className="receipt-viewer-img-container">
              <img
                src={item.receipt_image}
                alt={`Comprobante de referencia ${item.reference || 'pago móvil'}`}
                className="receipt-viewer-img"
              />
            </div>
          ) : (
            <div className="receipt-viewer-empty">
              No hay imagen disponible para este comprobante.
            </div>
          )}

          <div className="receipt-viewer-meta-grid">
            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Monto</span>
              <span className="receipt-viewer-meta-value meta-value-highlight">
                {displayAmount}
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Referencia</span>
              <span className="receipt-viewer-meta-value meta-value-mono">
                {item.reference || '-'}
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Banco</span>
              <span className="receipt-viewer-meta-value">
                {bankInfo.name} ({bankInfo.code})
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Caja</span>
              <span className="receipt-viewer-meta-value">
                {terminalName}
              </span>
            </div>

            {item.phone && (
              <div className="receipt-viewer-meta-item">
                <span className="receipt-viewer-meta-label">Teléfono</span>
                <span className="receipt-viewer-meta-value">
                  {item.phone}
                </span>
              </div>
            )}

            {item.status && (
              <div className="receipt-viewer-meta-item">
                <span className="receipt-viewer-meta-label">Estado</span>
                <span className="receipt-viewer-meta-value">
                  {item.status}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="receipt-viewer-footer">
          <button
            type="button"
            className="receipt-viewer-done-btn"
            onClick={onClose}
          >
            Cerrar visor
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReceiptViewerModal
