const SESSION_KEY = 'pagocheck-session'
const USERS_KEY = 'pagocheck-users'

const DEFAULT_USERS = {
  demo: { password: 'pagocheck', role: 'caja', label: 'Prueba' },
  caja1: { password: 'caja1', role: 'caja', label: 'Caja 1' },
  caja2: { password: 'caja2', role: 'caja', label: 'Caja 2' },
  caja3: { password: 'caja3', role: 'caja', label: 'Caja 3' },
  admin: { password: 'admin123', role: 'admin', label: 'Admin de tienda' }
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

function readUsers() {
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

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getDemoAccounts() {
  return Object.entries(DEFAULT_USERS).map(([username, meta]) => ({
    username,
    password: meta.password,
    role: meta.role,
    label: meta.label
  }))
}

export function getDemoCredentials() {
  return {
    username: 'demo',
    password: DEFAULT_USERS.demo.password
  }
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

export function login(username, password) {
  const name = String(username || '').trim()
  const pass = String(password || '')
  const users = readUsers()

  if (!name || !pass) {
    return { ok: false, message: 'Escribe usuario y clave.' }
  }

  const user = users[name]

  if (!user || user.password !== pass) {
    return { ok: false, message: 'Usuario o clave incorrectos.' }
  }

  const session = {
    username: name,
    role: user.role,
    label: user.label || name
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { ok: true, session }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function changePassword(username, currentPassword, nextPassword) {
  const users = readUsers()
  const user = users[username]

  if (!user || user.password !== currentPassword) {
    return { ok: false, message: 'La clave actual no es correcta.' }
  }

  if (String(nextPassword || '').length < 6) {
    return { ok: false, message: 'La nueva clave debe tener al menos 6 caracteres.' }
  }

  users[username] = {
    ...user,
    password: nextPassword
  }
  writeUsers(users)
  return { ok: true }
}
