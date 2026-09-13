import { getTenantConfig } from '../config/tenantConfig.js'
import { isRemoteDbEnabled, supabase } from './supabaseClient.js'

const SESSION_KEY = 'pagocheck-session'
const USERS_KEY = 'pagocheck-users'

const tenantConfig = getTenantConfig()
const botConfig = tenantConfig.bot || {}

// Metadatos de cuentas para la interfaz y modo local
const DEFAULT_USERS = {
  // Tienda 1 (Bella Vista)
  admin_t1: { role: 'admin', label: 'Admin Bella Vista', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Supervisor Sucursal', icon: 'supervisor_account', localFallbackPassword: 'admin1' },
  caja1: { role: 'caja', label: 'Caja 1', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Mostrador', icon: 'point_of_sale', localFallbackPassword: 'caja1' },
  caja2: { role: 'caja', label: 'Caja 2', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Salón', icon: 'table_restaurant', localFallbackPassword: 'caja2' },
  caja3: { role: 'caja', label: 'Caja 3', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Barra / Terraza', icon: 'local_bar', localFallbackPassword: 'caja3' },
  // Tienda 2 (Altamira)
  admin_t2: { role: 'admin', label: 'Admin Altamira', branch: 'Tienda 2 (Altamira)', subtitle: 'Supervisor Sucursal', icon: 'supervisor_account', localFallbackPassword: 'admin2' },
  t2_caja1: { role: 'caja', label: 'Caja 1', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Principal', icon: 'point_of_sale', localFallbackPassword: 'caja1' },
  t2_caja2: { role: 'caja', label: 'Caja 2', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Mostrador', icon: 'table_restaurant', localFallbackPassword: 'caja2' },
  t2_caja3: { role: 'caja', label: 'Caja 3', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Rápida', icon: 'local_bar', localFallbackPassword: 'caja3' },
  // Tienda 3 (La Trinidad)
  admin_t3: { role: 'admin', label: 'Admin La Trinidad', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Supervisor Sucursal', icon: 'supervisor_account', localFallbackPassword: 'admin3' },
  t3_caja1: { role: 'caja', label: 'Caja 1', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Principal', icon: 'point_of_sale', localFallbackPassword: 'caja1' },
  t3_caja2: { role: 'caja', label: 'Caja 2', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Mostrador', icon: 'table_restaurant', localFallbackPassword: 'caja2' },
  t3_caja3: { role: 'caja', label: 'Caja 3', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Rápida', icon: 'local_bar', localFallbackPassword: 'caja3' },
  // Camión Móvil
  admin_camion: { role: 'admin', label: 'Admin Camión', branch: 'Camión Móvil', subtitle: 'Supervisor Ruta Móvil', icon: 'supervisor_account', localFallbackPassword: 'admincamion' },
  camion_caja1: { role: 'caja', label: 'Caja Móvil', branch: 'Camión Móvil', subtitle: 'Terminal Ruta', icon: 'local_shipping', localFallbackPassword: 'camion' },
  // Servicios / Bot (WhatsApp / Delivery)
  [botConfig.serviceUsername || 'bot_service']: {
    role: 'bot',
    label: botConfig.serviceLabel || 'Asistente WhatsApp',
    branch: botConfig.branch || 'WhatsApp / Delivery',
    subtitle: 'Servicios / Bot',
    icon: 'smart_toy',
    localFallbackPassword: 'bot'
  },
  // Dueño de la Empresa (Administrador General de todas las sucursales)
  admin: { role: 'admin', label: 'Dueño / Admin General', branch: '', subtitle: 'Dueño de la Empresa / Consolidado Total', icon: 'shield_person', localFallbackPassword: 'admin123' }
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

function toUserRecord(value, fallbackRole = 'caja', fallbackBranch = '') {
  if (value && typeof value === 'object' && value.password) {
    return {
      password: String(value.password),
      role: value.role || fallbackRole,
      label: value.label || '',
      branch: value.branch || fallbackBranch
    }
  }

  return {
    password: String(value || ''),
    role: fallbackRole,
    label: '',
    branch: fallbackBranch
  }
}

function readLocalUsers() {
  let stored

  try {
    stored = JSON.parse(localStorage.getItem(USERS_KEY) || '{}') || {}
  } catch {
    stored = {}
  }

  // Eliminar usuario demo si existía previamente
  if (stored.demo) {
    delete stored.demo
    localStorage.setItem(USERS_KEY, JSON.stringify(stored))
  }

  const users = {}

  for (const [username, meta] of Object.entries(DEFAULT_USERS)) {
    const saved = stored[username]
    users[username] = {
      ...meta,
      password: saved ? toUserRecord(saved, meta.role, meta.branch).password : meta.localFallbackPassword,
      branch: meta.branch || ''
    }
  }

  return users
}

function writeLocalUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function isRemoteAuthEnabled() {
  return Boolean(isRemoteDbEnabled() && supabase)
}

export function getDemoAccounts() {
  return Object.entries(DEFAULT_USERS).map(([username, meta]) => ({
    username,
    role: meta.role,
    label: meta.label,
    branch: meta.branch || '',
    subtitle: meta.subtitle || '',
    icon: meta.icon || 'account_circle'
  }))
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
 * Autentica al usuario usando Supabase Auth (JWT) o el fallback local en desarrollo offline.
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

  // Fallback offline / local
  const users = readLocalUsers()
  const user = users[name]

  if (!user || user.password !== pass) {
    return { ok: false, message: 'Usuario o clave incorrectos.' }
  }

  const session = {
    username: name,
    role: user.role,
    label: user.label || name,
    branch: user.branch || ''
  }
  writeSession(session)
  return { ok: true, session }
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
 * Actualiza la contraseña del usuario en Supabase Auth o en almacenamiento local.
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

  // Fallback local
  const users = readLocalUsers()
  const user = users[username]

  if (!user || user.password !== currentPassword) {
    return { ok: false, message: 'La clave actual no es correcta.' }
  }

  users[username] = {
    ...user,
    password: nextPassword
  }
  writeLocalUsers(users)
  return { ok: true }
}
