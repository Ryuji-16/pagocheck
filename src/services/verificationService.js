const DEMO_DELAY_MS = 2000

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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
  const bankResponse = await requestBankVerification(data)
  return toPagoCheckResult(data, bankResponse)
}
