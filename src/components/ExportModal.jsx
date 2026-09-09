import { useRef, useState } from 'react'
import { injectMiniCuadrosIntoArqueo } from '../services/arqueoService'
import './css/ExportModal.css'

function ExportModal({
  isOpen,
  onClose,
  movements = [],
  onExportCleanReport
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState(null)

  const fileInputRef = useRef(null)

  if (!isOpen) return null

  function handleFileSelect(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setStatus({
        type: 'error',
        text: 'Por favor selecciona un archivo de Excel con formato .xlsx.'
      })
      return
    }
    setSelectedFile(file)
    setStatus(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  async function handleUpdateArqueo() {
    if (!selectedFile) {
      setStatus({
        type: 'error',
        text: 'Por favor selecciona tu archivo de Arqueo de Caja primero.'
      })
      return
    }

    setIsProcessing(true)
    setStatus(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const result = await injectMiniCuadrosIntoArqueo(
        buffer,
        selectedDay,
        movements,
        selectedFile.name
      )

      setStatus({
        type: 'success',
        text: `¡Listo! Se agregaron los mini cuadros del día ${result.day} en la columna U. Descargando "${result.fileName}"...`
      })
    } catch (err) {
      console.error('Error al actualizar archivo de arqueo:', err)
      setStatus({
        type: 'error',
        text: err.message || 'Ocurrió un error al procesar el archivo de arqueo.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleDownloadClean() {
    setIsProcessing(true)
    setStatus(null)
    try {
      await onExportCleanReport()
      onClose()
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.message || 'Error al generar el reporte limpio.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const daysOptions = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h2>
            <span>📊</span> Exportar Movimientos
          </h2>
          <button
            type="button"
            className="export-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Sección 1: Unir a Arqueo de Caja */}
        <div className="export-section-card">
          <h3>
            <span>📎</span> Unir a mi Arqueo Diario
          </h3>
          <p className="export-section-desc">
            Agrega un mini cuadro de consulta (sin fórmulas, solo valores para copiar y pegar)
            al lado de tu arqueo (columna U en adelante) en la hoja del día seleccionado.
          </p>

          {!selectedFile ? (
            <div
              className="export-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <span className="export-dropzone-icon">📁</span>
              <p>
                <strong>Haz clic para seleccionar</strong> o arrastra tu archivo de Arqueo (.xlsx)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="export-file-badge">
              <span>📄 {selectedFile.name}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                title="Quitar archivo"
              >
                ✕
              </button>
            </div>
          )}

          <div className="export-row-controls">
            <label htmlFor="select-day">Día a cuadrar:</label>
            <select
              id="select-day"
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
            >
              {daysOptions.map((day) => (
                <option key={day} value={day}>
                  Día {day}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="export-btn-action"
            onClick={handleUpdateArqueo}
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Agregar mini cuadros y descargar'}
          </button>
        </div>

        {/* Sección 2: Reporte Limpio Independiente */}
        <div className="export-section-card">
          <h3>
            <span>📄</span> Reporte Independiente
          </h3>
          <p className="export-section-desc">
            Descarga un archivo Excel nuevo con una hoja organizada para cada caja con todos sus movimientos.
          </p>
          <button
            type="button"
            className="export-btn-secondary"
            onClick={handleDownloadClean}
            disabled={isProcessing || movements.length === 0}
          >
            Descargar nuevo archivo (.xlsx)
          </button>
        </div>

        {status && (
          <div className={`export-modal-status ${status.type}`}>
            {status.text}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExportModal
