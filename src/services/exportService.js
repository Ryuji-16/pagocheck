import writeXlsxFile from 'write-excel-file/browser'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

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

export function isToday(dateValue) {
  if (!dateValue && dateValue !== 0) return false
  try {
    const now = new Date()
    const str = String(dateValue).trim()

    // 1. Coincidencia directa con fecha de hoy formateada (Caracas, Local y UTC)
    const localYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const localDMY = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
    const localDMYDash = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

    let caracasYMD = ''
    let caracasDMY = ''
    let caracasDMYDash = ''
    try {
      caracasYMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(now)
      const [cy, cm, cd] = caracasYMD.split('-')
      caracasDMY = `${cd}/${cm}/${cy}`
      caracasDMYDash = `${cd}-${cm}-${cy}`
    } catch (e) {
      void e
    }

    const utcYMD = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    const utcDMY = `${String(now.getUTCDate()).padStart(2, '0')}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${now.getUTCFullYear()}`

    const todayPatterns = [
      localYMD,
      localDMY,
      localDMYDash,
      caracasYMD,
      caracasDMY,
      caracasDMYDash,
      utcYMD,
      utcDMY
    ].filter(Boolean)

    for (const pat of todayPatterns) {
      if (str.startsWith(pat) || str.includes(pat)) {
        return true
      }
    }

    // 2. Parsear el valor de fecha según su formato
    let d = null
    if (typeof dateValue === 'number' || /^\d{10,13}$/.test(str)) {
      d = new Date(Number(dateValue))
    } else {
      const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
      if (ymd && !str.includes('T') && !str.includes(':')) {
        d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0)
      } else {
        const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
        if (dmy && !str.includes('T')) {
          d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0)
        } else {
          d = new Date(dateValue)
        }
      }
    }

    if (!d || Number.isNaN(d.getTime())) return false

    // 3. Comparar fecha local
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      return true
    }

    // 4. Comparar fecha en zona horaria de Venezuela (America/Caracas)
    if (caracasYMD) {
      try {
        const dCaracas = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(d)
        if (dCaracas === caracasYMD) return true
      } catch (e) {
        void e
      }
    }

    // 5. Comparar fecha en UTC
    if (
      d.getUTCFullYear() === now.getUTCFullYear() &&
      d.getUTCMonth() === now.getUTCMonth() &&
      d.getUTCDate() === now.getUTCDate()
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}

function formatWhen(value) {
  if (!value && value !== 0) return ''
  try {
    let date = null
    if (typeof value === 'number' || /^\d{10,13}$/.test(String(value).trim())) {
      date = new Date(Number(value))
    } else {
      date = new Date(value)
    }
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
  { value: 'Sucursal', ...HEADER_STYLE },
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
  { width: 22 }, // Sucursal
  { width: 16 }, // Tipo
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
  let cajaTotal = 0

  for (const item of movements) {
    const numAmount = parseAmount(item.amount)
    cajaTotal += numAmount

    const itemDate = item.at || item.created_at || item.date || item.timestamp
    rows.push([
      { value: formatWhen(itemDate), align: 'center' },
      { value: item.branch || 'General', align: 'center' },
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
  rows.push([null, null, null, null, null, null, null, null, null, null])

  const valids = movements.filter((m) => m.type === 'validacion').length
  const vueltos = movements.filter((m) => m.type === 'vuelto').length
  let totalLabel = `Total registros: ${movements.length}`
  if (valids > 0 && vueltos > 0) {
    totalLabel += ` (${valids} val, ${vueltos} vueltos)`
  } else if (vueltos > 0) {
    totalLabel += ` (${vueltos} vueltos)`
  }

  // Fila de total con autosuma en columna E
  rows.push([
    {
      value: totalLabel,
      fontWeight: 'bold',
      align: 'center'
    },
    null,
    null,
    null,
    {
      value: `=SUM(E2:E${lastDataRow})`,
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

  return { rows, cajaTotal }
}

/**
 * Exporta los movimientos (validaciones y vueltos) exclusivamente del DÍA agrupados por caja en hojas independientes.
 * Las hojas quedan ordenadas (Caja 1, Caja 2, Caja 3...) con texto centrado y autosuma evaluada en Monto.
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
    ? movements.filter((item) =>
        isToday(item.at || item.created_at || item.date || item.timestamp)
      )
    : movements

  if (targetMovements.length === 0) {
    throw new Error('No hay validaciones ni vueltos registrados el día de hoy para exportar.')
  }

  // Agrupar movimientos por sucursal y caja
  const groups = new Map()
  for (const item of targetMovements) {
    const branchPart = item.branch ? `${item.branch} · ` : ''
    const key = `${branchPart}${item.label || item.username || 'Caja'}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  }

  // Ordenar las cajas por nombre numérico natural: Caja 1, Caja 2, Caja 3, etc.
  const sortedCajaNames = Array.from(groups.keys()).sort(compareCajas)

  const usedNames = new Set()
  const sheets = []
  const sheetTotals = []

  for (const cajaName of sortedCajaNames) {
    const groupItems = groups.get(cajaName)
    const sheetTitle = sanitizeSheetName(cajaName, usedNames)
    const { rows, cajaTotal } = buildSheetData(cajaName, groupItems)

    sheets.push({
      sheet: sheetTitle,
      columns: COLUMNS,
      data: rows
    })
    sheetTotals.push(cajaTotal)
  }

  const now = new Date()
  const dateSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const fileName = `${options.prefix || 'pagocheck_movimientos'}_${dateSuffix}.xlsx`

  // Generar buffer inicial
  const initialBlob = await writeXlsxFile(sheets).toBlob()
  const arrayBuffer = await initialBlob.arrayBuffer()
  const unzipped = unzipSync(new Uint8Array(arrayBuffer))

  // 1. Activar recalculación automática en Excel (calcPr fullCalcOnLoad="1")
  if (unzipped['xl/workbook.xml']) {
    let wb = strFromU8(unzipped['xl/workbook.xml'])
    wb = wb.replace(/<calcPr\s*\/>|<calcPr[^>]*\/>/i, '<calcPr fullCalcOnLoad="1"/>')
    unzipped['xl/workbook.xml'] = strToU8(wb)
  }

  // 2. Corregir formato OpenXML de la fórmula (sin '=' al inicio) y pre-inyectar <v> con el total
  // para que Excel muestre el resultado inmediatamente sin esperar recálculo manual
  for (let i = 0; i < sheets.length; i++) {
    const sheetFile = `xl/worksheets/sheet${i + 1}.xml`
    if (unzipped[sheetFile]) {
      let s = strFromU8(unzipped[sheetFile])
      const totalVal = (sheetTotals[i] || 0).toFixed(2)
      s = s.replace(/<f>=?([^<]+)<\/f>/g, (_, f) => `<f>${f}</f><v>${totalVal}</v>`)
      unzipped[sheetFile] = strToU8(s)
    }
  }

  const finalZip = zipSync(unzipped)
  const finalBlob = new Blob([finalZip], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  // Descargar el archivo final optimizado en el navegador
  if (typeof window !== 'undefined' && window.URL && document.createElement) {
    const url = window.URL.createObjectURL(finalBlob)
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

  const validacionesCount = targetMovements.filter((m) => m.type === 'validacion').length
  const vueltosCount = targetMovements.filter((m) => m.type === 'vuelto').length
  const totalMonto = targetMovements.reduce((sum, m) => sum + parseAmount(m.amount), 0)

  return {
    ok: true,
    fileName,
    sheetsCount: sheets.length,
    validacionesCount,
    vueltosCount,
    totalRecords: targetMovements.length,
    totalMonto
  }
}
