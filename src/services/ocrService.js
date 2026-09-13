import { createWorker } from 'tesseract.js'
import { BANKS, formatBankLabel } from './banks.js'

let workerPromise = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('spa')
      await worker.setParameters({
        tessedit_pageseg_mode: '6'
      })
      return worker
    })()
  }
  return workerPromise
}

async function prepareImage(file) {
  try {
    if (typeof createImageBitmap !== 'function') return file

    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)

    // Si la imagen tiene dimensiones estándar (<= 2000px), retornar el archivo original
    // directamente para no degradar el texto ni introducir artefactos de compresión.
    if (longest <= 2000) {
      bitmap.close?.()
      return file
    }

    // Reducir proporcionalmente fotos gigantescas para evitar desbordamiento de memoria
    const scale = 2000 / longest
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      bitmap.close?.()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result || file), 'image/png')
    })
    return blob || file
  } catch {
    return file
  }
}

function hasExtractedFields(data) {
  return Boolean(
    data?.reference || data?.date || data?.bank || data?.amount || data?.phone
  )
}

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

/**
 * Corrige confusiones típicas de OCR en cadenas que deberían ser numéricas
 * (ej: letras 'O', 'o' por '0'; 'I', 'l', '|' por '1'; 'S', 's' por '5'; 'B' por '8').
 */
export function cleanOcrDigits(value) {
  if (!value) return ''
  return String(value)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|i]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Zz]/g, '2')
    .replace(/[Bb]/g, '8')
    .replace(/\D/g, '')
}

export function formatPhone(value) {
  const cleaned = cleanOcrDigits(value)
  const withoutCountry = cleaned.replace(/^58/, '')
  const local = withoutCountry.startsWith('0') ? withoutCountry : `0${withoutCountry}`
  if (local.length !== 11 || !local.startsWith('04')) return ''
  return `${local.slice(0, 4)}-${local.slice(4)}`
}

