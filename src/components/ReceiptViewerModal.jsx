import { useEffect, useState } from 'react'
import {
  getBankInfo,
  formatMovementDate,
  formatBs
} from '../utils/formatters'
import { resolveReceiptUrl } from '../services/storageService.js'
import './css/ReceiptViewerModal.css'

function ReceiptViewerModal({ item, onClose }) {
  const rawImage = item?.receipt_image || ''
  const isDirectImage =
    rawImage.startsWith('data:') ||
    rawImage.startsWith('http://') ||
    rawImage.startsWith('https://') ||
    rawImage.startsWith('blob:')
  const needsFetch = Boolean(rawImage && rawImage !== 'purged' && !isDirectImage)

  const [remoteUrl, setRemoteUrl] = useState('')
  const [isLoadingRemote, setIsLoadingRemote] = useState(needsFetch)

  useEffect(() => {
    if (!needsFetch) return

    let isMounted = true

    resolveReceiptUrl(rawImage)
      .then((url) => {
        if (isMounted) {
          setRemoteUrl(url)
          setIsLoadingRemote(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingRemote(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [needsFetch, rawImage])

  const resolvedUrl = isDirectImage ? rawImage : remoteUrl
  const isLoadingUrl = needsFetch && isLoadingRemote

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

  const isPurged = item.receipt_image === 'purged'
  const bankInfo = getBankInfo(item.bank)
  const rawDate = item.at || item.created_at || item.date || item.timestamp
  const displayDate = formatMovementDate(rawDate)
  const displayAmount = formatBs(item.amount)
  const terminalName = item.label || item.username || 'Caja'
  const branchName = item.branch || 'Principal'

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
              <span>{isPurged ? '📄' : '👁️'}</span>{' '}
              {isPurged ? 'Comprobante Auditado' : 'Comprobante Original'}
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
          {isPurged ? (
            <div className="receipt-purged-card" role="status">
              <p className="receipt-purged-text">
                ℹ️ Comprobante archivado en texto. La captura de imagen fue purgada automáticamente tras 7 días para optimizar el almacenamiento, pero todos los datos de auditoría se conservan en el sistema.
              </p>
            </div>
          ) : isLoadingUrl ? (
            <div className="receipt-viewer-empty" role="status">
              ⏳ Obteniendo comprobante seguro...
            </div>
          ) : resolvedUrl ? (
            <div className="receipt-viewer-img-container">
              <img
                src={resolvedUrl}
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
              <span className="receipt-viewer-meta-label">Fecha</span>
              <span className="receipt-viewer-meta-value">
                {displayDate}
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Sucursal</span>
              <span className="receipt-viewer-meta-value">
                {branchName}
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Caja</span>
              <span className="receipt-viewer-meta-value">
                {terminalName}
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Teléfono</span>
              <span className="receipt-viewer-meta-value">
                {item.phone || '-'}
              </span>
            </div>

            <div className="receipt-viewer-meta-item">
              <span className="receipt-viewer-meta-label">Cédula</span>
              <span className="receipt-viewer-meta-value">
                {item.cedula || '-'}
              </span>
            </div>

            {item.status && (
              <div className="receipt-viewer-meta-item">
                <span className="receipt-viewer-meta-label">Estado</span>
                <span className="receipt-viewer-meta-value">
                  {item.status}
                </span>
              </div>
            )}

            {item.note && (
              <div className="receipt-viewer-meta-item">
                <span className="receipt-viewer-meta-label">Nota</span>
                <span className="receipt-viewer-meta-value">
                  {item.note}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="receipt-viewer-footer">
          {resolvedUrl && !isPurged && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="receipt-viewer-open-btn"
              title="Abrir imagen completa en nueva pestaña"
            >
              🔍 Ver tamaño completo
            </a>
          )}
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
