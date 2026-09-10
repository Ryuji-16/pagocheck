import { BANKS } from '../services/banks.js'
import { isToday } from '../services/exportService.js'

/**
 * Obtiene el nombre y código de 4 dígitos del banco.
 * @param {string} rawBank - Nombre o etiqueta completa del banco.
 * @returns {{ name: string, code: string }}
 */
export function getBankInfo(rawBank) {
  if (!rawBank) return { name: 'Otro banco', code: '0000' }

  const clean = String(rawBank).trim()

  // Si ya viene con formato '0114 — Bancaribe' o '0114 - Bancaribe'
  const prefixMatch = clean.match(/^(\d{4})\s*[-—]\s*(.+)$/)
  if (prefixMatch) {
    return {
      code: prefixMatch[1],
      name: prefixMatch[2].trim()
    }
  }

  // Buscar por nombre en la lista oficial
  const lower = clean.toLowerCase()
  const found = BANKS.find(
    (b) =>
      b.name.toLowerCase().includes(lower) ||
      lower.includes(b.name.toLowerCase()) ||
      b.code === clean
  )

  if (found) {
    return {
      code: found.code,
      name: found.name
    }
  }

  // Si no coincide con ninguno oficial
  return {
    code: '0000',
    name: clean
  }
}

/**
 * Parsea cualquier formato de fecha a objeto Date válido o null.
 */
export function parseDate(value) {
  if (!value && value !== 0) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value).trim())) {
    const d = new Date(Number(value))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const str = String(value).trim()
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymd && !str.includes('T') && !str.includes(':')) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy && !str.includes('T')) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Formato de fecha para la tabla: '9/9, 09:55 p. m.'
 */
export function formatMovementDate(dateValue) {
  const d = parseDate(dateValue)
  if (!d) return String(dateValue || '-')

  try {
    const day = d.getDate()
    const month = d.getMonth() + 1
    const timeStr = d.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    return `${day}/${month}, ${timeStr}`
  } catch {
    return String(dateValue)
  }
}

/**
 * Calcula el tiempo relativo transcurrido: 'Hace 2 min', 'Hace 1 h', etc.
 */
export function formatRelativeTime(dateValue) {
  const d = parseDate(dateValue)
  if (!d) return ''

  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return 'Hace un momento'

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Hace unos segundos'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 30) return `Hace ${diffDays} d`

  return ''
}

/**
 * Parsea un monto numérico a partir de string o número.
 */
export function parseAmount(val) {
  if (typeof val === 'number') return val
  if (!val) return 0
  const clean = String(val).replace(/Bs\.?/gi, '').trim()
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0
  }
  return parseFloat(clean) || 0
}

/**
 * Formatea un monto en bolívares: 'Bs. 150,00'
 */
export function formatBs(val) {
  const num = parseAmount(val)
  return `Bs. ${num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * Formatea el teléfono o cédula de manera elegante: '0414 • 1234567'
 */
export function formatPhoneOrDetail(phone, cedula, note) {
  if (phone) {
    const clean = phone.replace(/[^\d]/g, '')
    if (clean.length >= 10) {
      const code = clean.slice(0, 4)
      const rest = clean.slice(4)
      return `${code} • ${rest}`
    }
    return phone
  }
  if (cedula) return cedula
  if (note) return note
  return '-'
}

/**
 * Comprueba si una fecha entra dentro del filtro de período seleccionado.
 * @param {*} dateValue
 * @param {'today' | 'yesterday' | 'week' | 'all'} preset
 */
export function isDateInPreset(dateValue, preset) {
  if (preset === 'all' || !preset) return true
  if (preset === 'today') return isToday(dateValue)

  const d = parseDate(dateValue)
  if (!d) return false

  const now = new Date()

  if (preset === 'yesterday') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return (
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate()
    )
  }

  if (preset === 'week') {
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return d >= sevenDaysAgo && d <= now
  }

  return true
}

/** Prefijos de operadoras móviles en Venezuela (Digitel, Movistar, Movilnet) */
export const VE_MOBILE_PREFIXES = ['0412', '0422', '0414', '0424', '0416', '0426']

/**
 * Formatea un número de teléfono al formato '04XX-XXXXXXX' (máx 11 dígitos).
 * @param {string} value
 * @returns {string}
 */
export function formatPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 4) {
    return digits
  }
  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}

/**
 * Valida si un número telefónico es válido en Venezuela (11 dígitos y prefijo oficial).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidVePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return false
  const prefix = digits.slice(0, 4)
  return VE_MOBILE_PREFIXES.includes(prefix)
}
