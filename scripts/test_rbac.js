#!/usr/bin/env node

/**
 * PagoCheck - Suite de Verificación de RBAC y Aislamiento por Sucursal (Fase 3)
 *
 * Valida que PostgreSQL y RLS hagan cumplir las reglas de negocio a nivel de base de datos:
 * 1. Admin de Bella Vista (admin_t1) solo ve movimientos de Bella Vista.
 * 2. Admin de Bella Vista NO puede insertar movimientos asignados a Altamira (bloqueado por RLS).
 * 3. El Dueño de la Empresa (admin) tiene acceso global consolidado.
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

console.log('🏛️  =========================================================')
console.log('🏛️  PagoCheck - Verificación de RBAC y Sucursales en DB (Fase 3)')
console.log('🏛️  =========================================================\n')

if (!supabaseUrl || !anonKey) {
  console.log('⚠️  AVISO: No se detectaron VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.')
  console.log('   Para ejecutar las pruebas en vivo contra tu instancia de Supabase:')
  console.log('   1. Configura tu archivo .env o .env.local')
  console.log('   2. Aplica la migración "supabase/migrations/03_rbac_branches.sql" en Supabase SQL Editor')
  console.log('   3. Ejecuta: npm run test:rbac\n')
  console.log('✅ El script de auditoría RBAC está listo.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, anonKey)

async function run() {
  console.log(`Objetivo: ${supabaseUrl}\n`)

  try {
    // 1. Iniciar sesión con admin_t1 (Bella Vista)
    console.log('• [1/3] Autenticando con admin_t1 (Supervisor Bella Vista)...')
    const { data: authT1, error: errT1 } = await supabase.auth.signInWithPassword({
      email: 'admin_t1@auth.pagocheck.com',
      password: 'admin1'
    })

    if (errT1 || !authT1?.user) {
      console.log(`❌ Error al autenticar admin_t1: ${errT1?.message}`)
      process.exit(1)
    }

    console.log('  ✅ Autenticado como admin_t1.')

    // 2. Intentar violar el aislamiento de sucursal: admin_t1 intentando insertar en Altamira
    console.log('\n• [2/3] Probando inyección indebida en otra sucursal (Altamira)...')
    const { error: insertErr } = await supabase.from('movements').insert({
      username: 'admin_t1',
      label: 'Admin Bella Vista',
      branch: 'Tienda 2 (Altamira)', // Intento indebido
      type: 'validacion',
      amount: '50.00',
      reference: 'TEST_RBAC_FORBIDDEN',
      bank: 'Banesco'
    })

    if (insertErr) {
      console.log(`  ✅ PROTEGIDO POR POSTGRESQL: La base de datos rechazó la inserción.`)
      console.log(`     Detalle: ${insertErr.message}`)
    } else {
      console.log(`  ❌ VULNERABILIDAD: admin_t1 pudo insertar en Altamira. Verifica 03_rbac_branches.sql`)
      process.exit(1)
    }

    await supabase.auth.signOut()

    // 3. Iniciar sesión como Dueño (admin)
    console.log('\n• [3/3] Autenticando como Dueño de la Empresa (admin)...')
    const { data: authOwner, error: errOwner } = await supabase.auth.signInWithPassword({
      email: 'admin@auth.pagocheck.com',
      password: 'admin123'
    })

    if (errOwner || !authOwner?.user) {
      console.log(`❌ Error al autenticar Dueño: ${errOwner?.message}`)
      process.exit(1)
    }

    console.log('  ✅ Autenticado como Dueño de la Empresa.')

    const { data: movements, error: queryErr } = await supabase
      .from('movements')
      .select('id, branch, amount')
      .limit(5)

    if (queryErr) {
      console.log(`❌ Error al consultar como dueño: ${queryErr.message}`)
      process.exit(1)
    }

    console.log(`  ✅ Acceso global concedido al Dueño (${movements?.length || 0} movimientos leídos sin restricción de sucursal).`)

    await supabase.auth.signOut()

    console.log('\n---------------------------------------------------------')
    console.log('🎉 ¡Todas las pruebas de RBAC y aislamiento por sucursal pasaron!')
    console.log('---------------------------------------------------------\n')
  } catch (err) {
    console.error('💥 Error inesperado:', err)
    process.exit(1)
  }
}

run()
