import { useEffect, useState } from 'react'
import VerificationModal from './VerificationModal'
import VerificationMethod from './VerificationMethod'
import ManualVerification from './ManualVerification'
import { verifyPayment } from "../services/verificationService";
import { extractPaymentData } from "../services/ocrService";
import './css/UploadZone.css'
import './css/Modals.css'

function UploadZone() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verificationMethod, setVerificationMethod] = useState(null)
  const [ocrData, setOcrData] = useState(null)
  const [extractError, setExtractError] = useState('')

  useEffect(() => {
    const formOpen =
      verificationMethod === 'image' || verificationMethod === 'manual'

    document.body.classList.toggle('form-open', formOpen)

    return () => {
      document.body.classList.remove('form-open')
    }
  }, [verificationMethod])

  function handleFile(selectedFile) {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setVerificationResult(null)
      setOcrData(null)
      setExtractError('')
    }
  }

  /*
   * Pegar imagen con Ctrl + V
   */
  useEffect(() => {
    function handleGlobalPaste(event) {
      if (verificationMethod !== 'image') return

      const items = event.clipboardData?.items

      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const pastedFile = item.getAsFile()

          if (pastedFile) {
            handleFile(pastedFile)
            event.preventDefault()
          }

          break
        }
      }
    }

    document.addEventListener('paste', handleGlobalPaste)

    return () => {
      document.removeEventListener('paste', handleGlobalPaste)
    }
  }, [verificationMethod])

  function handleFileChange(event) {
    const selectedFile = event.target.files[0]
    handleFile(selectedFile)
  }

  function handleChangeFile() {
    document.getElementById('file-upload')?.click()
  }

  async function handleVerify(data = {}) {
  setIsVerifying(true)
  setVerificationResult(null)

  try {
    const result = await verifyPayment(data)

    setVerificationResult(result)
  } catch (error) {
    console.error('Error al verificar el pago:', error)

    setVerificationResult({
      status: 'error',
      message: 'No se pudo completar la verificación.'
    })
  } finally {
    setIsVerifying(false)
  }
}

  async function handlePasteButton() {
  try {
    if (!navigator.clipboard?.read) {
      alert(
        'Tu navegador no permite acceder directamente a las imágenes del portapapeles.\n\n' +
        'Usa Ctrl + V para pegar la captura.'
      )
      return
    }

    const clipboardItems = await navigator.clipboard.read()

    for (const item of clipboardItems) {
      const imageType = item.types.find((type) =>
        type.startsWith('image/')
      )

      if (imageType) {
        const blob = await item.getType(imageType)

        const pastedFile = new File(
          [blob],
          'comprobante.png',
          {
            type: imageType
          }
        )

        handleFile(pastedFile)
        return
      }
    }

    alert(
      'No se detectó ninguna imagen en el portapapeles.\n\n' +
      'Si acabas de copiar una captura, intenta pegarla directamente con Ctrl + V.'
    )

  } catch (error) {
    console.error('No se pudo acceder al portapapeles:', error)

    alert(
      'Tu navegador bloqueó el acceso directo al portapapeles.\n\n' +
      'Puedes pegar la imagen usando Ctrl + V.'
    )
  }
}

  function handleDragOver(event) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)

    const droppedFile = event.dataTransfer.files[0]

    handleFile(droppedFile)
  }

  function handleBackToMethods() {
    setVerificationMethod(null)
    setFile(null)
    setPreview(null)
    setVerificationResult(null)
    setOcrData(null)
    setExtractError('')
  }

  const fieldLabels = {
    reference: 'referencia',
    date: 'fecha',
    phone: 'teléfono',
    bank: 'banco',
    amount: 'monto'
  }

  async function handleAnalyzeReceipt() {
    try {
      setIsVerifying(true)
      setVerificationResult(null)
      setExtractError('')

      const extractedData = await extractPaymentData(file)
      setOcrData(extractedData)

      const requiredFields = ['reference', 'date', 'bank']
      const missingFields = requiredFields.filter((field) => {
        const value = extractedData[field]
        return !value || value.toString().trim() === ''
      })

      if (missingFields.length > 0) {
        const readable = missingFields
          .map((field) => fieldLabels[field] || field)
          .join(', ')

        setExtractError(
          `No se pudieron leer estos datos del comprobante: ${readable}. Prueba con otra captura o usa datos manuales.`
        )
        return
      }

      const result = await verifyPayment(extractedData)
      setVerificationResult(result)
    } catch (error) {
      console.error('Error al procesar el comprobante:', error)
      setVerificationResult({
        status: 'error',
        message: 'No se pudo analizar el comprobante.'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  function handleCloseResult() {
  const status = verificationResult?.status

  setVerificationResult(null)
  setIsVerifying(false)

  if (
    status === 'confirmed' ||
    status === 'duplicate'
  ) {
    setVerificationMethod(null)
    setFile(null)
    setPreview(null)
  }
}

  return (
    <section
      className={`upload-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* SELECCIÓN DE MÉTODO */}
      {verificationMethod === null && (
        <VerificationMethod
          onSelect={(method) => {
            setVerificationMethod(method)
          }}
        />
      )}

      {/* MODAL — COMPROBANTE */}
      {verificationMethod === 'image' && !verificationResult && !isVerifying && (
        <div className="modal-overlay">
          <div className="modal">

            <button
              type="button"
              className="modal-back-button"
              onClick={handleBackToMethods}
            >
              ← Cambiar método
            </button>

            <div className="modal-header">
              <div className="modal-icon">
                📄
              </div>

              <h2 className="modal-title">
                {preview
                  ? 'Comprobante cargado'
                  : 'Sube tu comprobante'}
              </h2>

              <p className="modal-description">
                {preview
                  ? 'Revisa la imagen antes de continuar'
                  : 'Arrastra una captura aquí o selecciona una imagen'}
              </p>
            </div>

            <input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              hidden
            />

            {/* SIN IMAGEN */}
            {!preview && (
              <div
                className={`upload-drop-area ${
                  isDragging ? 'dragging' : ''
                }`}
              >

                <div className="upload-drop-icon">
                  📄
                </div>

                <h3>
                  Arrastra tu comprobante aquí
                </h3>

                <p>
                  También puedes seleccionar una imagen o pegarla
                  desde el portapapeles
                </p>

                <div className="upload-actions">
                  <label
                    htmlFor="file-upload"
                    className="upload-button"
                  >
                    Seleccionar archivo
                  </label>

                  <button
                    type="button"
                    onClick={handlePasteButton}
                    className="paste-button"
                  >
                    📋 Pegar
                  </button>
                </div>

                <span className="upload-shortcut">
                  También puedes usar <strong>Ctrl + V</strong>
                </span>

              </div>
            )}

            {/* IMAGEN CARGADA */}
            {preview && (
              <div className="preview-container">

                <div className="preview-image">
                  <img
                    src={preview}
                    alt="Vista previa del comprobante"
                  />
                </div>

                {file && (
                  <p className="file-name">
                    {file.name}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleChangeFile}
                  className="change-button"
                >
                  ↻ Cambiar imagen
                </button>

                {extractError && (
                  <p className="form-error">{extractError}</p>
                )}

                <button
                  type="button"
                  className="verify-button"
                  onClick={handleAnalyzeReceipt}
                  disabled={isVerifying}
                >
                  {isVerifying
                    ? '🔄 Analizando comprobante...'
                    : '✓ Verificar pago'}
                </button>

              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL — DATOS MANUALES */}
      {verificationMethod === 'manual' && !verificationResult && !isVerifying && (
        <div className="modal-overlay">
          <div className="modal manual-modal">

            <ManualVerification
              onBack={handleBackToMethods}
              onVerify={(data) => {
                console.log('Datos manuales:', data)
                handleVerify(data)
              }}
              isVerifying={isVerifying}
            />

          </div>
        </div>
      )}

      {/* RESULTADO DE VERIFICACIÓN */}
      {verificationResult && (
        <VerificationModal
          result={verificationResult}
          onClose={handleCloseResult}
        />
      )}

      {/* CARGANDO */}
      {isVerifying && (
        <div className="verification-loading-overlay">
          <div className="verification-loading">

            <div className="loading-logo">
              PagoCheck
            </div>

            <div className="loading-spinner"></div>

            <p>
              Verificando pago...
            </p>

          </div>
        </div>
      )}

    </section>
  )
}

export default UploadZone