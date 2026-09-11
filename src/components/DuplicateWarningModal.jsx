import { formatMovementDate } from '../utils/formatters'
import './css/DuplicateWarningModal.css'

function DuplicateWarningModal({ duplicate, onReview, onProceed }) {
  if (!duplicate) return null

  const displayDate = duplicate.at
    ? formatMovementDate(duplicate.at)
    : 'Fecha no disponible'

  const terminalName = duplicate.label || duplicate.username || 'Caja'

  return (
    <div className="duplicate-overlay" role="alertdialog" aria-modal="true">
      <div className="duplicate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="duplicate-icon-box">⚠️</div>

        <h2>Posible Pago Duplicado</h2>
        <p className="duplicate-subtitle">
          Esta referencia ya fue registrada anteriormente en el sistema.
        </p>

        <div className="duplicate-info-card">
          <div className="duplicate-info-row">
            <span className="duplicate-info-label">Referencia</span>
            <span className="duplicate-info-val duplicate-info-ref">
              #{duplicate.reference}
            </span>
          </div>

          {duplicate.amount && (
            <div className="duplicate-info-row">
              <span className="duplicate-info-label">Monto previo</span>
              <span className="duplicate-info-val">{duplicate.amount}</span>
            </div>
          )}

          {duplicate.bank && (
            <div className="duplicate-info-row">
              <span className="duplicate-info-label">Banco</span>
              <span className="duplicate-info-val">{duplicate.bank}</span>
            </div>
          )}

          <div className="duplicate-info-row">
            <span className="duplicate-info-label">Registrado en</span>
            <span className="duplicate-info-val">{terminalName}</span>
          </div>

          <div className="duplicate-info-row">
            <span className="duplicate-info-label">Fecha / Hora</span>
            <span className="duplicate-info-val">{displayDate}</span>
          </div>
        </div>

        <div className="duplicate-warning-notice">
          Si se trata de una reoperación legítima o ajuste puedes continuar. De lo contrario, revisa el comprobante o consulta con tu encargado.
        </div>

        <div className="duplicate-actions">
          <button
            type="button"
            className="dup-btn-review"
            onClick={onReview}
          >
            ← Revisar datos
          </button>

          <button
            type="button"
            className="dup-btn-proceed"
            onClick={onProceed}
          >
            Continuar de todos modos
          </button>
        </div>
      </div>
    </div>
  )
}

export default DuplicateWarningModal
