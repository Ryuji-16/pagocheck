import { findMovementByReference } from './historyService.js'
import { isRemoteDbEnabled } from './supabaseClient.js'
import { MockPaymentProvider } from './providers/MockPaymentProvider.js'
import { EdgeFunctionPaymentProvider } from './providers/EdgeFunctionPaymentProvider.js'

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
 * 3. Normalización consistente del resultado.
 *
 * @param {Object} data - Datos de la transacción ingresada o extraída por OCR
 * @returns {Promise<Object>}
 */
export async function verifyPayment(data = {}) {
  const ref = String(data.reference || '').trim()

  // 1. Verificación de seguridad anti-fraude rápida en cliente
  if (ref) {
    const existing = await findMovementByReference(ref, data.bank)
    if (existing) {
      const when = formatWhen(existing.at)
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
    provider: result.provider || provider.id
  }
}
