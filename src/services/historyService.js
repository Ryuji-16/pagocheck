import { getSession } from './authService'
import { isRemoteDbEnabled, remoteRequest } from './supabaseClient'
import { parseDate } from '../utils/formatters'

const HISTORY_KEY = 'pagocheck-movements'

/**
 * Purga automáticamente las imágenes pesadas de comprobantes (data URL / base64)
 * que superen la antigüedad máxima en días (por defecto 7 días), optimizando
 * el uso de almacenamiento en localStorage y conservando el 100% de los datos
 * de auditoría en texto.
 *
 * @param {number} [maxAgeDays=7] - Días de antigüedad máxima para conservar imágenes.
 * @returns {number} Cantidad de comprobantes cuya imagen fue purgada.
 */
export function purgeExpiredReceiptImages(maxAgeDays = 7) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 0
  }

  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return 0

    const list = JSON.parse(raw)
    if (!Array.isArray(list) || list.length === 0) return 0

    const now = Date.now()
    const maxAgeMs = Math.max(0, Number(maxAgeDays) || 7) * 24 * 60 * 60 * 1000
    let changesOccurred = false
    let purgedCount = 0

    const updated = list.map((item) => {
      const rawImg = item.receipt_image || item.image
      // Solo purgar si tiene una imagen real (data URL / base64) y no ha sido purgada antes
      const hasImage =
        typeof rawImg === 'string' &&
        rawImg.trim().length > 0 &&
        rawImg !== 'purged'

      if (!hasImage) {
        return item
      }

      // Comparar created_at o at contra el tiempo actual
      const dateVal = item.created_at || item.at || item.date || item.timestamp
      let itemTime = 0

      if (dateVal) {
        const d = parseDate(dateVal)
        if (d && !Number.isNaN(d.getTime())) {
          itemTime = d.getTime()
        }
      }

      // Si no se puede determinar la fecha o no ha superado maxAgeDays, no purgar
      if (!itemTime || now - itemTime <= maxAgeMs) {
        return item
      }

      // Superó maxAgeDays: Purgar el payload de imagen y marcar como 'purged'
      // Conservando el 100% de los campos de auditoría de texto
      changesOccurred = true
      purgedCount += 1

      const purgedItem = {
        ...item,
        receipt_image: 'purged'
      }

      if ('image' in purgedItem) {
        delete purgedItem.image
      }

      return purgedItem
    })

    if (changesOccurred) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    }

    return purgedCount
  } catch (err) {
    console.error('Error al ejecutar purga de comprobantes:', err)
    return 0
  }
}

// Ejecutar purga en segundo plano al cargar el módulo del servicio
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    purgeExpiredReceiptImages(7)
  } catch {
    // Entorno sin localStorage
  }
}

function readAllLocal() {
  try {
    purgeExpiredReceiptImages(7)
    const raw = localStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return list.filter((item) => item.username !== 'demo')
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
    branch: row.branch || '',
    type: row.type,
    status: row.status,
    amount: row.amount || '',
    reference: row.reference || '',
    phone: row.phone || '',
    bank: row.bank || '',
    cedula: row.cedula || '',
    note: row.note || '',
    receipt_image: row.receipt_image || row.image || ''
  }
}

