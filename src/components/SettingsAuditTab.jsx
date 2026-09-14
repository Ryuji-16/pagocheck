import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchAuditLogs, AUDIT_ACTIONS } from '../services/auditService'
import './css/SettingsAuditTab.css'

function getActionMeta(action) {
  switch (action) {
    case AUDIT_ACTIONS.VERIFY_CONFIRMED:
      return { label: 'Pago Confirmado', icon: '✅' }
    case AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED:
      return { label: 'Duplicado Bloqueado', icon: '🛡️' }
    case AUDIT_ACTIONS.VERIFY_NOT_FOUND:
      return { label: 'No Encontrado', icon: '🔍' }
    case AUDIT_ACTIONS.VERIFY_ERROR:
      return { label: 'Error de Red / Banco', icon: '⚠️' }
    case AUDIT_ACTIONS.VERIFY_ATTEMPT:
      return { label: 'Consulta Bancaria', icon: '📡' }
    case AUDIT_ACTIONS.VUELTO_ISSUED:
      return { label: 'Vuelto Emitido', icon: '💸' }
    case AUDIT_ACTIONS.RECEIPT_UPLOADED:
      return { label: 'Comprobante Subido', icon: '📸' }
    case AUDIT_ACTIONS.LOGIN:
      return { label: 'Inicio de Sesión', icon: '🔑' }
    case AUDIT_ACTIONS.LOGOUT:
      return { label: 'Cierre de Sesión', icon: '🚪' }
    default:
      return { label: action || 'Evento', icon: '📝' }
  }
}

function formatDate(isoString) {
  if (!isoString) return '-'
  try {
    const date = new Date(isoString)
    return date.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return isoString
  }
}

function SettingsAuditTab({ session }) {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchAuditLogs({
        action: actionFilter,
        status: statusFilter,
        limit: 50
      })
      setLogs(data || [])
    } catch (err) {
      console.error('Error al cargar bitácora de auditoría:', err)
    } finally {
      setIsLoading(false)
    }
  }, [actionFilter, statusFilter])

  useEffect(() => {
    let active = true
    fetchAuditLogs({
      action: actionFilter,
      status: statusFilter,
      limit: 50
    })
      .then((data) => {
        if (active) setLogs(data || [])
      })
      .catch((err) => {
        console.error('Error al cargar bitácora de auditoría:', err)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [actionFilter, statusFilter])

  const kpis = useMemo(() => {
    const total = logs.length
    const duplicates = logs.filter(
      (l) => l.action === AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED
    ).length

    const logsWithLatency = logs.filter((l) => typeof l.duration_ms === 'number')
    const avgLatency =
      logsWithLatency.length > 0
        ? Math.round(
            logsWithLatency.reduce((acc, curr) => acc + curr.duration_ms, 0) /
              logsWithLatency.length
          )
        : null

    return { total, duplicates, avgLatency }
  }, [logs])

  return (
    <div className="settings-tab-content settings-audit-tab">
      <header className="settings-tab-header">
        <h3 className="settings-tab-title">Bitácora de Auditoría y Observabilidad</h3>
        <p className="settings-tab-desc">
          Trazabilidad forense inmutable de verificaciones bancarias, detección de duplicados,
          vueltos y métricas de latencia en tiempo real.
        </p>
      </header>

      {/* Tarjetas KPI de observabilidad */}
      <div className="settings-audit-kpis">
        <div className="settings-audit-kpi-card">
          <span className="settings-audit-kpi-value">{kpis.total}</span>
          <span className="settings-audit-kpi-label">Eventos Mostrados</span>
        </div>

        <div className="settings-audit-kpi-card">
          <span className={`settings-audit-kpi-value ${kpis.duplicates > 0 ? 'warning' : 'accent'}`}>
            {kpis.duplicates}
          </span>
          <span className="settings-audit-kpi-label">Duplicados Bloqueados</span>
        </div>

        <div className="settings-audit-kpi-card">
          <span className="settings-audit-kpi-value accent">
            {kpis.avgLatency != null ? `${kpis.avgLatency} ms` : '—'}
          </span>
          <span className="settings-audit-kpi-label">Latencia Bancaria Promedio</span>
        </div>
      </div>

      {/* Controles de filtrado y actualización */}
      <div className="settings-audit-controls">
        <div className="settings-audit-filters-group">
          <label className="settings-audit-filter-item">
            <span>Acción:</span>
            <select
              className="settings-audit-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">Todas las acciones</option>
              <option value={AUDIT_ACTIONS.VERIFY_CONFIRMED}>✅ Pagos Confirmados</option>
              <option value={AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED}>🛡️ Duplicados Bloqueados</option>
              <option value={AUDIT_ACTIONS.VERIFY_NOT_FOUND}>🔍 No Encontrados</option>
              <option value={AUDIT_ACTIONS.VERIFY_ERROR}>⚠️ Errores de Red / Banco</option>
              <option value={AUDIT_ACTIONS.VERIFY_ATTEMPT}>📡 Consultas Bancarias</option>
              <option value={AUDIT_ACTIONS.VUELTO_ISSUED}>💸 Vueltos Emitidos</option>
              <option value={AUDIT_ACTIONS.RECEIPT_UPLOADED}>📸 Comprobantes Subidos</option>
            </select>
          </label>

          <label className="settings-audit-filter-item">
            <span>Estado:</span>
            <select
              className="settings-audit-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="success">Éxito (success)</option>
              <option value="warning">Advertencia (warning)</option>
              <option value="error">Error (error)</option>
              <option value="info">Información (info)</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className="settings-audit-refresh-btn"
          onClick={loadLogs}
          disabled={isLoading}
          title="Recargar eventos recientes"
        >
          {isLoading ? '⏳ Cargando...' : '↻ Actualizar'}
        </button>
      </div>

      {/* Tabla de registros de auditoría */}
      <div className="settings-audit-table-wrapper">
        {isLoading ? (
          <div className="settings-audit-loading">Cargando eventos de auditoría...</div>
        ) : logs.length === 0 ? (
          <div className="settings-audit-empty">
            <div className="settings-audit-empty-icon">📜</div>
            <p>No se encontraron eventos con los filtros seleccionados.</p>
          </div>
        ) : (
          <table className="settings-audit-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario / Sucursal</th>
                <th>Acción</th>
                <th>Referencia</th>
                <th>Estado</th>
                <th>Latencia</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const meta = getActionMeta(log.action)
                const ref = log.entity_id || log.details?.reference || '-'
                const latency = log.duration_ms
                let latencyClass = 'audit-latency-fast'
                if (latency > 2000) latencyClass = 'audit-latency-slow'
                else if (latency > 800) latencyClass = 'audit-latency-medium'

                return (
                  <tr key={log.id}>
                    <td className="audit-date-cell">{formatDate(log.created_at)}</td>
                    <td>
                      <div className="audit-actor-cell">
                        <span className="audit-actor-name">{log.actor_username || 'sistema'}</span>
                        <span className="audit-actor-branch">{log.actor_branch || session?.branch || 'General'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="audit-action-badge">
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    </td>
                    <td>
                      <span className="audit-ref-code">{ref}</span>
                    </td>
                    <td>
                      <span className={`audit-status-badge ${log.status || 'info'}`}>
                        {log.status || 'info'}
                      </span>
                    </td>
                    <td>
                      {latency != null ? (
                        <span className={`audit-latency-pill ${latencyClass}`}>
                          {latency} ms
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default SettingsAuditTab
