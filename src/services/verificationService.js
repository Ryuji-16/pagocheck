import { findMovementByReference } from './historyService'

const DEMO_DELAY_MS = 2000

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

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

/*
 * Punto de conexión con el banco.
 *
 * Hoy devuelve una simulación.
 * Cuando exista la API de Banesco, solo se cambia esta función.
 * verifyPayment() y el resto de la UI no deberían reestructurarse.
 */
async function requestBankVerification(query) {
  await wait(DEMO_DELAY_MS)
  return simulateBanescoResponse(query)
}

function simulateBanescoResponse(query) {
  const reference = String(query.reference || '').trim()

  if (reference === '111111111') {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'La transacción no pudo ser localizada.'
    }
  }

  if (reference === '999999999') {
    return {
      ok: false,
      code: 'ERROR',
      message: 'Error al procesar la operación.'
    }
  }

  return {
    ok: true,
    amount: 'Bs. 150,00',
    reference: query.reference,
    date: query.date,
    bank: query.bank,
    phone: query.phone
  }
}

function toPagoCheckResult(query, bankResponse) {
  if (!bankResponse.ok && bankResponse.code === 'NOT_FOUND') {
    return {
      ...query,
      status: 'not-found',
      message: bankResponse.message
    }
  }

  if (!bankResponse.ok) {
    return {
      ...query,
      status: 'error',
      message: bankResponse.message || 'Error al procesar la operación.'
    }
  }

  return {
    ...query,
    status: 'confirmed',
    amount: bankResponse.amount,
    reference: bankResponse.reference,
    date: bankResponse.date,
    bank: bankResponse.bank,
    phone: bankResponse.phone
  }
}

export async function verifyPayment(data = {}) {
  const ref = String(data.reference || '').trim()

  // 1. Verificación de seguridad anti-fraude: referencia duplicada
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

  // 2. Consulta con el banco
  const bankResponse = await requestBankVerification(data)
  return toPagoCheckResult(data, bankResponse)
}
