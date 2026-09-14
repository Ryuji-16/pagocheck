import { findMovementByReference } from './historyService.js'
import { isRemoteDbEnabled } from './supabaseClient.js'
import { MockPaymentProvider } from './providers/MockPaymentProvider.js'
import { EdgeFunctionPaymentProvider } from './providers/EdgeFunctionPaymentProvider.js'
import { recordAuditEvent, AUDIT_ACTIONS } from './auditService.js'

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return value || ''
  }
}

// Instancia activa del proveedor de verificación
let activeProvider = null

export function getVerificationProvider() {
  if (!activeProvider) {
    activeProvider = isRemoteDbEnabled()
      ? new EdgeFunctionPaymentProvider()
      : new MockPaymentProvider()
  }
  return activeProvider
}

export function setVerificationProvider(provider) {
  activeProvider = provider
}

/**
 * Función principal de verificación bancaria para la UI de PagoCheck.
 *
 * Flujo:
 * 1. Pre-chequeo anti-fraude en cliente (prevención instantánea).
 * 2. Delegación al proveedor bancario activo (Mock local o Edge Function server-side).
 * 3. Registro forense de auditoría con latencia en ms.
 * 4. Normalización consistente del resultado.
 *
 * @param {Object} data - Datos de la transacción ingresada o extraída por OCR
 * @returns {Promise<Object>}
 */
export async function verifyPayment(data = {}) {
  const ref = String(data.reference || '').trim()
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()

  // 1. Verificación de seguridad anti-fraude rápida en cliente
  if (ref) {
    const existing = await findMovementByReference(ref, data.bank)
    if (existing) {
      const when = formatWhen(existing.at)
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime

      // Registrar evento de duplicado bloqueado en auditoría
      recordAuditEvent({
        action: AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED,
        entityType: 'payment',
        entityId: ref,
        status: 'warning',
        details: {
          bank: data.bank,
          phone: data.phone,
          duplicateOfId: existing.id,
          duplicateOfReference: existing.reference,
          originalBranch: existing.branch || existing.label
        },
        durationMs
      })

      return {
        ...data,
        status: 'error',
        code: 'DUPLICATE',
        message: `⚠️ Referencia duplicada: este pago ya fue registrado en ${existing.label || existing.username} el ${when}${existing.amount ? ` por ${existing.amount}` : ''}.`,
        duplicateOf: existing
      }
    }
  }

  // 2. Consulta a través del proveedor bancario activo
  const provider = getVerificationProvider()
  const result = await provider.verify(data)
  const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime

  // Determinar acción de auditoría según respuesta bancaria
  let auditAction = AUDIT_ACTIONS.VERIFY_CONFIRMED
  let auditStatus = 'success'

  if (result.status === 'not-found') {
    auditAction = AUDIT_ACTIONS.VERIFY_NOT_FOUND
    auditStatus = 'warning'
  } else if (result.status === 'error') {
    auditAction = AUDIT_ACTIONS.VERIFY_ERROR
    auditStatus = 'error'
  }

  // Registrar resultado de verificación bancaria en auditoría
  recordAuditEvent({
    action: auditAction,
    entityType: 'payment',
    entityId: ref || result.reference,
    status: auditStatus,
    details: {
      provider: result.provider || provider.id,
      bank: result.bank || data.bank,
      phone: result.phone || data.phone,
      amount: result.amount || data.amount,
      code: result.code || null,
      message: result.message || null
    },
    durationMs
  })

  // 3. Normalización de respuesta para la UI
  return {
    ...data,
    status: result.status || (result.ok ? 'confirmed' : 'error'),
    code: result.code,
    message: result.message,
    amount: result.amount || data.amount,
    reference: result.reference || data.reference,
    date: result.date || data.date,
    bank: result.bank || data.bank,
    phone: result.phone || data.phone,
    provider: result.provider || provider.id,
    duration_ms: Math.max(0, Math.round(durationMs))
  }
}
