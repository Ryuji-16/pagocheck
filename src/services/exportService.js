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

function parseAmount(val) {
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

function isToday(dateValue) {
  if (!dateValue) return false
  try {
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date()
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  } catch {
    return false
  }
}

function formatWhen(value) {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

// Ordenar las cajas: Caja 1, Caja 2, Caja 3, ..., Prueba / demo, Admin
function compareCajas(a, b) {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  const aIsCaja = aLower.includes('caja')
  const bIsCaja = bLower.includes('caja')

  if (aIsCaja && bIsCaja) {
    const numA = parseInt(aLower.replace(/\D+/g, ''), 10) || 0
    const numB = parseInt(bLower.replace(/\D+/g, ''), 10) || 0
    if (numA !== numB) return numA - numB
    return aLower.localeCompare(bLower)
  }

  if (aIsCaja && !bIsCaja) return -1
  if (!aIsCaja && bIsCaja) return 1

  const aIsAdmin = aLower.includes('admin')
  const bIsAdmin = bLower.includes('admin')
  if (aIsAdmin && !bIsAdmin) return 1
  if (!aIsAdmin && bIsAdmin) return -1

  return aLower.localeCompare(bLower)
}

const HEADER_STYLE = {
  fontWeight: 'bold',
  color: '#ffffff',
  backgroundColor: '#008000',
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
  { width: 16 }, // Monto
  { width: 28 }, // Banco
  { width: 16 }, // Teléfono
  { width: 16 }, // Cédula
  { width: 18 }, // Referencia
  { width: 24 }  // Nota
]

function buildSheetData(cajaName, movements) {
  const rows = [HEADERS]

  for (const item of movements) {
    const numAmount = parseAmount(item.amount)

    rows.push([
      { value: formatWhen(item.at), align: 'center' },
      { value: formatType(item.type), align: 'center' },
      { value: formatStatus(item.status), align: 'center' },
      {
        value: numAmount,
        type: Number,
        format: '#,##0.00',
        align: 'center'
      },
      { value: item.bank || '-', align: 'center' },
      { value: item.phone || '-', align: 'center' },
      { value: item.cedula || '-', align: 'center' },
      { value: item.reference || '-', align: 'center' },
      { value: item.note || '-', align: 'center' }
    ])
  }

  const lastDataRow = movements.length + 1

  // Fila vacía separadora
  rows.push([null, null, null, null, null, null, null, null, null])

  // Fila de total con autosuma en columna D
  rows.push([
    {
      value: `Total registros: ${movements.length}`,
      fontWeight: 'bold',
      align: 'center'
    },
    null,
    null,
    {
      value: `=SUM(D2:D${lastDataRow})`,
      type: 'Formula',
      format: '#,##0.00',
      fontWeight: 'bold',
      align: 'center'
    },
    null,
    null,
    null,
    null,
    null
  ])

  return rows
}

/**
 * Exporta los movimientos exclusivamente del DÍA agrupados por caja en hojas independientes.
 * Las hojas quedan ordenadas (Caja 1, Caja 2, Caja 3...) con texto centrado y autosuma en Monto.
 *
 * @param {Array} movements - Lista de movimientos a exportar.
 * @param {Object} [options]
 * @param {string} [options.prefix] - Prefijo opcional del archivo.
 * @param {boolean} [options.onlyToday=true] - Si solo exporta los de hoy.
 */
export async function exportMovementsToExcel(movements, options = {}) {
  if (!movements || movements.length === 0) {
    throw new Error('No hay movimientos para exportar.')
  }

  // Filtrar exclusivamente los movimientos de hoy
  const onlyToday = options.onlyToday !== false
  const targetMovements = onlyToday
    ? movements.filter((item) => isToday(item.at))
    : movements

  if (targetMovements.length === 0) {
    throw new Error('No hay movimientos registrados el día de hoy para exportar.')
  }

  // Agrupar movimientos por caja
  const groups = new Map()
  for (const item of targetMovements) {
    const key = item.label || item.username || 'General'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  }

  // Ordenar las cajas por nombre numérico natural: Caja 1, Caja 2, Caja 3, etc.
  const sortedCajaNames = Array.from(groups.keys()).sort(compareCajas)

  const usedNames = new Set()
  const sheets = []

  for (const cajaName of sortedCajaNames) {
    const groupItems = groups.get(cajaName)
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

  return {
    ok: true,
    fileName,
    sheetsCount: sheets.length,
    totalRecords: targetMovements.length
  }
}
