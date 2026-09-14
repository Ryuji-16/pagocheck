import { getTenantConfig } from '../config/tenantConfig.js'
import { isRemoteDbEnabled, supabase } from './supabaseClient.js'

const SESSION_KEY = 'pagocheck-session'

const tenantConfig = getTenantConfig()
const botConfig = tenantConfig.bot || {}

// Metadatos de cuentas operativas del sistema (exclusivamente para UI y sandbox de desarrollo)
// Las contraseñas NO existen en el frontend bajo ningún concepto.
const ACCOUNT_METADATA = {
  // Tienda 1 (Bella Vista)
  admin_t1: { role: 'admin', label: 'Admin Bella Vista', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Supervisor Sucursal', icon: 'supervisor_account' },
  caja1: { role: 'caja', label: 'Caja 1', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Mostrador', icon: 'point_of_sale' },
  caja2: { role: 'caja', label: 'Caja 2', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Salón', icon: 'table_restaurant' },
  caja3: { role: 'caja', label: 'Caja 3', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Barra / Terraza', icon: 'local_bar' },
  // Tienda 2 (Altamira)
  admin_t2: { role: 'admin', label: 'Admin Altamira', branch: 'Tienda 2 (Altamira)', subtitle: 'Supervisor Sucursal', icon: 'supervisor_account' },
  t2_caja1: { role: 'caja', label: 'Caja 1', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Principal', icon: 'point_of_sale' },
  t2_caja2: { role: 'caja', label: 'Caja 2', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Mostrador', icon: 'table_restaurant' },
  t2_caja3: { role: 'caja', label: 'Caja 3', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Rápida', icon: 'local_bar' },
  // Tienda 3 (La Trinidad)
  admin_t3: { role: 'admin', label: 'Admin La Trinidad', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Supervisor Sucursal', icon: 'supervisor_account' },
  t3_caja1: { role: 'caja', label: 'Caja 1', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Principal', icon: 'point_of_sale' },
  t3_caja2: { role: 'caja', label: 'Caja 2', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Mostrador', icon: 'table_restaurant' },
  t3_caja3: { role: 'caja', label: 'Caja 3', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Rápida', icon: 'local_bar' },
  // Camión Móvil
  admin_camion: { role: 'admin', label: 'Admin Camión', branch: 'Camión Móvil', subtitle: 'Supervisor Ruta Móvil', icon: 'supervisor_account' },
  camion_caja1: { role: 'caja', label: 'Caja Móvil', branch: 'Camión Móvil', subtitle: 'Terminal Ruta', icon: 'local_shipping' },
  // Servicios / Bot (WhatsApp / Delivery)
  [botConfig.serviceUsername || 'bot_service']: {
    role: 'bot',
    label: botConfig.serviceLabel || 'Asistente WhatsApp',
    branch: botConfig.branch || 'WhatsApp / Delivery',
    subtitle: 'Servicios / Bot',
    icon: 'smart_toy'
  },
  // Dueño de la Empresa (Administrador General de todas las sucursales)
  admin: { role: 'admin', label: 'Dueño / Admin General', branch: '', subtitle: 'Dueño de la Empresa / Consolidado Total', icon: 'shield_person' }
}

/**
 * Determina si el entorno actual es de desarrollo o pruebas locales.
 */
function isDevEnvironment() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return Boolean(import.meta.env.DEV)
  }
  const proc = typeof globalThis !== 'undefined' ? globalThis.process : undefined
  if (proc && proc.env) {
    return proc.env.NODE_ENV !== 'production'
  }
  return false
}

/**
 * Convierte un username amigable (ej: 'caja1') a un correo sintético de Supabase Auth
 * para no exigir correos a los operadores de caja.
 *
 * @param {string} username
 * @returns {string}
 */
export function toAuthEmail(username) {
  const clean = String(username || '').trim().toLowerCase()
  return `${clean}@auth.pagocheck.com`
}

export function isRemoteAuthEnabled() {
  return Boolean(isRemoteDbEnabled() && supabase)
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.username === 'demo') {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * Autentica al usuario usando Supabase Auth (JWT) o sandbox controlado en desarrollo.
 * Las contraseñas se validan exclusivamente en el servidor (Supabase Auth).
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ ok: boolean, session?: Object, message?: string }>}
 */
export async function login(username, password) {
  const name = String(username || '').trim().toLowerCase()
  const pass = String(password || '')

  if (!name || !pass) {
    return { ok: false, message: 'Escribe usuario y clave.' }
  }

  if (name === 'demo') {
    return { ok: false, message: 'El usuario demo ha sido eliminado del sistema.' }
  }

  // 1. Flujo de Autenticación en Producción / Remoto (Supabase Auth obligatorio)
  if (isRemoteAuthEnabled()) {
    try {
      const email = toAuthEmail(name)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      })

      if (authError || !authData?.user) {
        return { ok: false, message: 'Usuario o clave incorrectos.' }
      }

      const user = authData.user

      // Obtener los datos de perfil y rol autorizados desde public.profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, role, label, branch, active')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error al consultar perfil de usuario:', profileError)
      }

      if (profile && profile.active === false) {
        await supabase.auth.signOut()
        return { ok: false, message: 'Esta cuenta ha sido desactivada por administración.' }
      }

      const session = {
        id: user.id,
        username: profile?.username || name,
        role: profile?.role || user.user_metadata?.role || 'caja',
        label: profile?.label || user.user_metadata?.label || name,
        branch: profile?.branch || user.user_metadata?.branch || ''
      }

      writeSession(session)
      return { ok: true, session }
    } catch (err) {
      console.error('Error en Supabase Auth:', err)
      return { ok: false, message: 'No se pudo conectar al servicio de autenticación.' }
    }
  }

  // 2. Sandbox exclusivamente en entorno de desarrollo local sin backend configurado
  if (isDevEnvironment()) {
    const meta = ACCOUNT_METADATA[name]
    if (!meta) {
      return { ok: false, message: 'Usuario no encontrado en entorno de desarrollo.' }
    }

    const session = {
      id: `dev-sandbox-${name}`,
      username: name,
      role: meta.role,
      label: meta.label || name,
      branch: meta.branch || ''
    }

    writeSession(session)
    return { ok: true, session }
  }

  // En producción, la autenticación remota con Supabase es estrictamente obligatoria
  return {
    ok: false,
    message: 'El servicio de autenticación en la nube es obligatorio en producción.'
  }
}

export async function logout() {
  if (isRemoteAuthEnabled()) {
    try {
      await supabase.auth.signOut()
    } catch {
      // Manejo silencioso en desconexión
    }
  }
  localStorage.removeItem(SESSION_KEY)
}

/**
 * Actualiza la contraseña del usuario en Supabase Auth.
 *
 * @param {string} username
 * @param {string} currentPassword
 * @param {string} nextPassword
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function changePassword(username, currentPassword, nextPassword) {
  if (String(nextPassword || '').length < 6) {
    return { ok: false, message: 'La nueva clave debe tener al menos 6 caracteres.' }
  }

  if (isRemoteAuthEnabled()) {
    const email = toAuthEmail(username)

    // 1. Validar la contraseña actual intentando iniciar sesión
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    })

    if (signInError) {
      return { ok: false, message: 'La clave actual no es correcta.' }
    }

    // 2. Actualizar la contraseña en Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: nextPassword
    })

    if (updateError) {
      return { ok: false, message: updateError.message || 'No se pudo actualizar la clave.' }
    }

    return { ok: true }
  }

  if (isDevEnvironment()) {
    return { ok: true, message: 'Clave actualizada en sandbox de desarrollo.' }
  }

  return { ok: false, message: 'Autenticación remota requerida para cambiar contraseñas.' }
}