export async function saveMovement(entry) {
  const session = getSession()
  const item = {
    username: entry.username || session?.username || 'caja1',
    label: entry.label || session?.label || session?.username || 'Caja 1',
    branch: entry.branch || session?.branch || '',
    type: entry.type,
    status: entry.status || 'ok',
    amount: entry.amount || '',
    reference: entry.reference || '',
    phone: entry.phone || '',
    bank: entry.bank || '',
    cedula: entry.cedula || '',
    note: entry.note || '',
    receipt_image: entry.receipt_image || ''
  }

  if (isRemoteDbEnabled()) {
    let { data, error } = await remoteRequest('movements', {
      method: 'POST',
      body: item,
      prefer: 'return=representation'
    })

    // Fallback si alguna columna aún no existe en Supabase
    if (error && (item.receipt_image || item.branch)) {
      const fallbackItem = { ...item }
      delete fallbackItem.receipt_image
      let retryResult = await remoteRequest('movements', {
        method: 'POST',
        body: fallbackItem,
        prefer: 'return=representation'
      })
      if (retryResult.error && fallbackItem.branch) {
        delete fallbackItem.branch
        retryResult = await remoteRequest('movements', {
          method: 'POST',
          body: fallbackItem,
          prefer: 'return=representation'
        })
      }
      data = retryResult.data
      error = retryResult.error
    }

    if (error) {
      console.error('No se pudo guardar el movimiento remoto', error)
      return null
    }

    const row = Array.isArray(data) ? data[0] : data
    if (row && item.receipt_image && !row.receipt_image) {
      row.receipt_image = item.receipt_image
    }
    if (row && item.branch && !row.branch) {
      row.branch = item.branch
    }
    return row ? toListItem(row) : null
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
  purgeExpiredReceiptImages(7)

  if (isRemoteDbEnabled()) {
    const filter =
      session.role === 'admin'
        ? ''
        : `&username=eq.${encodeURIComponent(session.username)}`

    let { data, error } = await remoteRequest(
      `movements?select=id,created_at,username,label,branch,type,status,amount,reference,phone,bank,cedula,note,receipt_image${filter}&order=created_at.desc&limit=200`
    )

    // Fallbacks si columnas nuevas aún no fueron creadas en la base remota
    if (error) {
      const fallback = await remoteRequest(
        `movements?select=id,created_at,username,label,type,status,amount,reference,phone,bank,cedula,note,receipt_image${filter}&order=created_at.desc&limit=200`
      )
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      const fallback2 = await remoteRequest(
        `movements?select=id,created_at,username,label,type,status,amount,reference,phone,bank,cedula,note${filter}&order=created_at.desc&limit=200`
      )
      data = fallback2.data
      error = fallback2.error
    }

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

/**
 * Busca si un número de referencia ya fue registrado en el sistema
 * (localmente o en la base remota) para evitar pagos duplicados.
 *
 * @param {string} reference
 * @param {string} [bank]
 * @returns {Promise<Object|null>}
 */
export async function findMovementByReference(reference, bank = '') {
  const ref = String(reference || '').trim()
  if (!ref) return null

  const refDigits = ref.replace(/\D/g, '')
  const hasMinDigits = refDigits.length >= 6

  const matchesReference = (itemRef) => {
    if (!itemRef) return false
    const itemTrimmed = itemRef.trim()
    if (itemTrimmed === ref) return true
    if (hasMinDigits) {
      const itemDigits = itemRef.replace(/\D/g, '')
      if (itemDigits.length >= 6 && itemDigits.slice(-6) === refDigits.slice(-6)) {
        return true
      }
    }
    return false
  }

  // 1. Revisar en almacenamiento local
  const localItems = readAllLocal()
  const localMatch = localItems.find((item) => {
    if (!item.reference) return false
    if (!matchesReference(item.reference)) return false
    if (item.status === 'not-found' || item.status === 'error') return false
    if (bank && item.bank) {
      return item.bank.trim() === bank.trim()
    }
    return true
  })

  if (localMatch) {
    return localMatch
  }

  // 2. Revisar en base de datos remota si está activa
  if (isRemoteDbEnabled()) {
    try {
      const filter = hasMinDigits
        ? `&reference=ilike.*${encodeURIComponent(refDigits.slice(-6))}`
        : `&reference=eq.${encodeURIComponent(ref)}`
      let { data, error } = await remoteRequest(
        `movements?select=id,created_at,username,label,branch,type,status,amount,reference,phone,bank,cedula,note${filter}&order=created_at.desc&limit=10`
      )

      if (error && hasMinDigits) {
        const fallback = await remoteRequest(
          `movements?select=id,created_at,username,label,branch,type,status,amount,reference,phone,bank,cedula,note&reference=eq.${encodeURIComponent(ref)}&order=created_at.desc&limit=10`
        )
        data = fallback.data
        error = fallback.error
      }

      if (!error && Array.isArray(data)) {
        const found = data.find((row) => {
          if (row.status === 'not-found' || row.status === 'error') return false
          if (!matchesReference(row.reference)) return false
          if (bank && row.bank) {
            return row.bank.trim() === bank.trim()
          }
          return true
        })
        if (found) return toListItem(found)
      }
    } catch (err) {
      console.error('Error al verificar duplicado remoto:', err)
    }
  }

  return null
}
