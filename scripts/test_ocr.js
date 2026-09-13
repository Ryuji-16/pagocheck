#!/usr/bin/env node

/**
 * PagoCheck - Suite de Pruebas de Normalización y Validación OCR (Fase 8)
 *
 * Valida:
 * 1. Extracción de referencias completas sin truncamiento y corrección de caracteres OCR (O/0).
 * 2. Normalización de montos en bolívares (Bs. 1.250,50).
 * 3. Identificación precisa de bancos emisores (Banesco, BDV, Mercantil, Provincial, Bancamiga).
 * 4. Extracción de números de teléfono móvil emisor (0412, 0414, 0424, 0416, 0426).
 * 5. Evaluación de completitud, confianza y campos faltantes (validatePaymentData).
 */

import process from 'node:process'
import {
  parsePaymentText,
  validatePaymentData,
  cleanOcrDigits
} from '../src/services/ocrService.js'

console.log('🔍 =============================================================')
console.log('🔍 PagoCheck - Suite de Pruebas de Motor OCR y Parseo (Fase 8)')
console.log('🔍 =============================================================\n')

let allPassed = true

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`)
  } else {
    console.log(`  ❌ FALLÓ: ${message}`)
    allPassed = false
  }
}

async function run() {
  // 1. Prueba de Sanitización de Caracteres OCR en dígitos
  console.log('• [1/6] Probando limpieza de caracteres ambiguos (cleanOcrDigits)...')
  assert(cleanOcrDigits('O12345') === '012345', `'O12345' -> '012345' (recibido: ${cleanOcrDigits('O12345')})`)
  assert(cleanOcrDigits('l234S6') === '123456', `'l234S6' -> '123456' (recibido: ${cleanOcrDigits('l234S6')})`)
  assert(cleanOcrDigits('REF-987O21') === '987021', `'REF-987O21' -> '987021' (recibido: ${cleanOcrDigits('REF-987O21')})`)

  // 2. Comprobante Banesco Pago Móvil
  console.log('\n• [2/6] Probando comprobante Banesco Pago Móvil...')
  const banescoText = `
    Banesco Banco Universal
    PagoMóvil Banesco
    ¡Operación Exitosa!
    Nro. de Referencia: 001294857102
    Fecha: 12/09/2026 14:30
    Monto: Bs. 1.450,00
    Teléfono de Origen: 0414-1234567
    Banco Receptor: 0134 - Banesco
    Teléfono Destino: 0424-9876543
  `
  const banescoRes = parsePaymentText(banescoText)
  assert(banescoRes.reference === '001294857102', `Referencia completa sin truncar: ${banescoRes.reference}`)
  assert(banescoRes.bank.includes('Banesco'), `Banco detectado Banesco: ${banescoRes.bank}`)
  assert(banescoRes.amount === 'Bs. 1.450,00', `Monto normalizado: ${banescoRes.amount}`)
  assert(banescoRes.phone === '0414-1234567', `Teléfono emisor: ${banescoRes.phone}`)
  assert(banescoRes.validation.isComplete === true, 'Comprobante marcado como completo')
  assert(banescoRes.validation.confidence === 100, `Confianza 100%: ${banescoRes.validation.confidence}`)

  // 3. Comprobante Banco de Venezuela (BDV)
  console.log('\n• [3/6] Probando comprobante Banco de Venezuela (BDV)...')
  const bdvText = `
    Banco de Venezuela
    PagoMóvilBDV
    Comprobante de Pago
    Referencia: 987654321
    Monto: 350,50 Bs
    Teléfono: 0412-5551234
    Fecha: 13 de septiembre de 2026
  `
  const bdvRes = parsePaymentText(bdvText)
  assert(bdvRes.reference === '987654321', `Referencia BDV: ${bdvRes.reference}`)
  assert(bdvRes.bank.includes('Venezuela'), `Banco detectado Venezuela: ${bdvRes.bank}`)
  assert(bdvRes.amount === 'Bs. 350,50', `Monto normalizado: ${bdvRes.amount}`)
  assert(bdvRes.date === '13/09/2026', `Fecha nombrada convertida: ${bdvRes.date}`)

  // 4. Comprobante Mercantil (TPago) con corrección OCR
  console.log('\n• [4/6] Probando comprobante Mercantil TPago con corrección OCR...')
  const mercantilText = `
    Mercantil Banco
    Tpago
    Operación Aprobada
    Ref: O184920
    Monto de la operación: Bs. 80,00
    Nro Celular de Origen: 0424-3334455
    Fecha: 10/09/2026
  `
  const mercantilRes = parsePaymentText(mercantilText)
  assert(mercantilRes.reference === '0184920', `Referencia con 'O' convertida a '0': ${mercantilRes.reference}`)
  assert(mercantilRes.bank.includes('Mercantil'), `Banco detectado Mercantil: ${mercantilRes.bank}`)
  assert(mercantilRes.amount === 'Bs. 80,00', `Monto normalizado: ${mercantilRes.amount}`)

  // 5. Comprobante BBVA Provincial y Bancamiga
  console.log('\n• [5/8] Probando comprobante BBVA Provincial y Bancamiga...')
  const provincialText = `
    BBVA Provincial
    Nº de operación: 54321098
    Importe: 2.100,00 Bs.
    Teléfono móvil: 0416-7778899
    Fecha: 11/09/2026
  `
  const provincialRes = parsePaymentText(provincialText)
  assert(provincialRes.reference === '54321098', `Referencia Provincial: ${provincialRes.reference}`)
  assert(provincialRes.bank.includes('Provincial'), `Banco detectado Provincial: ${provincialRes.bank}`)

  const bancamigaText = `
    Bancamiga Banco Universal
    Pago Móvil Bancamiga
    Secuencia: 778899
    Monto: Bs. 620,00
    Teléfono: 0426-9990011
    Fecha: 12/09/2026
  `
  const bancamigaRes = parsePaymentText(bancamigaText)
  assert(bancamigaRes.reference === '778899', `Secuencia Bancamiga: ${bancamigaRes.reference}`)
  assert(bancamigaRes.bank.includes('Bancamiga'), `Banco detectado Bancamiga: ${bancamigaRes.bank}`)

  // 6. Comprobante Ubii / Pago Móvil (caso real reportado por el usuario)
  console.log('\n• [6/8] Probando comprobante Ubii / Pago Móvil (Venezolano de Crédito)...')
  const ubiiText = `
    RETIRO PAGO MOVIL
    Bs. 1.162,33

    Fechay Hora 10 agosto 2026 0147 pr
    Referencia 000000755544 C)
    ies BANCARIGE
    Número (0424) 271-24-08
    códula 1-306725024
    Banco origen VENEZOLANO DE CRÉDITO
    Cuenta/Teléfono (0414) 269-83-01
    códula vasena7s
  `
  const ubiiRes = parsePaymentText(ubiiText)
  assert(ubiiRes.reference === '000000755544', `Referencia Ubii exacta: ${ubiiRes.reference}`)
  assert(ubiiRes.bank.includes('Venezolano de Crédito'), `Banco emisor Ubii detectado: ${ubiiRes.bank}`)
  assert(ubiiRes.date === '10/08/2026', `Fecha Ubii parseada: ${ubiiRes.date}`)
  assert(ubiiRes.amount === 'Bs. 1.162,33', `Monto Ubii extraído: ${ubiiRes.amount}`)
  assert(ubiiRes.phone === '0414-2698301', `Teléfono emisor Ubii (no destino): ${ubiiRes.phone}`)
  assert(ubiiRes.validation.isComplete === true, 'Comprobante Ubii 100% completo')
  assert(ubiiRes.validation.confidence === 100, `Confianza 100%: ${ubiiRes.validation.confidence}`)

  // 7. Pruebas de robustez contra ruido OCR (ruido de 13 dígitos y fechas erróneas de teléfonos)
  console.log('\n• [7/8] Probando robustez contra ruido OCR (13 dígitos y fragmentos telefónicos)...')
  const noisyRefText = `Referencia 2000000755544 C)`
  const noisyRefRes = parsePaymentText(noisyRefText)
  assert(noisyRefRes.reference === '000000755544', `Ruido inicial '2' eliminado de RRN de 12 dígitos: ${noisyRefRes.reference}`)

  const phoneAsDateText = `Número (0424) 21-24-08 Fechay Hora 10 agosto 2026`
  const phoneAsDateRes = parsePaymentText(phoneAsDateText)
  assert(phoneAsDateRes.date === '10/08/2026', `Fragmento de teléfono 21-24-08 descartado en favor de fecha real: ${phoneAsDateRes.date}`)

  const ocrTypoPhoneText = `Banco origen VENEZOLANO DE CRÉDITO Cuenta/reléfono (0414) 269-83-O1`
  const ocrTypoPhoneRes = parsePaymentText(ocrTypoPhoneText)
  assert(ocrTypoPhoneRes.phone === '0414-2698301', `Teléfono con 'reléfono' y letra 'O' corregido: ${ocrTypoPhoneRes.phone}`)

  const multiSectionText = `banco destino BANCARIBE Número [E códula 4306725024 banco origen VENEZOLANO DE CRÉDITO Cuentafreléfono (0414) 269-83-01`
  const multiSectionRes = parsePaymentText(multiSectionText)
  assert(multiSectionRes.phone === '0414-2698301', `Teléfono pagador con banco destino previo y Cuentafreléfono: ${multiSectionRes.phone}`)

  // 8. Validación de Campos Faltantes y Calificación de Calidad (4 campos requeridos por Banesco)
  console.log('\n• [8/8] Probando evaluación de campos faltantes y advertencias (API Banesco)...')
  const partialData = {
    reference: '123456',
    bank: '0134 — Banesco'
    // Faltan phone, date (amount ya no es requerido como input)
  }
  const valResult = validatePaymentData(partialData)
  assert(valResult.isValid === true, 'Es válido para procesar (tiene referencia y banco)')
  assert(valResult.isComplete === false, 'Detecta correctamente que no está completo')
  assert(valResult.missingFields.includes('phone'), 'Identifica que falta el teléfono')
  assert(valResult.missingFields.includes('date'), 'Identifica que falta la fecha')
  assert(!valResult.missingFields.includes('amount'), 'Monto ya no es un campo bloqueante/faltante')
  assert(valResult.confidence === 60, `Cálculo de confianza proporcional: ${valResult.confidence}%`)

  console.log('\n-------------------------------------------------------------')
  if (allPassed) {
    console.log('🎉 ¡Todas las pruebas del motor OCR pasaron con éxito!')
    console.log('-------------------------------------------------------------')
    process.exit(0)
  } else {
    console.error('💥 Algunas pruebas de OCR fallaron.')
    console.log('-------------------------------------------------------------')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err)
  process.exit(1)
})
