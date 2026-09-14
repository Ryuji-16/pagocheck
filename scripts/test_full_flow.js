#!/usr/bin/env node

/**
 * PagoCheck - Suite de Pruebas Integrales de Flujo Completo E2E (Fase 10)
 *
 * Valida el ciclo de vida completo de la plataforma multi-sucursal:
 * 1. Flujo de Cajero: Login -> Verificación Pago Móvil (4 campos Banesco) -> Registro Historial -> Detección Anti-Duplicados -> Vuelto.
 * 2. Flujo de Supervisor de Sucursal: Aislamiento estricto de movimientos y auditoría por tienda.
 * 3. Flujo de Dueño de Empresa: Visión consolidada y métricas globales de observabilidad.
 * 4. Trazabilidad Inmutable: Medición de latencia y bitácora de auditoría en cada paso.
 */

import process from 'node:process'

// Mock de localStorage en memoria para ejecutar los servicios en Node.js
const memoryStore = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
  setItem: (k, v) => memoryStore.set(k, String(v)),
  removeItem: (k) => memoryStore.delete(k),
  clear: () => memoryStore.clear()
}

// Importar servicios del sistema
import { login, getSession } from '../src/services/authService.js'
import { verifyPayment, setVerificationProvider } from '../src/services/verificationService.js'
import { MockPaymentProvider } from '../src/services/providers/MockPaymentProvider.js'
import { saveMovement, listMovements, findMovementByReference } from '../src/services/historyService.js'
import { fetchAuditLogs, AUDIT_ACTIONS } from '../src/services/auditService.js'

