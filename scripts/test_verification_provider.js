#!/usr/bin/env node

/**
 * PagoCheck - Suite de Verificación de Arquitectura de Proveedores (Fases 5 y 7)
 *
 * Valida que la interfaz y adaptadores de verificación bancaria funcionen según el contrato:
 * 1. MockPaymentProvider confirma pagos normales.
 * 2. MockPaymentProvider devuelve 'not-found' para referencia 111111111.
 * 3. MockPaymentProvider devuelve 'error' para referencia 999999999.
 * 4. verificationService normaliza todas las respuestas al estándar de PagoCheck.
 */

import process from 'node:process'
import { MockPaymentProvider } from '../src/services/providers/MockPaymentProvider.js'
import { verifyPayment, setVerificationProvider } from '../src/services/verificationService.js'

console.log('🏦 =============================================================')
console.log('🏦 PagoCheck - Verificación de Adaptadores Bancarios (Fases 5 y 7)')
console.log('🏦 =============================================================\n')

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
  // Instanciar mock con delay 0 para pruebas rápidas
  const mock = new MockPaymentProvider(0)
  setVerificationProvider(mock)

  // 1. Probar pago exitoso
  console.log('• [1/3] Probando verificación exitosa...')
  const resSuccess = await verifyPayment({
    reference: 'REF_TEST_100',
    bank: 'Banesco',
    amount: 'Bs. 250,00',
    phone: '04121234567'
  })

  assert(resSuccess.status === 'confirmed', `Estado esperado 'confirmed', recibido '${resSuccess.status}'`)
  assert(resSuccess.reference === 'REF_TEST_100', `Referencia coincide: ${resSuccess.reference}`)
  assert(resSuccess.provider === 'mock', `Proveedor identificado: ${resSuccess.provider}`)

  // 2. Probar pago no encontrado (111111111)
  console.log('\n• [2/3] Probando pago no encontrado (111111111)...')
  const resNotFound = await verifyPayment({
    reference: '111111111',
    bank: 'Banesco'
  })

  assert(resNotFound.status === 'not-found', `Estado esperado 'not-found', recibido '${resNotFound.status}'`)
  assert(resNotFound.code === 'NOT_FOUND', `Código recibido: ${resNotFound.code}`)
  assert(Boolean(resNotFound.message), `Mensaje de error presente: "${resNotFound.message}"`)

  // 3. Probar error de banco (999999999)
  console.log('\n• [3/3] Probando error de comunicación bancaria (999999999)...')
  const resError = await verifyPayment({
    reference: '999999999',
    bank: 'Banesco'
  })

  assert(resError.status === 'error', `Estado esperado 'error', recibido '${resError.status}'`)
  assert(resError.code === 'BANK_TIMEOUT', `Código recibido: ${resError.code}`)

  console.log('\n-------------------------------------------------------------')
  if (allPassed) {
    console.log('🎉 ¡Todas las pruebas de adaptadores bancarios pasaron con éxito!')
  } else {
    console.log('⚠️ Se detectaron fallas en la normalización de proveedores.')
    process.exit(1)
  }
  console.log('-------------------------------------------------------------\n')
}

run()
