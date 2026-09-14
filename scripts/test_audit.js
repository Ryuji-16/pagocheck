#!/usr/bin/env node

/**
 * PagoCheck - Suite de Verificación de Auditoría y Observabilidad (Fase 9)
 *
 * Valida:
 * 1. Generación y estructura de eventos de auditoría inmutables (recordAuditEvent).
 * 2. Medición y persistencia de latencia de red / pasarela bancaria en milisegundos.
 * 3. Filtrado por acción, estado y sucursal (fetchAuditLogs).
 * 4. Trazabilidad integrada al verificar pagos y detectar duplicados en verificationService.
 */

import process from 'node:process'
import { recordAuditEvent, fetchAuditLogs, AUDIT_ACTIONS } from '../src/services/auditService.js'
import { verifyPayment, setVerificationProvider } from '../src/services/verificationService.js'
import { MockPaymentProvider } from '../src/services/providers/MockPaymentProvider.js'

console.log('📜 =============================================================')
console.log('📜 PagoCheck - Pruebas de Auditoría y Observabilidad (Fase 9)')
console.log('📜 =============================================================\n')

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
  // 1. Estructura y campos obligatorios de eventos de auditoría
  console.log('• [1/4] Probando estructura de evento en recordAuditEvent()...')
  const entry = await recordAuditEvent({
    action: AUDIT_ACTIONS.VERIFY_CONFIRMED,
    entityType: 'payment',
    entityId: 'REF_TEST_AUDIT_1',
    status: 'success',
    details: { bank: '0134 - Banesco', amount: 350.5 },
    durationMs: 42.8
  })

  assert(Boolean(entry.id), `ID único generado: ${entry.id}`)
  assert(Boolean(entry.created_at), `Timestamp ISO generado: ${entry.created_at}`)
  assert(entry.action === AUDIT_ACTIONS.VERIFY_CONFIRMED, `Acción registrada: ${entry.action}`)
  assert(entry.entity_id === 'REF_TEST_AUDIT_1', `Entity ID registrado: ${entry.entity_id}`)
  assert(entry.status === 'success', `Estado registrado: ${entry.status}`)
  assert(entry.duration_ms === 43, `Latencia redondeada a ms entero: ${entry.duration_ms} ms`)
  assert(entry.details?.bank === '0134 - Banesco', `Metadatos estructurados preservados`)

  // 2. Consulta y filtrado de bitácora en memoria local (fallback)
  console.log('\n• [2/4] Probando fetchAuditLogs() con filtros...')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED,
    entityType: 'payment',
    entityId: 'REF_DUP_AUDIT',
    status: 'warning',
    details: { reason: 'Referencia ya registrada' }
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VUELTO_ISSUED,
    entityType: 'vuelto',
    entityId: 'VUELTO_999',
    status: 'success',
    details: { amount: 50.0 }
  })

  const allLogs = await fetchAuditLogs()
  assert(allLogs.length >= 3, `Se recuperaron múltiples logs (${allLogs.length} logs)`)

  const dupLogs = await fetchAuditLogs({ action: AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED })
  assert(
    dupLogs.every((l) => l.action === AUDIT_ACTIONS.VERIFY_DUPLICATE_BLOCKED),
    `Filtro por acción VERIFY_DUPLICATE_BLOCKED funciona (${dupLogs.length} encontrados)`
  )

  const warningLogs = await fetchAuditLogs({ status: 'warning' })
  assert(
    warningLogs.every((l) => l.status === 'warning'),
    `Filtro por estado 'warning' funciona (${warningLogs.length} encontrados)`
  )

  // 3. Trazabilidad integrada en verificationService con MockPaymentProvider
  console.log('\n• [3/4] Probando trazabilidad automática en verificationService...')
  const mock = new MockPaymentProvider(15) // Simula 15ms de latencia bancaria
  setVerificationProvider(mock)

  const verifyRes = await verifyPayment({
    reference: 'REF_INTEG_AUDIT_77',
    bank: 'Banesco',
    amount: 'Bs. 120,00',
    phone: '04141234567'
  })

  assert(verifyRes.status === 'confirmed', `Verificación exitosa procesada`)

  const verifiedLogs = await fetchAuditLogs({ action: AUDIT_ACTIONS.VERIFY_CONFIRMED })
  const matchingLog = verifiedLogs.find((l) => l.entity_id === 'REF_INTEG_AUDIT_77')

  assert(Boolean(matchingLog), `Se encontró log automático para referencia 'REF_INTEG_AUDIT_77'`)
  assert(typeof matchingLog?.duration_ms === 'number', `Latencia de verificación registrada: ${matchingLog?.duration_ms} ms`)
  assert(matchingLog?.details?.provider === 'mock', `Proveedor registrado en detalles: ${matchingLog?.details?.provider}`)

  // 4. Medición y trazabilidad de pagos no encontrados
  console.log('\n• [4/4] Probando trazabilidad de pago no encontrado (111111111)...')
  const notFoundRes = await verifyPayment({
    reference: '111111111',
    bank: 'Banesco'
  })
  assert(notFoundRes.status === 'not-found', `Estado not-found confirmado`)

  const notFoundLogs = await fetchAuditLogs({ action: AUDIT_ACTIONS.VERIFY_NOT_FOUND })
  const matchingNotFound = notFoundLogs.find((l) => l.entity_id === '111111111')
  assert(Boolean(matchingNotFound), `Se encontró log de VERIFY_NOT_FOUND para referencia 111111111`)
  assert(matchingNotFound?.status === 'warning', `Estado del log de no encontrado es 'warning'`)

  console.log('\n-------------------------------------------------------------')
  if (allPassed) {
    console.log('🎉 TODAS LAS PRUEBAS DE AUDITORÍA PASARON EXITOSAMENTE (Fase 9)')
    process.exit(0)
  } else {
    console.error('💥 ALGUNAS PRUEBAS DE AUDITORÍA FALLARON')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err)
  process.exit(1)
})
