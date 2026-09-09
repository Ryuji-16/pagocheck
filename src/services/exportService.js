import writeXlsxFile from 'write-excel-file/browser'

function sanitizeSheetName(rawName, usedNames) {
  let clean = String(rawName || 'Caja')
    .replace(/[\\/?*[\]:]/g, '_')
    .trim()

  if (!clean) clean = 'Caja'
  if (clean.length > 28) {
    clean = clean.slice(0, 28)
  }

  let finalName = clean
  let counter = 2
  while (usedNames.has(finalName.toLowerCase())) {
    const suffix = `_${counter}`
    const base = clean.slice(0, 31 - suffix.length)
    finalName = `${base}${suffix}`
    counter++
  }

  usedNames.add(finalName.toLowerCase())
  return finalName
}

function formatWhen(value) {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString('es-VE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return String(value)
  }
}

function formatStatus(status) {
  if (status === 'confirmed') return 'Confirmado'
  if (status === 'not-found') return 'No encontrado'
  if (status === 'error') return 'Error'
  if (status === 'simulado') return 'Simulado'
  return status || '-'
}

function formatType(type) {
  if (type === 'vuelto') return 'Vuelto Pago Móvil'
  if (type === 'validacion') return 'Validación de Pago'
  return type || '-'
}

const HEADER_STYLE = {
  fontWeight: 'bold',
  color: '#ffffff',
  backgroundColor: '#135d66',
  align: 'center'
}

const HEADERS = [
  { value: 'Fecha y Hora', ...HEADER_STYLE },
  { value: 'Tipo', ...HEADER_STYLE },
  { value: 'Estado', ...HEADER_STYLE },
  { value: 'Monto', ...HEADER_STYLE },
  { value: 'Banco', ...HEADER_STYLE },
  { value: 'Teléfono', ...HEADER_STYLE },
  { value: 'Cédula', ...HEADER_STYLE },
  { value: 'Referencia', ...HEADER_STYLE },
  { value: 'Nota / Detalle', ...HEADER_STYLE }
]

const COLUMNS = [
  { width: 22 }, // Fecha
  { width: 22 }, // Tipo
  { width: 16 }, // Estado
  { width: 18 }, // Monto
  { width: 30 }, // Banco
  { width: 16 }, // Teléfono
  { width: 16 }, // Cédula
  { width: 18 }, // Referencia
  { width: 26 }  // Nota
]

function buildSheetData(cajaName, movements) {
  const rows = [HEADERS]

  for (const item of movements) {
    rows.push([
      { value: formatWhen(item.at), align: 'center' },
      { value: formatType(item.type) },
      { value: formatStatus(item.status), align: 'center' },
      { value: item.amount || '-', align: 'right' },
      { value: item.bank || '-' },
      { value: item.phone || '-', align: 'center' },
      { value: item.cedula || '-', align: 'center' },
      { value: item.reference || '-', align: 'center' },
      { value: item.note || '-' }
    ])
  }

  // Fila resumen
  rows.push([
    {
      value: `Total registros: ${movements.length}`,
      fontWeight: 'bold',
      color: '#135d66'
    },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ])

  return rows
}

/**
 * Exporta movimientos agrupados por caja en hojas independientes de Excel.
 * @param {Array} movements - Lista de movimientos a exportar.
 * @param {Object} [options]
 * @param {string} [options.prefix] - Prefijo opcional del archivo.
 */
export async function exportMovementsToExcel(movements, options = {}) {
  if (!movements || movements.length === 0) {
    throw new Error('No hay movimientos disponibles para exportar.')
  }

  // Agrupar movimientos por caja (usando label o username)
  const groups = new Map()

  for (const item of movements) {
    const key = item.label || item.username || 'General'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  }

  const usedNames = new Set()
  const sheets = []

  for (const [cajaName, groupItems] of groups.entries()) {
    const sheetTitle = sanitizeSheetName(cajaName, usedNames)
    sheets.push({
      sheet: sheetTitle,
      columns: COLUMNS,
      data: buildSheetData(cajaName, groupItems)
    })
  }

  const now = new Date()
  const dateSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const fileName = `${options.prefix || 'pagocheck_movimientos'}_${dateSuffix}.xlsx`

  const writer = writeXlsxFile(sheets)

  if (writer && typeof writer.toFile === 'function') {
    await writer.toFile(fileName)
  } else if (writer && typeof writer.toBlob === 'function') {
    const blob = await writer.toBlob()
    if (typeof window !== 'undefined' && window.URL && document.createElement) {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)
    }
  } else if (writer && typeof writer.then === 'function') {
    await writer
  }

  return { ok: true, fileName, sheetsCount: sheets.length }
}