export function normalizeOcr(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const RECEIVER_LABEL =
  /beneficiar|receptor|destino|comercio|tienda|recib|celular(?:\s*de)?\s*destino|telf(?:\s*de)?\s*destino|telf\s*beneficiario|n[uú]mero(?:\s*de)?\s*destino/i
const PAYER_LABEL =
  /pagador|emisor|remitente|ordenante|celular(?:\s*de)?\s*origen|n[uú]mero(?:\s*celular)?(?:\s*de)?\s*origen|cuenta\s*\/\s*(?:t[eé]l[eé]f|rel[eé]f|cel|m[oó]vil|telf)|tel[eé]fono(?:\s*de)?\s*origen|n[uú]mero(?:\s*de)?\s*origen|banco\s*(?:de\s*)?origen/i

export function extractPayerPhone(text) {
  const compact = text.replace(/\s+/g, ' ')
  // Reconoce teléfonos con posibles caracteres OCR confusos (ej: O414, 269-83-O1)
  const phonePattern =
    /(?:(?:\+?58\s*)?\(?0?[124][0-9OlSsBb]{2}\)?[\s.-]?[0-9OlSsBb]{3}[\s.-]?[0-9OlSsBb]{2}[\s.-]?[0-9OlSsBb]{2}|(?:\+?58\s*)?0?[124][0-9OlSsBb]{9})/gi
  const payerPhones = []
  const candidatePhones = []
  let match

  while ((match = phonePattern.exec(compact))) {
    const formatted = formatPhone(match[0])
    if (!formatted) continue

    const start = Math.max(0, match.index - 120)
    const context = compact.slice(start, match.index + match[0].length).toLowerCase()

    if (RECEIVER_LABEL.test(context)) continue

    if (PAYER_LABEL.test(context)) {
      payerPhones.push(formatted)
    } else {
      candidatePhones.push(formatted)
    }
  }

  if (payerPhones.length > 0) {
    return payerPhones[0]
  }

  return candidatePhones[0] || ''
}

export const BANK_ALIASES = {
  '0102': ['0102', 'pagomovilbdv', 'pagomevilbdv', 'bdvapp', 'banco de venezuela', 'bdv'],
  '0104': ['0104', 'venezolano de credito', 'bvc'],
  '0105': ['0105', 'mercantil', 'tpago', 't-pago'],
  '0108': ['0108', 'provincial', 'bbva', 'bbva provincial'],
  '0114': ['0114', 'bancaribe', 'mi conexion bancaribe'],
  '0115': ['0115', 'exterior', 'banco exterior'],
  '0128': ['0128', 'caroni', 'banco caroni'],
  '0134': ['0134', 'banesco', 'banescomovil', 'pagomovil banesco'],
  '0137': ['0137', 'sofitasa'],
  '0138': ['0138', 'plaza', 'banco plaza'],
  '0151': ['0151', 'bfc', 'fondo comun', 'banco fondo comun'],
  '0156': ['0156', '100% banco', '100%banco'],
  '0157': ['0157', 'delsur', 'del sur'],
  '0163': ['0163', 'tesoro', 'banco del tesoro'],
  '0168': ['0168', 'bancrecer'],
  '0171': ['0171', 'activo', 'banco activo'],
  '0172': ['0172', 'bancamiga', 'pago movil bancamiga'],
  '0174': ['0174', 'banplus'],
  '0175': ['0175', 'trabajadores', 'bicentenario'],
  '0177': ['0177', 'banfanb', 'fanb'],
  '0178': ['0178', 'n58'],
  '0191': ['0191', 'bnc', 'nacional de credito', 'banco nacional de credito']
}

function findBankByAliases(haystack) {
  for (const bank of BANKS) {
    const aliases = BANK_ALIASES[bank.code] || [bank.code, bank.name.toLowerCase()]
    if (aliases.some((alias) => haystack.includes(alias))) return bank
  }
  return null
}

export function detectBank(text) {
  const lower = normalizeOcr(text)

  // 1. Detección por encabezado o mención de banco emisor/origen
  const emisor = lower.match(
    /banco\s*(?:emisor|origen)\s*[-:]?\s*([a-z0-9 .]{3,40})/
  )
  if (emisor) {
    const found = findBankByAliases(emisor[1])
    if (found) return found
  }

  // 2. Detección por código de 4 dígitos (0102, 0134, etc.)
  const originCode = lower.match(
    /(?:instrumento\s+origen|banco\s+origen|origen)\s*[-:]?\s*(01\d{2})/
  )
  if (originCode) {
    const found = BANKS.find((item) => item.code === originCode[1])
    if (found) return found
  }

  // 3. Firmas directas de apps bancarias reconocidas
  if (/cta\.?\s*corriente\s*bnc|\bbnc\b/.test(lower.slice(0, 400))) {
    return BANKS.find((item) => item.code === '0191') || null
  }

  if (/tpago|mercantil/.test(lower.slice(0, 500))) {
    return BANKS.find((item) => item.code === '0105') || null
  }

  if (/pagom[oev]+vil\s*bdv|pagom[oev]+vilbdv|bdvapp|pagomovilbdv|banco de venezuela/.test(lower.slice(0, 600))) {
    return BANKS.find((item) => item.code === '0102') || null
  }

  if (/banesco|banescom[oó]vil/.test(lower.slice(0, 500))) {
    return BANKS.find((item) => item.code === '0134') || null
  }

  if (/provincial|bbva/.test(lower.slice(0, 500))) {
    return BANKS.find((item) => item.code === '0108') || null
  }

  if (/bancamiga/.test(lower.slice(0, 500))) {
    return BANKS.find((item) => item.code === '0172') || null
  }

  const header = lower.slice(0, 300)
  const withoutDestination = lower
    .replace(/telf?\s*beneficiar[\s\S]{0,48}/g, ' ')
    .replace(/beneficiar[\s\S]{0,80}/g, ' ')
    .replace(/banco\s*(?:destino|receptor)\s*[-:][\s\S]{0,60}/g, ' ')
    .replace(/\bbanco\s*:\s*[\s\S]{0,48}/g, ' ')

  return findBankByAliases(header) || findBankByAliases(withoutDestination)
}

const MONTHS = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dic: '12'
}

export function isValidDate(d, m, y) {
  const day = Number(d)
  const month = Number(m)
  const year = Number(String(y).length === 2 ? `20${y}` : y)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  if (year < 2020 || year > 2035) return false
  const maxDays = new Date(year, month, 0).getDate()
  return day <= maxDays
}

