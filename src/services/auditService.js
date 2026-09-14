import { supabase, isRemoteDbEnabled } from './supabaseClient.js'
import { getSession } from './authService.js'

/**
 * Constantes de acciones para la bitácora de auditoría
 */
export const AUDIT_ACTIONS = {
  VERIFY_ATTEMPT: 'VERIFY_ATTEMPT',
  VERIFY_CONFIRMED: 'VERIFY_CONFIRMED',
  VERIFY_NOT_FOUND: 'VERIFY_NOT_FOUND',
  VERIFY_ERROR: 'VERIFY_ERROR',
  VERIFY_DUPLICATE_BLOCKED: 'VERIFY_DUPLICATE_BLOCKED',
  VUELTO_ISSUED: 'VUELTO_ISSUED',
  RECEIPT_UPLOADED: 'RECEIPT_UPLOADED',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT'
}

// Almacén en memoria para modo desconectado / pruebas locales
const localAuditLogs = []
const MAX_LOCAL_LOGS = 100

/**
 * Registra un evento de auditoría de manera asíncrona y segura.
 *
 * @param {object} params
 * @param {string} params.action - Código de acción (ej: AUDIT_ACTIONS.VERIFY_CONFIRMED)
 * @param {string} [params.entityType='payment'] - Tipo de entidad ('payment', 'vuelto', 'storage', 'session')
 * @param {string|number} [params.entityId=null] - Referencia o ID de la entidad
 * @param {'success'|'warning'|'error'|'info'} [params.status='success'] - Estado del evento
 * @param {object} [params.details={}] - Metadatos adicionales estructurados
 * @param {number|null} [params.durationMs=null] - Tiempo de respuesta en milisegundos
 * @returns {Promise<object>} Registro creado
 */
export async function recordAuditEvent({
  action,
  entityType = 'payment',
  entityId = null,
  status = 'success',
  details = {},
  durationMs = null
}) {
  const session = getSession()

  const logEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    created_at: new Date().toISOString(),
    actor_id: session?.id || null,
    actor_username: session?.username || 'sistema',
    actor_branch: session?.branch || 'general',
    action: String(action || 'UNKNOWN'),
    entity_type: entityType,
    entity_id: entityId ? String(entityId).trim() : null,
    status,
    details: details && typeof details === 'object' ? details : {},
    duration_ms: durationMs != null ? Math.max(0, Math.round(durationMs)) : null
  }

  // Guardar en búfer local
  localAuditLogs.unshift(logEntry)
  if (localAuditLogs.length > MAX_LOCAL_LOGS) {
    localAuditLogs.pop()
  }

  // Si la conexión a Supabase está activa, persistir en PostgreSQL
  if (isRemoteDbEnabled()) {
    try {
      const payload = {
        actor_id: logEntry.actor_id,
        actor_username: logEntry.actor_username,
        actor_branch: logEntry.actor_branch,
        action: logEntry.action,
        entity_type: logEntry.entity_type,
        entity_id: logEntry.entity_id,
        status: logEntry.status,
        details: logEntry.details,
        duration_ms: logEntry.duration_ms
      }

      const { error } = await supabase.from('audit_logs').insert([payload])
      if (error) {
        console.warn('Advertencia al registrar log de auditoría en Supabase:', error.message)
      }
    } catch (err) {
      // Fallback silencioso: nunca bloquear la operación del usuario por fallas de logging
      console.warn('Error no bloqueante al registrar auditoría remota:', err)
    }
  }

  return logEntry
}

/**
 * Consulta la bitácora de auditoría respetando las políticas RLS del usuario autenticado.
 *
 * @param {object} [filters={}]
 * @param {string} [filters.action]
 * @param {string} [filters.status]
 * @param {string} [filters.branch]
 * @param {number} [filters.limit=50]
 * @returns {Promise<Array<object>>} Lista de registros de auditoría
 */
export async function fetchAuditLogs(filters = {}) {
  const limit = Math.min(filters.limit || 50, 100)

  if (isRemoteDbEnabled()) {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action)
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters.branch && filters.branch !== 'all') {
        query = query.eq('actor_branch', filters.branch)
      }

      const { data, error } = await query
      if (!error && Array.isArray(data)) {
        return data
      }
      console.warn('Fallo en consulta remota de audit_logs, usando fallback local:', error?.message)
    } catch (err) {
      console.warn('Error al consultar audit_logs en Supabase:', err)
    }
  }

  // Fallback local en memoria
  let results = [...localAuditLogs]
  if (filters.action && filters.action !== 'all') {
    results = results.filter((log) => log.action === filters.action)
  }
  if (filters.status && filters.status !== 'all') {
    results = results.filter((log) => log.status === filters.status)
  }
  if (filters.branch && filters.branch !== 'all') {
    results = results.filter((log) => log.actor_branch === filters.branch)
  }

  return results.slice(0, limit)
}
