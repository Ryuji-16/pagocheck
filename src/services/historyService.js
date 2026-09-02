import { getSession } from './authService'

const HISTORY_KEY = 'pagocheck-movements'

function readAll() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveMovement(entry) {
  const session = getSession()
  const item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    at: new Date().toISOString(),
    username: session?.username || 'demo',
    label: session?.label || session?.username || 'demo',
    type: entry.type,
    status: entry.status || 'ok',
    amount: entry.amount || '',
    reference: entry.reference || '',
    phone: entry.phone || '',
    bank: entry.bank || '',
    cedula: entry.cedula || '',
    note: entry.note || ''
  }

  const next = [item, ...readAll()].slice(0, 200)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return item
}

export function listMovements(session) {
  const all = readAll()
  if (!session) return []
  if (session.role === 'admin') return all
  return all.filter((item) => item.username === session.username)
}