export function extractDate(compact) {
  const norm = normalizeOcr(compact)

  // 1. Fecha nombrada con etiqueta explícita (ej: 'Fechay Hora 10 agosto 2026', 'Fecha: 13 de septiembre de 2026')
  const labeledNamed = norm.match(
    /(?:fecha(?:\s*y\s*hora|yhora|\s*hora)?(?:\s*de\s*la\s*operaci[oó]n)?(?:\s*valor)?)\s*[-:]?\s*(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/i
  )
  if (labeledNamed && MONTHS[labeledNamed[2]]) {
    const day = labeledNamed[1].padStart(2, '0')
    const month = MONTHS[labeledNamed[2]]
    const year = labeledNamed[3]
    if (isValidDate(day, month, year)) return `${day}/${month}/${year}`
  }

  // 2. Fecha numérica con etiqueta explícita (ej: 'Fecha: 12/09/2026', 'Fecha y hora: 10/08/2026')
  const labeledNumeric = compact.match(
    /(?:fecha(?:\s*y\s*hora|yhora|\s*hora)?(?:\s*de\s*la\s*operaci[oó]n)?(?:\s*valor)?)\s*[-:]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i
  )
  if (labeledNumeric) {
    const day = labeledNumeric[1].padStart(2, '0')
    const month = labeledNumeric[2].padStart(2, '0')
    const year = labeledNumeric[3].length === 2 ? `20${labeledNumeric[3]}` : labeledNumeric[3]
    if (isValidDate(day, month, year)) return `${day}/${month}/${year}`
  }

  // 3. Fecha nombrada sin etiqueta explícita (ej: '10 agosto 2026')
  const named = norm.match(
    /\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(?:de\s+)?(\d{4})\b/i
  )
  if (named && MONTHS[named[2]]) {
    const day = named[1].padStart(2, '0')
    const month = MONTHS[named[2]]
    const year = named[3]
    if (isValidDate(day, month, year)) return `${day}/${month}/${year}`
  }

  // 4. Fecha numérica sin etiqueta explícita (estrictamente validada para no confundir fragmentos telefónicos)
  const numericPattern = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g
  let match
  while ((match = numericPattern.exec(compact))) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    if (isValidDate(day, month, year)) {
      return `${day}/${month}/${year}`
    }
  }

  return ''
}

/**
 * Extrae el número de referencia completo (sin truncar a los últimos 6 dígitos),
 * sanitizando posibles errores visuales de OCR y evitando falsos positivos de estado.
 */
