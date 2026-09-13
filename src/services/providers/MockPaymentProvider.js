import { PaymentProviderInterface } from './PaymentProviderInterface.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Adaptador de Simulación Controlada para Desarrollo Local y Pruebas
 */
export class MockPaymentProvider extends PaymentProviderInterface {
  constructor(delayMs = 1500) {
    super()
    this.delayMs = delayMs
  }

  get id() {
    return 'mock'
  }

  /**
   * Simula la respuesta bancaria según la referencia ingresada.
   *
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async verify(query = {}) {
    if (this.delayMs > 0) {
      await wait(this.delayMs)
    }

    const reference = String(query.reference || '').trim()

    // 1. Caso de prueba: No encontrado
    if (reference === '111111111') {
      return {
        ok: false,
        status: 'not-found',
        code: 'NOT_FOUND',
        message: 'La transacción no pudo ser localizada en el banco.',
        reference,
        bank: query.bank || 'Banesco',
        provider: this.id
      }
    }

    // 2. Caso de prueba: Error de servicio
    if (reference === '999999999') {
      return {
        ok: false,
        status: 'error',
        code: 'BANK_TIMEOUT',
        message: 'Error de comunicación o tiempo de espera agotado con la red bancaria.',
        reference,
        bank: query.bank || 'Banesco',
        provider: this.id
      }
    }

    // 3. Caso normal: Pago confirmado
    return {
      ok: true,
      status: 'confirmed',
      amount: query.amount || 'Bs. 150,00',
      reference: query.reference,
      date: query.date || new Date().toISOString(),
      bank: query.bank || 'Banesco',
      phone: query.phone || '',
      provider: this.id
    }
  }
}
