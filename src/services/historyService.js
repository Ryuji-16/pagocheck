import { getSession } from './authService'
import { isRemoteDbEnabled, supabase } from './supabaseClient'

const HISTORY_KEY = 'pagocheck-movements'

function readAllLocal() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function toListItem(row) {
  return {
    id: row.id,
    at: row.created_at || row.at,
    username: row.username,
    label: row.label,
    type: row.type,
    status: row.status,
    amount: row.amount || '',
    reference: row.reference || '',
    phone: row.phone || '',
    bank: row.bank || '',
    cedula: row.cedula || '',
    note: row.note || ''
  }
}

export async function saveMovement(entry) {
  const session = getSession()
  const item = {
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

  if (isRemoteDbEnabled()) {
    const { data, error } = await supabase
      .from('movements')
      .insert(item)
      .select('id, created_at, username, label, type, status, amount, reference, phone, bank, cedula, note')
      .single()

    if (error) {
      console.error('No se pudo guardar el movimiento remoto', error)
      return null
    }

    return toListItem(data)
  }

  const localItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...item
  }
  const next = [localItem, ...readAllLocal()].slice(0, 200)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return localItem
}

export async function listMovements(session) {
  if (!session) return []

  if (isRemoteDbEnabled()) {
    let query = supabase
      .from('movements')
      .select('id, created_at, username, label, type, status, amount, reference, phone, bank, cedula, note')
      .order('created_at', { ascending: false })
      .limit(200)

    if (session.role !== 'admin') {
      query = query.eq('username', session.username)
    }

    const { data, error } = await query
    if (error) {
      console.error('No se pudieron leer los movimientos', error)
      return []
    }

    return (data || []).map(toListItem)
  }

  const all = readAllLocal()
  if (session.role === 'admin') return all
  return all.filter((item) => item.username === session.username)
}