console.log('🏁 =============================================================')
console.log('🏁 PagoCheck - Pruebas Integrales de Flujo Completo (Fase 10)')
console.log('🏁 =============================================================\n')

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
  // Configurar pasarela de pruebas con latencia simulada de 20ms
  const mockProvider = new MockPaymentProvider(20)
  setVerificationProvider(mockProvider)

  // =========================================================================
  // ETAPA 1: Flujo de Cajero en Sucursal (Tienda 1 - Bella Vista)
  // =========================================================================
  console.log('• [1/4] Simulando sesión y operaciones de Cajero (caja1 - Bella Vista)...')

  const cashierLogin = await login('caja1', 'caja1')
  assert(cashierLogin.ok === true, `Login exitoso para cajero: ${cashierLogin.session?.username}`)
  assert(cashierLogin.session?.branch === 'Tienda 1 (Bella Vista)', `Sucursal asignada: ${cashierLogin.session?.branch}`)
  assert(cashierLogin.session?.role === 'caja', `Rol asignado: ${cashierLogin.session?.role}`)

  const sessionCaja1 = getSession()

  // 1.1 Verificación de pago con los 4 campos exactos de la API Banesco
  const testRef = '002938475610'
  const verificationResult = await verifyPayment({
    reference: testRef,
    bank: '0134 — Banesco',
    phone: '04141234567',
    date: '13/09/2026'
  })

  assert(verificationResult.status === 'confirmed', `Pago móvil confirmado por pasarela bancaria`)
  assert(verificationResult.reference === testRef, `Referencia coincide: ${verificationResult.reference}`)
  assert(Boolean(verificationResult.amount), `Monto recibido desde pasarela: ${verificationResult.amount}`)

  // 1.2 Registro del pago confirmado en el historial
  const savePaymentResult = await saveMovement(
    {
      type: 'pago_movil',
      bank: '0134 — Banesco',
      reference: testRef,
      amount: verificationResult.amount,
      phone: '04141234567',
      status: 'confirmed',
      provider: 'mock'
    },
    sessionCaja1
  )

  assert(Boolean(savePaymentResult?.id), `Pago registrado exitosamente en historial de caja1`)

  // 1.3 Intento de reingreso de la misma referencia (Protección Anti-Duplicados)
  const dupCheck = await findMovementByReference(testRef, '0134 — Banesco')
  assert(Boolean(dupCheck), `findMovementByReference detectó referencia previa (${testRef})`)

  const duplicateAttempt = await saveMovement({
    type: 'pago_movil',
    bank: '0134 — Banesco',
    reference: testRef,
    amount: verificationResult.amount,
    status: 'confirmed'
  })
  assert(duplicateAttempt?.error === 'DUPLICATE_REFERENCE', `saveMovement bloqueó intento de inserción duplicada`)

  // 1.4 Emisión de un vuelto en la misma sucursal
  const saveVueltoResult = await saveMovement(
    {
      type: 'vuelto',
      bank: '0102 — Banco de Venezuela',
      reference: 'VUELTO_BV_001',
      amount: 'Bs. 45,00',
      phone: '04169876543',
      status: 'confirmed'
    },
    sessionCaja1
  )

  assert(Boolean(saveVueltoResult?.id), `Vuelto registrado exitosamente en historial de caja1`)

  // =========================================================================
  // ETAPA 2: Flujo de Cajero en Otra Sucursal (Tienda 2 - Altamira)
  // =========================================================================
  console.log('\n• [2/4] Simulando sesión de Cajero en otra sucursal (t2_caja1 - Altamira)...')

  const cashier2Login = await login('t2_caja1', 'caja1')
  assert(cashier2Login.ok === true, `Login exitoso para cajero 2: ${cashier2Login.session?.username}`)
  assert(cashier2Login.session?.branch === 'Tienda 2 (Altamira)', `Sucursal asignada: ${cashier2Login.session?.branch}`)

  const sessionCaja2 = getSession()

  const t2PaymentResult = await saveMovement(
    {
      type: 'pago_movil',
      bank: '0105 — Mercantil',
      reference: '007788991122',
      amount: 'Bs. 850,00',
      phone: '04245556677',
      status: 'confirmed',
      provider: 'mock'
    },
    sessionCaja2
  )
  assert(Boolean(t2PaymentResult?.id), `Pago de Tienda 2 registrado`)

  // =========================================================================
  // ETAPA 3: Aislamiento por Sucursal (Supervisor admin_t1)
  // =========================================================================
  console.log('\n• [3/4] Verificando aislamiento RBAC como Supervisor (admin_t1)...')

  const supervisorLogin = await login('admin_t1', 'admin1')
  assert(supervisorLogin.ok === true, `Login supervisor Tienda 1: ${supervisorLogin.session?.username}`)

  const sessionSupervisor = getSession()
  const supervisorMovements = await listMovements(sessionSupervisor)

  // El supervisor de Tienda 1 solo debe ver los movimientos de Tienda 1
  const containsOnlyT1 = supervisorMovements.every(
    (m) => (m.branch || m.tienda) === 'Tienda 1 (Bella Vista)'
  )
  assert(containsOnlyT1 === true, `Aislamiento estricto: Supervisor solo visualiza movimientos de Tienda 1 (${supervisorMovements.length} encontrados)`)

  const hasT2InT1 = supervisorMovements.some((m) => (m.branch || m.tienda) === 'Tienda 2 (Altamira)')
  assert(hasT2InT1 === false, `Movimientos de Tienda 2 no son visibles para el supervisor de Tienda 1`)

  // =========================================================================
  // ETAPA 4: Consolidado Total y Observabilidad (Dueño / Admin General)
  // =========================================================================
  console.log('\n• [4/4] Verificando consolidado y observabilidad como Dueño (admin)...')

  const ownerLogin = await login('admin', 'admin123')
  assert(ownerLogin.ok === true, `Login dueño general: ${ownerLogin.session?.username}`)

  const sessionOwner = getSession()
  const allMovements = await listMovements(sessionOwner)

  const hasT1 = allMovements.some((m) => (m.branch || m.tienda) === 'Tienda 1 (Bella Vista)')
  const hasT2 = allMovements.some((m) => (m.branch || m.tienda) === 'Tienda 2 (Altamira)')
  assert(hasT1 && hasT2, `Dueño visualiza movimientos consolidados de todas las sucursales (${allMovements.length} totales)`)

  // Verificar bitácora de auditoría forense
  const auditEntries = await fetchAuditLogs({ limit: 100 })
  assert(auditEntries.length >= 2, `Bitácora contiene eventos de auditoría registrados (${auditEntries.length} eventos)`)

  const confirmLog = auditEntries.find((l) => l.action === AUDIT_ACTIONS.VERIFY_CONFIRMED)
  assert(Boolean(confirmLog), `Evento de confirmación bancaria registrado en bitácora`)
  assert(typeof confirmLog?.duration_ms === 'number', `Latencia de respuesta bancaria medida: ${confirmLog?.duration_ms} ms`)

  console.log('\n-------------------------------------------------------------')
  if (allPassed) {
    console.log('🎉 FLUJO INTEGRAL E2E VERIFICADO AL 100% EXITOSAMENTE (Fase 10)')
    process.exit(0)
  } else {
    console.error('💥 FALLARON PRUEBAS EN EL FLUJO INTEGRAL')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Error fatal durante la prueba integral:', err)
  process.exit(1)
})
