import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

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

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Inserta mini cuadros sin fórmulas por caja en la hoja del día seleccionado
 * dentro de las columnas U y V (libres de la plantilla de arqueo).
 *
 * @param {ArrayBuffer|Uint8Array} fileBuffer - Contenido binario del archivo de arqueo.
 * @param {number|string} dayNumber - Día del mes (1 al 31).
 * @param {Array} movements - Lista de movimientos.
 * @param {string} originalFileName - Nombre del archivo subido.
 */
export async function injectMiniCuadrosIntoArqueo(
  fileBuffer,
  dayNumber,
  movements = [],
  originalFileName = 'arqueo_actualizado.xlsx'
) {
  const targetDay = String(dayNumber).trim()
  const unzipped = unzipSync(new Uint8Array(fileBuffer))

  if (!unzipped['xl/workbook.xml'] || !unzipped['xl/_rels/workbook.xml.rels']) {
    throw new Error('El archivo seleccionado no parece ser un archivo de Excel (.xlsx) válido.')
  }

  const wbXml = strFromU8(unzipped['xl/workbook.xml'])
  const relsXml = strFromU8(unzipped['xl/_rels/workbook.xml.rels'])

  // Localizar la hoja del día (ej. '9', '09', '9,' etc.)
  const sheetRegex = /<sheet[^>]*name=["']([^"']+)["'][^>]*r:id=["']([^"']+)["']|<sheet[^>]*r:id=["']([^"']+)["'][^>]*name=["']([^"']+)["']/gi
  let match
  let targetRId = null
  let matchedSheetName = null

  while ((match = sheetRegex.exec(wbXml)) !== null) {
    const name = (match[1] || match[4] || '').trim()
    const rId = match[2] || match[3]

    if (
      name === targetDay ||
      name === targetDay.padStart(2, '0') ||
      name.startsWith(`${targetDay},`) ||
      name.startsWith(`${targetDay} `)
    ) {
      targetRId = rId
      matchedSheetName = name
      break
    }
  }

  if (!targetRId) {
    throw new Error(
      `No se encontró la pestaña del día ${targetDay} en el archivo de arqueo proporcionado.`
    )
  }

  // Buscar la ruta del archivo xml de la hoja en los relationships
  const relRegex = new RegExp(
    `<Relationship[^>]*Id=["']${targetRId}["'][^>]*Target=["']([^"']+)["']`,
    'i'
  )
  const relMatch = relsXml.match(relRegex)
  if (!relMatch) {
    throw new Error(`No se pudo resolver la ruta de la hoja ${matchedSheetName}.`)
  }

  const targetPath = relMatch[1].replace(/^\//, '')
  const fullSheetPath = targetPath.startsWith('xl/') ? targetPath : `xl/${targetPath}`

  if (!unzipped[fullSheetPath]) {
    throw new Error(`No se encontró el contenido de la hoja en ${fullSheetPath}.`)
  }

  let sheetXml = strFromU8(unzipped[fullSheetPath])

  // Agrupar movimientos por caja
  const groups = new Map()
  for (const m of movements) {
    const key = m.label || m.username || 'General'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
  }

  // Si no hay movimientos en absoluto, registrar al menos un encabezado
  if (groups.size === 0) {
    groups.set('General', [])
  }

  // Preparar celdas a insertar por fila
  const cellsByRow = new Map()

  function addText(r, col, text) {
    if (!cellsByRow.has(r)) cellsByRow.set(r, [])
    cellsByRow.get(r).push({
      col,
      xml: `<c r="${col}${r}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`
    })
  }

  function addNum(r, col, num) {
    if (!cellsByRow.has(r)) cellsByRow.set(r, [])
    cellsByRow.get(r).push({
      col,
      xml: `<c r="${col}${r}"><v>${Number(num).toFixed(2)}</v></c>`
    })
  }

  let currentRow = 4
  addText(currentRow, 'U', `PAGOCHECK - RESUMEN DEL DÍA ${targetDay} (VALORES PARA COPIAR Y PEGAR)`)
  currentRow += 2

  for (const [caja, items] of groups.entries()) {
    addText(currentRow, 'U', `--- ${caja.toUpperCase()} ---`)
    currentRow++

    addText(currentRow, 'U', 'DESCRIPCIÓN / REF')
    addText(currentRow, 'V', 'MONTO (BS)')
    currentRow++

    let cajaTotal = 0

    if (items.length === 0) {
      addText(currentRow, 'U', 'Sin movimientos registrados')
      addNum(currentRow, 'V', 0)
      currentRow++
    } else {
      for (const it of items) {
        const desc = it.reference
          ? `PM ${it.reference}${it.bank ? ` (${it.bank.slice(0, 18)})` : ''}`
          : it.bank || (it.type === 'vuelto' ? 'Vuelto' : 'Pago Móvil')
        const num = parseAmount(it.amount)
        cajaTotal += num

        addText(currentRow, 'U', desc)
        addNum(currentRow, 'V', num)
        currentRow++
      }
    }

    addText(currentRow, 'U', `TOTAL ${caja.toUpperCase()}`)
    addNum(currentRow, 'V', cajaTotal)
    currentRow += 2 // espacio entre cajas
  }

  // Inserción en sheetXml conservando el orden de filas y celdas
  const sheetDataStart = sheetXml.indexOf('<sheetData>')
  const sheetDataEnd = sheetXml.indexOf('</sheetData>')

  if (sheetDataStart === -1 || sheetDataEnd === -1) {
    throw new Error('Estructura de hoja inválida: no se encontró <sheetData>.')
  }

  // Parsear filas existentes dentro de sheetData
  const preSheetData = sheetXml.slice(0, sheetDataStart + '<sheetData>'.length)
  const sheetDataContent = sheetXml.slice(sheetDataStart + '<sheetData>'.length, sheetDataEnd)
  const postSheetData = sheetXml.slice(sheetDataEnd)

  const rowRegex = /<row\s+([^>]*)>([\s\S]*?)<\/row>|<row\s+([^>]*)\/>/gi
  const existingRows = new Map()

  let rowMatch
  while ((rowMatch = rowRegex.exec(sheetDataContent)) !== null) {
    const fullMatch = rowMatch[0]
    const attrs = rowMatch[1] || rowMatch[3] || ''
    const innerContent = rowMatch[2] || ''
    const rMatch = attrs.match(/r=["'](\d+)["']/)
    if (rMatch) {
      const rNum = parseInt(rMatch[1], 10)
      existingRows.set(rNum, { fullMatch, attrs, innerContent })
    }
  }

  // Construir nuevo contenido de sheetData asegurando orden ascendente de filas
  const allRowNumbers = new Set([
    ...existingRows.keys(),
    ...cellsByRow.keys()
  ])
  const sortedRowNumbers = Array.from(allRowNumbers).sort((a, b) => a - b)

  let newSheetDataContent = ''

  for (const rNum of sortedRowNumbers) {
    const existing = existingRows.get(rNum)
    const newCells = cellsByRow.get(rNum) || []
    const newCellsXml = newCells.map((c) => c.xml).join('')

    if (existing) {
      if (newCells.length > 0) {
        // Añadir las celdas nuevas U y V al final de las celdas de la fila existente
        newSheetDataContent += `<row ${existing.attrs}>${existing.innerContent}${newCellsXml}</row>`
      } else {
        newSheetDataContent += existing.fullMatch
      }
    } else {
      // Fila nueva
      newSheetDataContent += `<row r="${rNum}">${newCellsXml}</row>`
    }
  }

  const updatedSheetXml = `${preSheetData}${newSheetDataContent}${postSheetData}`
  unzipped[fullSheetPath] = strToU8(updatedSheetXml)

  // Comprimir el libro completo con todas sus hojas y gráficos intactos
  const repackedZip = zipSync(unzipped)

  // Descargar el archivo en el navegador
  const cleanBaseName = originalFileName.replace(/\.xlsx$/i, '')
  const outFileName = `${cleanBaseName}_dia${targetDay}_actualizado.xlsx`

  const blob = new Blob([repackedZip], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  if (typeof window !== 'undefined' && window.URL && document.createElement) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = outFileName
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }, 100)
  }

  return {
    ok: true,
    fileName: outFileName,
    day: targetDay,
    cajasCount: groups.size
  }
}
