// Supabase Edge Function: verify-payment
// Ejecución server-side segura para verificación bancaria

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // 1. Manejo de CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Validar autenticación del cliente (JWT obligatorio)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, status: 'error', message: 'No autorizado: falta cabecera de autenticación.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, status: 'error', message: 'Sesión no válida o expirada.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Extraer y validar el payload de la transacción
    const body = await req.json()
    const reference = String(body.reference || '').trim()
    const bank = String(body.bank || 'Banesco').trim()
    const amount = body.amount || ''
    const phone = body.phone || ''
    const date = body.date || new Date().toISOString()

    if (!reference) {
      return new Response(
        JSON.stringify({ ok: false, status: 'error', message: 'El número de referencia es obligatorio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Conectar con el proveedor bancario (Secretos seguros en el servidor)
    const banescoApiUrl = Deno.env.get('BANESCO_API_URL')
    const banescoApiKey = Deno.env.get('BANESCO_API_KEY')

    // Si existen credenciales reales configuradas en las variables del servidor:
    if (banescoApiUrl && banescoApiKey) {
      // Llamada real a la API del banco
      const bankRes = await fetch(`${banescoApiUrl}/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${banescoApiKey}`
        },
        body: JSON.stringify({ reference, bank, amount, phone, date })
      })

      const bankData = await bankRes.json()
      return new Response(
        JSON.stringify(bankData),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Fallback server-side a simulación controlada (Modo desarrollo/staging)
    if (reference === '111111111') {
      return new Response(
        JSON.stringify({
          ok: false,
          status: 'not-found',
          code: 'NOT_FOUND',
          message: 'La transacción no pudo ser localizada en el banco.',
          reference,
          bank,
          provider: 'banesco-edge-mock'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (reference === '999999999') {
      return new Response(
        JSON.stringify({
          ok: false,
          status: 'error',
          code: 'BANK_TIMEOUT',
          message: 'Error al procesar la operación en la red bancaria.',
          reference,
          bank,
          provider: 'banesco-edge-mock'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Éxito en la verificación
    return new Response(
      JSON.stringify({
        ok: true,
        status: 'confirmed',
        amount: amount || 'Bs. 150,00',
        reference,
        date,
        bank,
        phone,
        provider: 'banesco-edge-mock'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'error',
        message: `Error interno en Edge Function: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
