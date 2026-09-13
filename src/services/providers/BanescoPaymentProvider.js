import { PaymentProviderInterface } from './PaymentProviderInterface.js'

/**
 * Adaptador de Integración para Banesco (API / Gateway Bancario)
 *
 * Diseñado para ser invocado desde la Edge Function o un servicio server-side seguro,
 * garantizando que API keys, certificados o secretos de Banesco nunca residan en el cliente.
 */
export class BanescoPaymentProvider extends PaymentProviderInterface {
  constructor(config = {}) {
    super()
    this.apiUrl = config.apiUrl || ''
    this.apiKey = config.apiKey || ''
    this.clientId = config.clientId || ''
  }

  get id() {
    return 'banesco'
  }

  /**
   * Consulta la API de Banesco y normaliza el resultado al estándar de PagoCheck.
   *
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async verify(query = {}) {
    if (!this.apiUrl) {
      throw new Error('BanescoPaymentProvider no tiene configurada la URL de la API bancaria.')
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': this.clientId,
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          referenceNumber: query.reference,
          bankCode: query.bank,
          expectedAmount: query.amount,
          phoneNumber: query.phone,
          transactionDate: query.date
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 404 || data.code === 'TRANSACTION_NOT_FOUND') {
          return {
            ok: false,
            status: 'not-found',
            code: 'NOT_FOUND',
            message: data.message || 'La transacción no fue localizada en Banesco.',
            reference: query.reference,
            bank: query.bank || 'Banesco',
            provider: this.id
          }
        }

        return {
          ok: false,
          status: 'error',
          code: data.code || 'BANESCO_ERROR',
          message: data.message || 'Error al consultar el servicio de Banesco.',
          reference: query.reference,
          bank: query.bank || 'Banesco',
          provider: this.id
        }
      }

      return {
        ok: true,
        status: 'confirmed',
        amount: data.amount || query.amount,
        reference: data.reference || query.reference,
        date: data.date || query.date,
        bank: data.bank || query.bank || 'Banesco',
        phone: data.phone || query.phone,
        provider: this.id
      }
    } catch (err) {
      return {
        ok: false,
        status: 'error',
        code: 'NETWORK_ERROR',
        message: `Fallo de comunicación con Banesco: ${err.message}`,
        reference: query.reference,
        bank: query.bank || 'Banesco',
        provider: this.id
      }
    }
  }
}
