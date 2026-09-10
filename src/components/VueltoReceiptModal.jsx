import { useState } from 'react'
import './css/VueltoReceiptModal.css'

function VueltoReceiptModal({ receipt, onClose, onNewVuelto }) {
  const [copied, setCopied] = useState(false)

  if (!receipt) return null

  const shareText = [
    '✓ COMPROBANTE DE VUELTO PAGOCHECK',
    `Monto: ${receipt.amountBs}${receipt.amountUsd ? ` ($${receipt.amountUsd} USD)` : ''}`,
    `Banco destino: ${receipt.bank}`,
    `Beneficiario: ${receipt.cedula}`,
    `Teléfono: ${receipt.phone}`,
    receipt.concept ? `Concepto: ${receipt.concept}` : null,
    `Referencia: ${receipt.reference}`,
    `Fecha: ${receipt.date}`,
    'Estado: Procesado exitosamente'
  ]
    .filter(Boolean)
    .join('\n')

  async function handleCopy() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText)
      } else {
        const ta = document.createElement('textarea')
        ta.value = shareText
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="receipt-overlay" onClick={onClose}>
      <div
        className="receipt-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="receipt-close"
          onClick={onClose}
          aria-label="Cerrar comprobante"
        >
          ×
        </button>

        <div className="receipt-icon-box">✓</div>

        <h2>Comprobante de Vuelto</h2>
        <p className="receipt-subtitle">
          Pago móvil registrado exitosamente en el sistema.
        </p>

        <div className="receipt-amount-card">
          <span className="receipt-amount-label">Monto Enviado</span>
          <span className="receipt-amount-main">{receipt.amountBs}</span>
          {receipt.amountUsd && (
            <span className="receipt-amount-usd">≈ ${receipt.amountUsd} USD</span>
          )}
        </div>

        <div className="receipt-details-list">
          <div className="receipt-detail-item">
            <span className="receipt-detail-label">Banco Destino</span>
            <span className="receipt-detail-value">{receipt.bank}</span>
          </div>

          <div className="receipt-detail-item">
            <span className="receipt-detail-label">Cédula / Documento</span>
            <span className="receipt-detail-value">{receipt.cedula}</span>
          </div>

          <div className="receipt-detail-item">
            <span className="receipt-detail-label">Teléfono</span>
            <span className="receipt-detail-value">{receipt.phone}</span>
          </div>

          {receipt.concept && (
            <div className="receipt-detail-item">
              <span className="receipt-detail-label">Concepto</span>
              <span className="receipt-detail-value">{receipt.concept}</span>
            </div>
          )}

          <div className="receipt-detail-item">
            <span className="receipt-detail-label">Referencia</span>
            <span className="receipt-detail-value receipt-reference-code">
              {receipt.reference}
            </span>
          </div>

          <div className="receipt-detail-item">
            <span className="receipt-detail-label">Fecha y Hora</span>
            <span className="receipt-detail-value">{receipt.date}</span>
          </div>

          <div className="receipt-detail-item">
            <span className="receipt-detail-label">Estado</span>
            <span className="receipt-status-badge">Confirmado</span>
          </div>
        </div>

        <div className="receipt-actions">
          <button
            type="button"
            className={`receipt-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? '¡Comprobante copiado!' : 'Copiar comprobante'}</span>
          </button>

          <div className="receipt-secondary-actions">
            <button
              type="button"
              className="receipt-secondary-btn"
              onClick={onNewVuelto}
            >
              ⇄ Nuevo vuelto
            </button>
            <button
              type="button"
              className="receipt-secondary-btn"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VueltoReceiptModal
