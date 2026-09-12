import { useState, useEffect, useCallback } from 'react'
import { listMovements, purgeExpiredReceiptImages } from '../services/historyService'
import { getTenantConfig, setTenantConfig } from '../config/tenantConfig'

function SettingsStorageTab({ session }) {
  const [retentionDays, setRetentionDays] = useState(() => {
    const config = getTenantConfig()
    return Number(config.defaultRetentionDays) || 7
  })
  const [movements, setMovements] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPurging, setIsPurging] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const loadMovements = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await listMovements(session)
      setMovements(data || [])
    } catch (err) {
      console.error('Error al cargar movimientos en dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }, [session])

  useEffect(() => {
    let active = true
    listMovements(session)
      .then((data) => {
        if (active) setMovements(data || [])
      })
      .catch((err) => {
        console.error('Error al cargar movimientos en dashboard:', err)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  function handleRetentionChange(event) {
    const nextDays = Number(event.target.value) || 7
    setRetentionDays(nextDays)
    setTenantConfig({ defaultRetentionDays: nextDays })
    setFeedback({
      type: 'info',
      message: `Política de retención establecida a ${nextDays} días.`
    })
  }

  async function handlePurgeNow() {
    setIsPurging(true)
    setFeedback(null)

    try {
      const sizeBefore =
        typeof localStorage !== 'undefined'
          ? (localStorage.getItem('pagocheck-movements') || '').length
          : 0

      const purgedCount = purgeExpiredReceiptImages(retentionDays)

      const sizeAfter =
        typeof localStorage !== 'undefined'
          ? (localStorage.getItem('pagocheck-movements') || '').length
          : 0

      await loadMovements()

      if (purgedCount > 0) {
        const bytesFreed = Math.max(0, sizeBefore - sizeAfter)
        const kbFreed = (bytesFreed / 1024).toFixed(1)
        setFeedback({
          type: 'success',
          message: `⚡ Se purgaron ${purgedCount} comprobante${purgedCount === 1 ? '' : 's'} expirado${purgedCount === 1 ? '' : 's'} (> ${retentionDays} días). Alrededor de ${kbFreed} KB de almacenamiento liberados.`
        })
      } else {
        setFeedback({
          type: 'info',
          message: `No se encontraron comprobantes con más de ${retentionDays} días de antigüedad. El almacenamiento ya está al día.`
        })
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Ocurrió un error al intentar purgar los comprobantes expirados.'
      })
    } finally {
      setIsPurging(false)
    }
  }

  // Cálculos en tiempo real
  const totalMovements = movements.length
  const withActiveImage = movements.filter(
    (m) => m.receipt_image && m.receipt_image !== 'purged' && m.receipt_image.trim().length > 0
  ).length
  const archivedText = movements.filter((m) => m.receipt_image === 'purged').length

  return (
    <div className="settings-tab-content">
      <div className="settings-tab-header">
        <h3 className="settings-tab-title">Retención de Datos y Almacenamiento</h3>
        <p className="settings-tab-desc">
          Optimiza la memoria del dispositivo depurando imágenes base64 pesadas de comprobantes antiguos, conservando intacto el 100% de los datos de auditoría contable.
        </p>
      </div>

      <div className="settings-section">
        <label className="app-field">
          Política de retención de comprobantes
          <select value={retentionDays} onChange={handleRetentionChange}>
            <option value={7}>7 días (Recomendado)</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
          </select>
          <span className="settings-field-hint">
            Los comprobantes visuales que superen este período se purgan automáticamente para ahorrar espacio.
          </span>
        </label>
      </div>

      <div className="settings-section">
        <h4 className="settings-subtitle">Estado del almacenamiento en tiempo real</h4>

        <div className="settings-stats-grid">
          <div className="settings-stat-card">
            <span className="settings-stat-icon">📊</span>
            <span className="settings-stat-num">{isLoading ? '...' : totalMovements}</span>
            <span className="settings-stat-label">Total movimientos</span>
          </div>

          <div className="settings-stat-card active-image">
            <span className="settings-stat-icon">🖼️</span>
            <span className="settings-stat-num">{isLoading ? '...' : withActiveImage}</span>
            <span className="settings-stat-label">Con imagen activa</span>
          </div>

          <div className="settings-stat-card archived-text">
            <span className="settings-stat-icon">📄</span>
            <span className="settings-stat-num">{isLoading ? '...' : archivedText}</span>
            <span className="settings-stat-label">Archivados en texto</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`settings-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <div className="settings-actions">
        <button
          type="button"
          className="app-button storage-purge-button"
          onClick={handlePurgeNow}
          disabled={isPurging || isLoading}
        >
          {isPurging ? 'Purgando comprobantes...' : '⚡ Purgar comprobantes expirados ahora'}
        </button>
      </div>
    </div>
  )
}

export default SettingsStorageTab
