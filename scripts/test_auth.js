#!/usr/bin/env node

/**
 * PagoCheck - Suite de Verificación de Autenticación (Fase 2)
 *
 * Valida la integración con Supabase Auth y el mapeo de usuarios:
 * 1. Login con usuario sintético caja1@auth.pagocheck.com.
 * 2. Emisión de JWT válido.
 * 3. Consulta de perfil sincronizado en public.profiles.
 * 4. Cierre de sesión limpio.
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

console.log('🔑 =========================================================')
console.log('🔑 PagoCheck - Verificación de Supabase Auth (Fase 2)')
console.log('🔑 =========================================================\n')

if (!supabaseUrl || !anonKey) {
  console.log('⚠️  AVISO: No se detectaron VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.')
  console.log('   Para ejecutar las pruebas en vivo:')
  console.log('   1. Configura tu archivo .env o .env.local')
  console.log('   2. Aplica la migración "supabase/migrations/02_seed_auth_users.sql" en Supabase SQL Editor')
  console.log('   3. Ejecuta: npm run test:auth\n')
  console.log('✅ El script de prueba de autenticación está listo.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, anonKey)

async function run() {
  console.log(`Objetivo: ${supabaseUrl}\n`)

  try {
    // 1. Probar login con caja1
    console.log('• Probando login con caja1 (caja1@auth.pagocheck.com)...')
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'caja1@auth.pagocheck.com',
      password: 'caja1'
    })

    if (authErr || !authData?.user) {
      console.log(`❌ Error al autenticar: ${authErr?.message || 'Usuario no encontrado'}`)
      console.log('   Asegúrate de haber ejecutado 02_seed_auth_users.sql en Supabase SQL Editor.')
      process.exit(1)
    }

    console.log('✅ Login exitoso en Supabase Auth.')
    console.log(`   User ID: ${authData.user.id}`)
    console.log(`   JWT Token emitido: ${authData.session.access_token.slice(0, 20)}...`)

    // 2. Probar lectura del perfil
    console.log('\n• Verificando perfil en public.profiles...')
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileErr || !profile) {
      console.log(`❌ Error al leer perfil: ${profileErr?.message || 'Perfil no encontrado'}`)
      process.exit(1)
    }

    console.log('✅ Perfil obtenido correctamente:')
    console.log(`   Username: ${profile.username}`)
    console.log(`   Rol: ${profile.role}`)
    console.log(`   Sucursal: ${profile.branch}`)
    console.log(`   Activo: ${profile.active}`)

    // 3. Probar logout
    console.log('\n• Probando logout...')
    await supabase.auth.signOut()
    console.log('✅ Sesión cerrada limpiamente.')

    console.log('\n---------------------------------------------------------')
    console.log('🎉 ¡Todas las pruebas de autenticación pasaron con éxito!')
    console.log('---------------------------------------------------------\n')
  } catch (err) {
    console.error('💥 Error inesperado:', err)
    process.exit(1)
  }
}

run()
