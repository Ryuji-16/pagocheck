import './css/VerificationMethod.css'

function VerificationMethod({ onSelect }) {
  return (
    <div className="verification-overlay">
      <div className="verification-method">

        <div className="upload-icon">
          🔍
        </div>

        <h2>¿Cómo deseas verificar el pago?</h2>

        <p>
          Selecciona el método que deseas utilizar.
        </p>

        <div className="verification-method-options">

          <button
            type="button"
            className="verification-method-card"
            onClick={() => onSelect('image')}
          >
            <div className="method-icon">
              📷
            </div>

            <h3>Comprobante</h3>

            <p>
              Sube o pega una captura del comprobante
              de pago.
            </p>

            <span className="method-arrow">
              →
            </span>
          </button>

          <button
            type="button"
            className="verification-method-card"
            onClick={() => onSelect('manual')}
          >
            <div className="method-icon">
              ✏️
            </div>

            <h3>Datos manuales</h3>

            <p>
              Introduce los datos de la operación
              manualmente.
            </p>

            <span className="method-arrow">
              →
            </span>
          </button>

        </div>

      </div>
    </div>
  )
}

export default VerificationMethod