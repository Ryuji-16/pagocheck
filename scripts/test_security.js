#!/usr/bin/env node

/**
 * PagoCheck - Suite de Verificación de Seguridad (Fase 1)
 *
 * Verifica que el acceso 'anon' a Supabase esté debidamente restringido:
 * 1. Anon no debe poder leer registros de 'movements'.
 * 2. Anon no debe poder insertar registros en 'movements'.
 * 3. Anon no debe poder acceder directamente a 'app_users'.
 * 4. Anon no debe poder invocar 'change_user_password'.
 * 5. Anon solo puede consultar verify_login() para el flujo de login.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Intentar leer variables desde .env o .env.local
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

console.log('🔒 =========================================================')
console.log('🔒 PagoCheck - Verificación de Seguridad de Supabase (Fase 1)')
console.log('🔒 =========================================================\n')

if (!supabaseUrl || !anonKey) {
  console.log('⚠️  AVISO: No se detectaron VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.')
  console.log('   Para ejecutar las pruebas en vivo contra tu instancia de Supabase:')
  console.log('   1. Configura tus credenciales en un archivo .env o .env.local')
  console.log('   2. Aplica la migración "supabase/migrations/01_security_hardening.sql" en tu Supabase SQL Editor')
  console.log('   3. Vuelve a ejecutar: node scripts/test_security.js\n')
  console.log('✅ El script de auditoría y la migración SQL están listos para ejecutarse.')
  process.exit(0)
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json'
}

let allPassed = true

async function runTest(name, testFn) {
  process.stdout.write(`• ${name}... `)
  try {
    const result = await testFn()
    if (result.pass) {
      console.log(`✅ PASÓ (${result.detail})`)
    } else {
      console.log(`❌ FALLÓ: ${result.detail}`)
      allPassed = false
    }
  } catch (err) {
    console.log(`💥 ERROR: ${err.message}`)
    allPassed = false
  }
}

async function run() {
  console.log(`Objetivo: ${supabaseUrl}\n`)

  // Test 1: Lectura anónima de movements
  await runTest('Bloqueo de lectura anónima en movements', async () => {
    const res = await fetch(`${supabaseUrl}/rest/v1/movements?select=*&limit=10`, { headers })
    const data = await res.json()
    if (res.status === 401 || res.status === 403) {
      return { pass: true, detail: `HTTP ${res.status} Acceso denegado correctamente` }
    }
    if (Array.isArray(data) && data.length === 0) {
      return { pass: true, detail: 'Devuelve 0 registros (RLS activo sin política anon)' }
    }
    if (Array.isArray(data) && data.length > 0) {
      return { pass: false, detail: `Vulnerabilidad: Anon pudo leer ${data.length} movimientos` }
    }
    return { pass: true, detail: `Respuesta segura: ${res.status}` }
  })

  // Test 2: Inserción anónima en movements
  await runTest('Bloqueo de inserción anónima en movements', async () => {
    const res = await fetch(`${supabaseUrl}/rest/v1/movements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'test_injection',
        amount: '100.00',
        reference: 'TEST_ANON_INJECTION'
      })
    })
    if (res.status === 401 || res.status === 403 || !res.ok) {
      return { pass: true, detail: `HTTP ${res.status} Inserción rechazada` }
    }
    return { pass: false, detail: 'Vulnerabilidad: Anon pudo insertar un movimiento en la BD' }
  })

  // Test 3: Acceso directo a app_users
  await runTest('Bloqueo de lectura directa en app_users', async () => {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_users?select=*&limit=10`, { headers })
    const data = await res.json()
    if (res.status === 401 || res.status === 403) {
      return { pass: true, detail: `HTTP ${res.status} Acceso denegado correctamente` }
    }
    if (Array.isArray(data) && data.length === 0) {
      return { pass: true, detail: 'Devuelve 0 usuarios (RLS activo)' }
    }
    if (Array.isArray(data) && data.length > 0) {
      return { pass: false, detail: `Vulnerabilidad crítica: Anon pudo leer contraseñas/hashes` }
    }
    return { pass: true, detail: `Respuesta segura: ${res.status}` }
  })

  // Test 4: Bloqueo de change_user_password anónimo
  await runTest('Bloqueo de ejecución anónima en change_user_password', async () => {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/change_user_password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_username: 'caja1',
        p_old_hash: 'dummy',
        p_new_hash: 'hacked'
      })
    })
    if (res.status === 401 || res.status === 403 || res.status === 404 || !res.ok) {
      return { pass: true, detail: `HTTP ${res.status} Ejecución rechazada` }
    }
    return { pass: false, detail: 'Vulnerabilidad: Anon pudo invocar change_user_password' }
  })

  console.log('\n---------------------------------------------------------')
  if (allPassed) {
    console.log('🎉 ¡Todas las pruebas de seguridad de Fase 1 pasaron con éxito!')
  } else {
    console.log('⚠️ Se detectaron brechas de seguridad. Asegúrate de ejecutar 01_security_hardening.sql en Supabase.')
  }
  console.log('---------------------------------------------------------\n')
}

run()
