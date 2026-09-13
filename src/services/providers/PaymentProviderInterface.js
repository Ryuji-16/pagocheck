/**
 * PagoCheck - Interfaz y Contrato para Proveedores de Verificación Bancaria
 *
 * Cualquier proveedor (Mock, Banesco, EdgeFunction, etc.) debe implementar
 * el método: verify(query) -> Promise<NormalizedVerificationResult>
 *
 * @typedef {Object} VerificationQuery
 * @property {string} reference - Número de referencia del pago
 * @property {string} [bank] - Banco emisor/receptor
 * @property {string} [amount] - Monto informado o extraído
 * @property {string} [phone] - Teléfono asociado
 * @property {string} [date] - Fecha de la operación
 *
 * @typedef {Object} NormalizedVerificationResult
 * @property {boolean} ok - Indica si la verificación fue exitosa
 * @property {'confirmed' | 'not-found' | 'error'} status - Estado normalizado
 * @property {string} [code] - Código interno de respuesta (ej: 'NOT_FOUND', 'TIMEOUT')
 * @property {string} [message] - Mensaje descriptivo para el usuario
 * @property {string} [amount] - Monto verificado
 * @property {string} reference - Referencia bancaria confirmada
 * @property {string} [date] - Fecha registrada por el banco
 * @property {string} [bank] - Banco confirmado
 * @property {string} [phone] - Teléfono confirmado
 * @property {string} provider - Identificador del proveedor utilizado
 */

export class PaymentProviderInterface {
  /**
   * Identificador único del proveedor (ej: 'mock', 'banesco', 'edge-function')
   * @returns {string}
   */
  get id() {
    throw new Error('El proveedor debe definir una propiedad id.')
  }

  /**
   * Ejecuta la verificación de la transacción contra el proveedor bancario.
   *
   * @param {VerificationQuery} _query
   * @returns {Promise<NormalizedVerificationResult>}
   */
  async verify() {
    throw new Error('El proveedor debe implementar el método verify(query).')
  }
}
