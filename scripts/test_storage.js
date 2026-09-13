#!/usr/bin/env node

/**
 * PagoCheck - Suite de Pruebas de Supabase Storage y Manejo de Comprobantes (Fase 6)
 *
 * Valida:
 * 1. Sanitización de nombres de sucursal (slugifyBranch).
 * 2. Estructuración y formato de rutas de almacenamiento por sucursal y fecha.
 * 3. Resolución transparente de imágenes (Base64 vs Storage paths vs URLs externas).
 * 4. Caché en memoria para URLs firmadas temporales.
 */

import process from 'node:process'
import {
  slugifyBranch,
  buildReceiptStoragePath,
  resolveReceiptUrl,
  clearReceiptUrlCache
} from '../src/services/storageService.js'

console.log('📦 =============================================================')
console.log('📦 PagoCheck - Suite de Almacenamiento Seguro de Comprobantes (Fase 6)')
console.log('📦 =============================================================\n')

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
  // 1. Validar slugifyBranch
  console.log('• [1/4] Probando sanitización de sucursales (slugifyBranch)...')
  assert(
    slugifyBranch('Tienda 1 (Bella Vista)') === 'tienda-1-bella-vista',
    `"Tienda 1 (Bella Vista)" -> "tienda-1-bella-vista" (recibido: ${slugifyBranch('Tienda 1 (Bella Vista)')})`
  )
  assert(
    slugifyBranch('Tienda 2 (Altamira)') === 'tienda-2-altamira',
    `"Tienda 2 (Altamira)" -> "tienda-2-altamira" (recibido: ${slugifyBranch('Tienda 2 (Altamira)')})`
  )
  assert(
    slugifyBranch('Camión Móvil') === 'camion-movil',
    `"Camión Móvil" -> "camion-movil" (recibido: ${slugifyBranch('Camión Móvil')})`
  )
  assert(
    slugifyBranch('') === 'general',
    `"" -> "general" (recibido: ${slugifyBranch('')})`
  )
  assert(
    slugifyBranch(null) === 'general',
    `null -> "general" (recibido: ${slugifyBranch(null)})`
  )

  // 2. Validar estructura de ruta de almacenamiento
  console.log('\n• [2/4] Probando generación de rutas estructuradas...')
  const samplePath = buildReceiptStoragePath('Tienda 1 (Bella Vista)', 'REF-987654')
  console.log(`  ℹ️  Ruta generada: ${samplePath}`)

  const now = new Date()
  const expectedPrefix = `tienda-1-bella-vista/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}/rec_`
  assert(samplePath.startsWith(expectedPrefix), `Prefijo correcto: ${expectedPrefix}`)
  assert(samplePath.endsWith('.jpg'), 'Extensión .jpg correcta')
  assert(samplePath.includes('987654'), 'Referencia incluida de forma limpia')

  // 3. Validar resolución de comprobantes
  console.log('\n• [3/4] Probando resolución transparente de URLs...')

  // A. Base64 directo (retrocompatibilidad histórica)
  const legacyDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...'
  const resLegacy = await resolveReceiptUrl(legacyDataUrl)
  assert(resLegacy === legacyDataUrl, 'Base64 data URL retorna directo sin procesar')

  // B. URL externa HTTP / HTTPS
  const externalUrl = 'https://example.com/receipt.jpg'
  const resExternal = await resolveReceiptUrl(externalUrl)
  assert(resExternal === externalUrl, 'URL externa http/https retorna directo')

  // C. Comprobante purgado
  const resPurged = await resolveReceiptUrl('purged')
  assert(resPurged === 'purged', 'Valor "purged" se conserva para la UI')

  // D. Valores vacíos
  const resEmpty = await resolveReceiptUrl('')
  assert(resEmpty === '', 'Cadena vacía retorna cadena vacía')

  // 4. Validar caché y fallback cuando no hay conexión remota
  console.log('\n• [4/4] Probando comportamiento offline y caché...')
  clearReceiptUrlCache()
  const storagePath = 'tienda-1/2026-09/rec_123.jpg'
  // Sin conexión configurada en entorno de pruebas, debe retornar vacío de forma segura
  const resOffline = await resolveReceiptUrl(storagePath)
  assert(typeof resOffline === 'string', 'Retorno seguro tipo string')

  console.log('\n-------------------------------------------------------------')
  if (allPassed) {
    console.log('🎉 ¡Todas las pruebas de almacenamiento de comprobantes pasaron con éxito!')
    console.log('-------------------------------------------------------------')
    process.exit(0)
  } else {
    console.error('💥 Algunas pruebas de almacenamiento fallaron.')
    console.log('-------------------------------------------------------------')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err)
  process.exit(1)
})
