import { getTenantConfig } from '../config/tenantConfig'
import { findMovementByReference, saveMovement } from './historyService'

/**
 * Verifica si un número de referencia ya fue utilizado previamente
 * en cualquier caja, terminal de mostrador, móvil o por el bot.
 *
 * @param {string} reference - Número de referencia de la transferencia/pago móvil.
 * @param {string} [bank] - Entidad bancaria emisora (opcional).
 * @returns {Promise<{ isDuplicate: boolean, existingMovement: object|null }>}
 */
export async function checkBotDuplicateReference(reference, bank = '') {
  const ref = String(reference || '').trim()
  if (!ref) {
    return { isDuplicate: false, existingMovement: null }
  }

  const existingMovement = await findMovementByReference(ref, bank)
  return {
    isDuplicate: Boolean(existingMovement),
    existingMovement: existingMovement || null
  }
}

/**
 * Registra un pago procesado a través de la integración del bot conversacional (WhatsApp u otro canal).
 * Valida previamente la no duplicidad de la referencia antes de registrar el movimiento.
 *
 * @param {Object} paymentData
 * @param {string|number} [paymentData.amount]
 * @param {string} paymentData.reference
 * @param {string} [paymentData.phone]
 * @param {string} [paymentData.bank]
 * @param {string} [paymentData.cedula]
 * @param {string} [paymentData.note]
 * @param {string} [paymentData.customerName]
 * @param {string|number} [paymentData.orderId]
 * @param {Object} [configOverride] - Opcional para pruebas o multi-tenant dinámico.
 * @returns {Promise<{ success: boolean, movement?: object, reason?: string, duplicateOf?: object, message?: string }>}
 */
export async function registerBotPayment(
  {
    amount = '',
    reference = '',
    phone = '',
    bank = '',
    cedula = '',
    note = '',
    customerName = '',
    orderId = ''
  } = {},
  configOverride = null
) {
  const config = configOverride || getTenantConfig()

  // 1. Verificación obligatoria de referencia duplicada
  const dupCheck = await checkBotDuplicateReference(reference, bank)
  if (dupCheck.isDuplicate) {
    return {
      success: false,
      reason: 'duplicate',
      duplicateOf: dupCheck.existingMovement
    }
  }

  // 2. Construcción de nota descriptiva
  let resolvedNote = note
  if (!resolvedNote) {
    if (orderId && customerName) {
      resolvedNote = `Pedido #${orderId} - ${customerName}`
    } else if (orderId) {
      resolvedNote = `Pedido #${orderId}`
    } else if (customerName) {
      resolvedNote = `Venta WhatsApp - ${customerName}`
    } else {
      resolvedNote = 'Venta WhatsApp'
    }
  }

  // 3. Persistencia del movimiento bajo la identidad de servicio del bot
  const movementToSave = {
    username: config.bot?.serviceUsername || 'bot_service',
    label: config.bot?.serviceLabel || 'Asistente WhatsApp',
    branch: config.bot?.branch || 'WhatsApp / Delivery',
    type: 'validacion',
    status: 'ok',
    amount: String(amount || ''),
    reference: String(reference || ''),
    phone: String(phone || ''),
    bank: String(bank || ''),
    cedula: String(cedula || ''),
    note: resolvedNote
  }

  const movement = await saveMovement(movementToSave)

  if (!movement) {
    return {
      success: false,
      reason: 'error',
      message: 'No se pudo guardar el movimiento'
    }
  }

  return {
    success: true,
    movement
  }
}

/**
 * Genera el texto dinámico del mensaje de WhatsApp para responder al cliente,
 * utilizando las identidades configuradas en el tenant (nombre de negocio y alias del bot).
 *
 * @param {Object} result - Resultado retornado por registerBotPayment.
 * @param {Object} [configOverride] - Opcional para sobreescribir configuración de tenant.
 * @returns {string} Mensaje formateado en texto compatible con WhatsApp markdown.
 */
export function formatBotPaymentResponse(result, configOverride = null) {
  const config = configOverride || getTenantConfig()
  const botAlias = config?.bot?.alias || 'Asistente Virtual'
  const businessName = config?.businessName || 'nuestro negocio'
  const currency = config?.defaultCurrency || 'VES'

  if (result?.success && result?.movement) {
    const { reference, bank, amount, note } = result.movement
    const lines = [
      `¡Hola! Te saluda *${botAlias}* de *${businessName}* 🤖✨`,
      '',
      '✅ *¡Pago verificado y registrado con éxito!*',
      '',
      '📋 *Detalles de la operación:*'
    ]

    if (reference) lines.push(`• *Referencia:* ${reference}`)
    if (bank) lines.push(`• *Banco:* ${bank}`)
    if (amount) lines.push(`• *Monto:* ${amount} ${currency}`)
    if (note) lines.push(`• *Concepto:* ${note}`)

    lines.push('', `Estamos procesando tu orden. ¡Muchas gracias por tu compra en *${businessName}*! 🙌`)
    return lines.join('\n')
  }

  if (result?.reason === 'duplicate') {
    const dup = result.duplicateOf || {}
    const branchInfo = dup.branch ? ` en la sucursal *${dup.branch}*` : ''
    const refText = dup.reference ? `*${dup.reference}*` : 'indicada'

    return [
      `¡Hola! Te saluda *${botAlias}* de *${businessName}* 🤖`,
      '',
      '⚠️ *Aviso de pago duplicado detectado*',
      '',
      `La referencia ${refText} ya fue registrada previamente en el sistema${branchInfo}.`,
      '',
      'Por favor verifica el número de referencia en tu comprobante o comunícate con un asesor si requieres asistencia.'
    ].join('\n')
  }

  return [
    `¡Hola! Te saluda *${botAlias}* de *${businessName}* 🤖`,
    '',
    '❌ *No pudimos validar tu pago*',
    '',
    'No se pudo registrar la operación automáticamente. Por favor revisa los datos del pago o envía el comprobante para ayudarte.'
  ].join('\n')
}
