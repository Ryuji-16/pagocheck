import { PaymentProviderInterface } from './PaymentProviderInterface.js'
import { supabase } from '../supabaseClient.js'
import { MockPaymentProvider } from './MockPaymentProvider.js'

/**
 * Adaptador que delega la verificación al backend server-side (Supabase Edge Function),
 * asegurando que las credenciales bancarias nunca toquen el navegador del cliente.
 */
export class EdgeFunctionPaymentProvider extends PaymentProviderInterface {
  constructor(fallbackMock = true) {
    super()
    this.fallbackMock = fallbackMock
    this.mockProvider = new MockPaymentProvider()
  }

  get id() {
    return 'edge-function'
  }

  /**
   * Invoca la función server-side verify-payment en Supabase.
   *
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async verify(query = {}) {
    if (!supabase) {
      if (this.fallbackMock) {
        return this.mockProvider.verify(query)
      }
      throw new Error('Cliente de Supabase no disponible para invocar verify-payment.')
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: query
      })

      // Si la Edge Function aún no fue desplegada en el proyecto remoto,
      // utilizar fallback a simulación para no interrumpir el desarrollo
      if (error) {
        console.warn('Edge Function verify-payment no respondió, usando fallback:', error.message)
        if (this.fallbackMock) {
          return this.mockProvider.verify(query)
        }
        return {
          ok: false,
          status: 'error',
          code: 'EDGE_FUNCTION_ERROR',
          message: error.message || 'Error al comunicarse con el servicio de verificación.',
          reference: query.reference,
          provider: this.id
        }
      }

      return data
    } catch (err) {
      console.warn('Error al invocar Edge Function, usando fallback:', err)
      if (this.fallbackMock) {
        return this.mockProvider.verify(query)
      }
      return {
        ok: false,
        status: 'error',
        code: 'INVOCATION_FAILED',
        message: err.message || 'No se pudo contactar al servidor de verificación.',
        reference: query.reference,
        provider: this.id
      }
    }
  }
}
