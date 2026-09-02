const SESSION_KEY = 'pagocheck-session'
const USERS_KEY = 'pagocheck-users'

const DEMO_USER = {
  username: 'demo',
  password: 'pagocheck'
}

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }

  return { [DEMO_USER.username]: DEMO_USER.password }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getDemoCredentials() {
  return { ...DEMO_USER }
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

  if (!users[name] || users[name] !== pass) {
    return { ok: false, message: 'Usuario o clave incorrectos.' }
  }

  const session = { username: name }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { ok: true, session }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function changePassword(username, currentPassword, nextPassword) {
  const users = readUsers()

  if (!users[username] || users[username] !== currentPassword) {
    return { ok: false, message: 'La clave actual no es correcta.' }
  }

  if (String(nextPassword || '').length < 6) {
    return { ok: false, message: 'La nueva clave debe tener al menos 6 caracteres.' }
  }

  users[username] = nextPassword
  writeUsers(users)
  return { ok: true }
}
