#!/usr/bin/env node

/**
 * PagoCheck - Suite de Verificación de Integridad y Anti-Duplicados (Fase 4)
 *
 * Valida que PostgreSQL actúe como autoridad final contra pagos duplicados:
 * 1. Inserta una transacción confirmada con referencia de prueba.
 * 2. Intenta insertar una segunda transacción con el mismo banco y referencia.
 * 3. Valida que PostgreSQL rechace el duplicado (Unique Constraint Violation).
 * 4. Limpia los registros de prueba.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env')
  ]

  const env = { ...process.env }

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...v] = trimmed.split('=')
          env[k.trim()] = v.join('=').trim()
        }
      })
    }
  }
  return env
}

const env = loadEnv()
const supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const anonKey = env.VITE_SUPABASE_ANON_KEY || ''

console.log('🛡️  =============================================================')
console.log('🛡️  PagoCheck - Verificación de Anti-Duplicados en DB (Fase 4)')
console.log('🛡️  =============================================================\n')

if (!supabaseUrl || !anonKey) {
  console.log('⚠️  AVISO: No se detectaron VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.')
  console.log('   Para ejecutar las pruebas en vivo contra tu instancia de Supabase:')
  console.log('   1. Configura tu archivo .env o .env.local')
  console.log('   2. Aplica la migración "supabase/migrations/04_db_integrity_and_duplicates.sql" en Supabase')
  console.log('   3. Ejecuta: npm run test:integrity\n')
  console.log('✅ El script de prueba de integridad está listo.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, anonKey)

async function run() {
  console.log(`Objetivo: ${supabaseUrl}\n`)

  try {
    // Autenticar como Dueño para realizar la prueba
    console.log('• Autenticando como Dueño (admin@auth.pagocheck.com)...')
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@auth.pagocheck.com',
      password: 'admin123'
    })

    if (authErr || !authData?.user) {
      console.log(`❌ Error al autenticar: ${authErr?.message}`)
      process.exit(1)
    }

    console.log('  ✅ Autenticado con éxito.')

    const testRef = `DUPTEST_${Date.now()}`
    const testBank = 'Banesco'

    // 1. Inserción del primer pago confirmado
    console.log(`\n• [1/2] Insertando pago original legítimo (Ref: ${testRef}, Banco: ${testBank})...`)
    const { data: firstInsert, error: firstErr } = await supabase.from('movements').insert({
      username: 'admin',
      label: 'Dueño / Admin General',
      branch: 'Tienda 1 (Bella Vista)',
      type: 'validacion',
      status: 'confirmed',
      amount: '150.00',
      reference: testRef,
      bank: testBank,
      provider: 'banesco'
    }).select().single()

    if (firstErr) {
      console.log(`❌ Error al insertar pago original: ${firstErr.message}`)
      process.exit(1)
    }

    console.log(`  ✅ Pago original guardado con éxito (ID: ${firstInsert.id}).`)

    // 2. Intento de insertar un duplicado con la misma referencia y banco
    console.log(`\n• [2/2] Intentando insertar duplicado del mismo pago (Ref: ${testRef}, Banco: ${testBank})...`)
    const { error: dupErr } = await supabase.from('movements').insert({
      username: 'admin',
      label: 'Dueño / Admin General',
      branch: 'Tienda 1 (Bella Vista)',
      type: 'validacion',
      status: 'confirmed',
      amount: '150.00',
      reference: testRef,
      bank: testBank,
      provider: 'banesco'
    })

    if (dupErr) {
      console.log('  ✅ PROTEGIDO POR POSTGRESQL: La base de datos bloqueó el pago duplicado.')
      console.log(`     Código/Mensaje: ${dupErr.message}`)
    } else {
      console.log('  ❌ VULNERABILIDAD: Se permitió registrar un pago con la misma referencia y banco.')
      process.exit(1)
    }

    // 3. Limpiar registro de prueba
    console.log('\n• Limpiando registro de prueba...')
    await supabase.from('movements').delete().eq('id', firstInsert.id)
    console.log('  ✅ Limpieza completada.')

    await supabase.auth.signOut()

    console.log('\n-------------------------------------------------------------')
    console.log('🎉 ¡Prueba de integridad y anti-duplicados aprobada con éxito!')
    console.log('-------------------------------------------------------------\n')
  } catch (err) {
    console.error('💥 Error inesperado:', err)
    process.exit(1)
  }
}

run()
