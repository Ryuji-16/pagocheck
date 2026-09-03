import { isRemoteDbEnabled, supabase } from './supabaseClient'

const SESSION_KEY = 'pagocheck-session'
const USERS_KEY = 'pagocheck-users'

const DEFAULT_USERS = {
  demo: { password: 'pagocheck', role: 'caja', label: 'Prueba' },
  caja1: { password: 'caja1', role: 'caja', label: 'Caja 1' },
  caja2: { password: 'caja2', role: 'caja', label: 'Caja 2' },
  caja3: { password: 'caja3', role: 'caja', label: 'Caja 3' },
  admin: { password: 'admin123', role: 'admin', label: 'Admin de tienda' }
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(`pagocheck:${password}`)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function toUserRecord(value, fallbackRole = 'caja') {
  if (value && typeof value === 'object' && value.password) {
    return {
      password: String(value.password),
      role: value.role || fallbackRole,
      label: value.label || ''
    }
  }

  return {
    password: String(value || ''),
    role: fallbackRole,
    label: ''
  }
}

function readLocalUsers() {
  let stored = {}

  try {
    stored = JSON.parse(localStorage.getItem(USERS_KEY) || '{}') || {}
  } catch {
    stored = {}
  }

  const users = {}

  for (const [username, meta] of Object.entries(DEFAULT_USERS)) {
    const saved = stored[username]
    users[username] = {
      ...meta,
      password: saved ? toUserRecord(saved, meta.role).password : meta.password
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
    password: meta.password,
    role: meta.role,
    label: meta.label
  }))
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function login(username, password) {
  const name = String(username || '').trim()
  const pass = String(password || '')

  if (!name || !pass) {
    return { ok: false, message: 'Escribe usuario y clave.' }
  }

  if (isRemoteDbEnabled()) {
    const passwordHash = await hashPassword(pass)
    const { data, error } = await supabase
      .from('app_users')
      .select('username, role, label, password_hash')
      .eq('username', name)
      .maybeSingle()

    if (error) {
      return { ok: false, message: 'No se pudo conectar a la base.' }
    }

    if (!data || data.password_hash !== passwordHash) {
      return { ok: false, message: 'Usuario o clave incorrectos.' }
    }

    const session = {
      username: data.username,
      role: data.role,
      label: data.label || data.username
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
    label: user.label || name
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
    const currentHash = await hashPassword(currentPassword)
    const { data, error } = await supabase
      .from('app_users')
      .select('username, password_hash, role, label')
      .eq('username', username)
      .maybeSingle()

    if (error) {
      return { ok: false, message: 'No se pudo conectar a la base.' }
    }

    if (!data || data.password_hash !== currentHash) {
      return { ok: false, message: 'La clave actual no es correcta.' }
    }

    const { error: updateError } = await supabase
      .from('app_users')
      .update({ password_hash: await hashPassword(nextPassword) })
      .eq('username', username)

    if (updateError) {
      return { ok: false, message: 'No se pudo guardar la clave.' }
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
