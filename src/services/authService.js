import { getTenantConfig } from '../config/tenantConfig'
import { isRemoteDbEnabled, remoteRequest } from './supabaseClient'

const SESSION_KEY = 'pagocheck-session'
const USERS_KEY = 'pagocheck-users'

const tenantConfig = getTenantConfig()
const botConfig = tenantConfig.bot || {}

const DEFAULT_USERS = {
  // Tienda 1 (Bella Vista)
  caja1: { password: 'caja1', role: 'caja', label: 'Caja 1', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Mostrador', icon: 'point_of_sale' },
  caja2: { password: 'caja2', role: 'caja', label: 'Caja 2', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Salón', icon: 'table_restaurant' },
  caja3: { password: 'caja3', role: 'caja', label: 'Caja 3', branch: 'Tienda 1 (Bella Vista)', subtitle: 'Terminal Barra / Terraza', icon: 'local_bar' },
  // Tienda 2 (Altamira)
  t2_caja1: { password: 'caja1', role: 'caja', label: 'Caja 1', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Principal', icon: 'point_of_sale' },
  t2_caja2: { password: 'caja2', role: 'caja', label: 'Caja 2', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Mostrador', icon: 'table_restaurant' },
  t2_caja3: { password: 'caja3', role: 'caja', label: 'Caja 3', branch: 'Tienda 2 (Altamira)', subtitle: 'Terminal Rápida', icon: 'local_bar' },
  // Tienda 3 (La Trinidad)
  t3_caja1: { password: 'caja1', role: 'caja', label: 'Caja 1', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Principal', icon: 'point_of_sale' },
  t3_caja2: { password: 'caja2', role: 'caja', label: 'Caja 2', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Mostrador', icon: 'table_restaurant' },
  t3_caja3: { password: 'caja3', role: 'caja', label: 'Caja 3', branch: 'Tienda 3 (La Trinidad)', subtitle: 'Terminal Rápida', icon: 'local_bar' },
  // Camión Móvil
  camion_caja1: { password: 'camion', role: 'caja', label: 'Caja Móvil', branch: 'Camión Móvil', subtitle: 'Terminal Ruta', icon: 'local_shipping' },
  // Servicios / Bot (WhatsApp / Delivery)
  [botConfig.serviceUsername || 'bot_service']: {
    password: 'bot',
    role: 'bot',
    label: botConfig.serviceLabel || 'Asistente WhatsApp',
    branch: botConfig.branch || 'WhatsApp / Delivery',
    subtitle: 'Servicios / Bot',
    icon: 'smart_toy'
  },
  // Administrador General
  admin: { password: 'admin123', role: 'admin', label: 'Admin General', branch: '', subtitle: 'Consolidado / Reportes', icon: 'shield_person' }
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(`pagocheck:${password}`)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
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

  // Eliminar usuario demo si existía previamente en almacenamiento local
  if (stored.demo) {
    delete stored.demo
    localStorage.setItem(USERS_KEY, JSON.stringify(stored))
  }

  const users = {}

  for (const [username, meta] of Object.entries(DEFAULT_USERS)) {
    const saved = stored[username]
    users[username] = {
      ...meta,
      password: saved ? toUserRecord(saved, meta.role, meta.branch).password : meta.password,
      branch: meta.branch || ''
    }
  }

  return users
}

function writeLocalUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function isRemoteAuthEnabled() {
  return isRemoteDbEnabled()
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

export async function purgeRemoteDemoUser() {
  if (isRemoteDbEnabled()) {
    try {
      await remoteRequest('app_users?username=eq.demo', { method: 'DELETE' })
      await remoteRequest('movements?username=eq.demo', { method: 'DELETE' })
    } catch {
      // Manejo silencioso si la base no está conectada
    }
  }
}

// Ejecutar limpieza remota de cuenta demo al inicializar
if (isRemoteDbEnabled()) {
  purgeRemoteDemoUser()
}

export async function login(username, password) {
  const name = String(username || '').trim()
  const pass = String(password || '')

  if (!name || !pass) {
    return { ok: false, message: 'Escribe usuario y clave.' }
  }

  if (name === 'demo') {
    return { ok: false, message: 'El usuario demo ha sido eliminado del sistema.' }
  }

  if (isRemoteDbEnabled()) {
    const passwordHash = await hashPassword(pass)
    let { data, error } = await remoteRequest('rpc/verify_login', {
      method: 'POST',
      body: {
        p_username: name,
        p_password_hash: passwordHash
      }
    })

    // Fallback si la función RPC verify_login aún no fue creada en Supabase
    if (error) {
      const fallbackQuery = await remoteRequest(
        `app_users?username=eq.${encodeURIComponent(name)}&select=username,role,label,branch,password_hash`
      )
      if (fallbackQuery.error) {
        const fallbackNoBranch = await remoteRequest(
          `app_users?username=eq.${encodeURIComponent(name)}&select=username,role,label,password_hash`
        )
        if (!fallbackNoBranch.error && Array.isArray(fallbackNoBranch.data) && fallbackNoBranch.data.length > 0) {
          const u = fallbackNoBranch.data[0]
          if (u.password_hash === passwordHash) {
            data = [{ username: u.username, role: u.role, label: u.label, branch: '' }]
            error = null
          } else {
            return { ok: false, message: 'Usuario o clave incorrectos.' }
          }
        }
      } else if (Array.isArray(fallbackQuery.data) && fallbackQuery.data.length > 0) {
        const u = fallbackQuery.data[0]
        if (u.password_hash === passwordHash) {
          data = [{ username: u.username, role: u.role, label: u.label, branch: u.branch || '' }]
          error = null
        } else {
          return { ok: false, message: 'Usuario o clave incorrectos.' }
        }
      }
    }

    if (error) {
      return { ok: false, message: `No se pudo conectar a la base: ${error.message}` }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || !row.username) {
      return { ok: false, message: 'Usuario o clave incorrectos.' }
    }

    const session = {
      username: row.username,
      role: row.role,
      label: row.label || row.username,
      branch: row.branch || ''
    }
    writeSession(session)
    return { ok: true, session }
  }

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

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export async function changePassword(username, currentPassword, nextPassword) {
  if (String(nextPassword || '').length < 6) {
    return { ok: false, message: 'La nueva clave debe tener al menos 6 caracteres.' }
  }

  if (isRemoteDbEnabled()) {
    const oldHash = await hashPassword(currentPassword)
    const newHash = await hashPassword(nextPassword)
    let { data, error } = await remoteRequest('rpc/change_user_password', {
      method: 'POST',
      body: {
        p_username: username,
        p_old_hash: oldHash,
        p_new_hash: newHash
      }
    })

    // Fallback si la función change_user_password aún no existe en Supabase
    if (error) {
      const checkUser = await remoteRequest(
        `app_users?username=eq.${encodeURIComponent(username)}&select=username,password_hash`
      )
      if (!checkUser.error && Array.isArray(checkUser.data) && checkUser.data.length > 0) {
        if (checkUser.data[0].password_hash !== oldHash) {
          return { ok: false, message: 'La clave actual no es correcta.' }
        }
        const updateRes = await remoteRequest(
          `app_users?username=eq.${encodeURIComponent(username)}`,
          {
            method: 'PATCH',
            body: { password_hash: newHash }
          }
        )
        if (!updateRes.error) {
          data = true
          error = null
        }
      }
    }

    if (error) {
      return { ok: false, message: `No se pudo conectar a la base: ${error.message}` }
    }

    if (!data) {
      return { ok: false, message: 'La clave actual no es correcta.' }
    }

    return { ok: true }
  }

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