export function extractReference(compact) {
  // Patrón 1: Etiquetas bancarias explícitas (Banesco, BDV, Mercantil, Provincial, Ubii, etc.)
  const refLabelRegex =
    /(?:n[uú]mero\s+de\s+referencia|nro\.?\s*(?:de\s*)?referencia|n[°º]\.?\s*(?:de\s*)?referencia|referencia|ref\b\.?|n[°º]\s*de\s*operaci[oó]n|operaci[oó]n\s*(?:nro|n[°º]|#|\.)|secuencia|aprobaci[oó]n|confirmaci[oó]n|transacci[oó]n\s*(?:nro|n[°º]|#|\.)?)\s*[-:#.]*\s*([^\n\r]{1,40})/gi

  let match
  while ((match = refLabelRegex.exec(compact))) {
    const snippet = match[1]
    const tokens = snippet.split(/[\s,;:()[\]{}]+/)
    for (const token of tokens) {
      if (/^[a-zA-Z]+$/.test(token) && !/[0-9]/.test(token)) continue
      let digits = cleanOcrDigits(token)

      // Si tiene 13 dígitos y empieza por un dígito seguido de 3+ ceros (ej: '2000000755544'),
      // el primer dígito es ruido visual de OCR adherido al número estándar de 12 dígitos (RRN).
      if (digits.length === 13 && /^([1-9])(0{3,}\d{6,})$/.test(digits)) {
        digits = digits.slice(1)
      }

      if (digits.length >= 4) {
        return digits
      }
    }
  }

  // Patrón 2: Referencia aislada tras dos puntos o palabra ref
  const fallbackPattern = /\bref\b\s*[:.-]?\s*([0-9A-Za-z|]{4,16})/gi
  while ((match = fallbackPattern.exec(compact))) {
    const candidate = match[1]
    if (/^[a-zA-Z]+$/.test(candidate) && !/[0-9]/.test(candidate)) continue
    let digits = cleanOcrDigits(candidate)
    if (digits.length === 13 && /^([1-9])(0{3,}\d{6,})$/.test(digits)) {
      digits = digits.slice(1)
    }
    if (digits.length >= 4) {
      return digits
    }
  }

  return ''
}

/**
 * Extrae y normaliza el monto de la transacción en formato venezolano estándar: 'Bs. 1.250,50'
 */
export function extractAmount(compact) {
  // 1. Monto precedido o seguido de etiqueta explícita
  const labeled = compact.match(
    /(?:monto(?:\s+de\s+la\s+operaci[oó]n)?(?:\s*\(bs\.?\))?|importe|total(?:\s+pagado)?|total)\s*[-:]?\s*(?:bs\.?|ves|usd|\$)?\s*([0-9]{1,3}(?:[.\s'][0-9]{3})*(?:,[0-9]{1,2})|[0-9]+,[0-9]{1,2}|[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/i
  )
  if (labeled) {
    let cleanVal = labeled[1].replace(/'/g, '.').trim()
    // Si viene con formato punto decimal (ej: 1250.50), convertir a coma decimal
    if (/^[0-9]+(?:\.[0-9]{2})$/.test(cleanVal)) {
      cleanVal = cleanVal.replace('.', ',')
    }
    // Si solo tiene un decimal (ej: 1250,5), completar con cero
    if (/,\d$/.test(cleanVal)) {
      cleanVal += '0'
    }
    return `Bs. ${cleanVal}`
  }

  // 2. Monto con símbolo Bs / VES
  const withCurrency = compact.match(
    /(?:bs\.?|ves)\s*[-:]?\s*([0-9]{1,3}(?:[.\s'][0-9]{3})*(?:,[0-9]{1,2})|[0-9]+,[0-9]{1,2})/i
  )
  if (withCurrency) {
    let cleanVal = withCurrency[1].replace(/'/g, '.').trim()
    if (/,\d$/.test(cleanVal)) cleanVal += '0'
    return `Bs. ${cleanVal}`
  }

  // 3. Monto seguido de Bs
  const after = compact.match(
    /([0-9]{1,3}(?:[.\s'][0-9]{3})*,[0-9]{1,2})\s*(?:bs\.?|ves)/i
  )
  if (after) {
    let cleanVal = after[1].trim()
    if (/,\d$/.test(cleanVal)) cleanVal += '0'
    return `Bs. ${cleanVal}`
  }

  return ''
}

/**
 * Evalúa la completitud y calidad de los datos extraídos del comprobante.
 * Identifica qué campos mandatorios faltan y asigna un puntaje de confianza.
 *
 * @param {object} data
 * @param {string} [data.reference]
 * @param {string} [data.bank]
 * @param {string} [data.amount]
 * @param {string} [data.phone]
 * @param {string} [data.date]
 * @returns {{ isValid: boolean, isComplete: boolean, confidence: number, missingFields: string[], warnings: string[] }}
 */
export function validatePaymentData(data = {}) {
  const missingFields = []
  const warnings = []
  let score = 0

  // 1. Referencia (35 puntos)
  const refDigits = digitsOnly(data.reference)
  if (!refDigits) {
    missingFields.push('reference')
  } else if (refDigits.length < 4) {
    warnings.push('La referencia detectada es muy corta (menos de 4 dígitos).')
    score += 15
  } else {
    score += 35
  }

  // 2. Banco (25 puntos)
  if (!data.bank || String(data.bank).trim() === '') {
    missingFields.push('bank')
  } else {
    score += 25
  }

  // 3. Monto (20 puntos)
  if (!data.amount || String(data.amount).trim() === '') {
    missingFields.push('amount')
  } else {
    score += 20
  }

  // 4. Teléfono (10 puntos)
  if (!data.phone || String(data.phone).trim() === '') {
    missingFields.push('phone')
  } else if (!/^04\d{2}-\d{7}$/.test(String(data.phone).trim()) && !/^04\d{9}$/.test(String(data.phone).trim())) {
    warnings.push('El teléfono no cumple el formato móvil venezolano estándar (04XX-XXXXXXX).')
    score += 5
  } else {
    score += 10
  }

  // 5. Fecha (10 puntos)
  if (!data.date || String(data.date).trim() === '') {
    missingFields.push('date')
  } else if (!/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(String(data.date).trim())) {
    warnings.push('La fecha no cumple el formato estándar DD/MM/AAAA.')
    score += 5
  } else {
    score += 10
  }

  const isValid = Boolean(refDigits && refDigits.length >= 4 && data.bank)
  const isComplete = missingFields.length === 0

  return {
    isValid,
    isComplete,
    confidence: Math.min(100, Math.max(0, score)),
    missingFields,
    warnings
  }
}

export function parsePaymentText(text) {
  const raw = String(text || '')
  const compact = raw.replace(/\s+/g, ' ')

  const reference = extractReference(compact)
  const date = extractDate(compact)
  const detectedBank = detectBank(compact)
  const bank = detectedBank ? formatBankLabel(detectedBank) : ''
  const amount = extractAmount(compact)
  const phone = extractPayerPhone(compact)

  const validation = validatePaymentData({
    reference,
    date,
    bank,
    amount,
    phone
  })

  return {
    reference,
    date,
    bank,
    amount,
    phone,
    validation,
    rawText: raw.trim()
  }
}

export async function extractPaymentData(file) {
  if (!file) {
    throw new Error('No se recibió ningún comprobante.')
  }

  const worker = await getWorker()
  const prepared = await prepareImage(file)
  const first = await worker.recognize(prepared)
  const parsed = parsePaymentText(first?.data?.text || '')

  if (hasExtractedFields(parsed) || prepared === file) {
    return parsed
  }

  const second = await worker.recognize(file)
  return parsePaymentText(second?.data?.text || '')
}
