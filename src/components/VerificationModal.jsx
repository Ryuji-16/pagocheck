import './css/VerificationModal.css'

function VerificationModal({ result, onClose }) {

  const resultConfig = {
    confirmed: {
      icon: '✓',
      title: 'Pago verificado',
      message: 'El pago fue recibido correctamente.',
      statusText: 'Confirmado',
      iconClass: 'confirmed'
    },

    'not-found': {
      icon: '✕',
      title: 'Pago no encontrado',
      message:
        result.message ||
        'No encontramos una transacción que coincida con los datos proporcionados.',
      statusText: 'No encontrado',
      iconClass: 'not-found'
    },

    error: {
      icon: '!',
      title: 'Error al verificar',
      message:
        result.message ||
        'Ocurrió un problema al intentar verificar el pago.',
      statusText: 'Error',
      iconClass: 'error'
    }
  }

  const config =
    resultConfig[result.status] ||
    resultConfig.error

  const isConfirmed = result.status === 'confirmed'

  const isNotFound = result.status === 'not-found'

  const buttonText =
  isConfirmed
    ? 'Nueva verificación'
    : isNotFound
      ? 'Intentar nuevamente'
      : 'Reintentar'

  return (
    <div className="result-overlay">
      <div className="result-modal">

        <button
          type="button"
          className="result-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>

        <div
          className={`result-icon ${config.iconClass}`}
        >
          {config.icon}
        </div>

        <h2>
          {config.title}
        </h2>

        <p className="result-message">
          {config.message}
        </p>

        <div className="result-details">

          <div className="result-detail">
            <span>Estado</span>

            <strong
              className={`result-status ${config.iconClass}`}
            >
              {config.statusText}
            </strong>
          </div>


          {/* =============================================
              PAGO CONFIRMADO
              ============================================= */}

          {isConfirmed && (
            <>
              {result.amount && (
                <div className="result-detail">
                  <span>Monto recibido</span>
                  <strong>{result.amount}</strong>
                </div>
              )}

              {result.reference && (
                <div className="result-detail">
                  <span>Referencia</span>
                  <strong>{result.reference}</strong>
                </div>
              )}

              {result.date && (
                <div className="result-detail">
                  <span>Fecha</span>
                  <strong>{result.date}</strong>
                </div>
              )}

              {result.bank && (
                <div className="result-detail">
                  <span>Banco</span>
                  <strong>{result.bank}</strong>
                </div>
              )}

              {result.phone &&
                result.phone !== 'No disponible' && (
                  <div className="result-detail">
                    <span>Teléfono</span>
                    <strong>{result.phone}</strong>
                  </div>
                )}
            </>
          )}


          {/* =============================================
              PAGO NO ENCONTRADO
              ============================================= */}

          {isNotFound && (
            <>
              <div className="result-search-info">
                <span>
                  Datos utilizados para la búsqueda
                </span>
              </div>

              {result.reference && (
                <div className="result-detail">
                  <span>Referencia consultada</span>
                  <strong>{result.reference}</strong>
                </div>
              )}

              {result.date && (
                <div className="result-detail">
                  <span>Fecha consultada</span>
                  <strong>{result.date}</strong>
                </div>
              )}

              {result.bank && (
                <div className="result-detail">
                  <span>Banco consultado</span>
                  <strong>{result.bank}</strong>
                </div>
              )}

              {result.phone &&
                result.phone !== 'No disponible' && (
                  <div className="result-detail">
                    <span>Teléfono consultado</span>
                    <strong>{result.phone}</strong>
                  </div>
                )}
            </>
          )}


          {/* =============================================
              ERROR
              ============================================= */}

          {result.status === 'error' && (
            <div className="result-error-info">
              <span>
                No se pudo completar la consulta. Verifica tu conexión e inténtalo nuevamente.
              </span>
            </div>
          )}

        </div>

        <button
          type="button"
          className={`result-button ${config.iconClass}`}
          onClick={onClose}
        >
          {buttonText}
        </button>

        <p className="result-demo-note">
          Resultado de prueba. Aún no se consulta un banco real.
        </p>

      </div>
    </div>
  )
}

export default VerificationModal