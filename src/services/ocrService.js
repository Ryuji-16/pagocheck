import { createWorker } from 'tesseract.js'
import { BANKS, formatBankLabel } from './banks'

let workerPromise = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('spa')
  }
  return workerPromise
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatPhone(value) {
  const all = digitsOnly(value).replace(/^58/, '')
  const local = all.startsWith('0') ? all : `0${all}`
  if (local.length !== 11 || !local.startsWith('04')) return ''
  return `${local.slice(0, 4)}-${local.slice(4)}`
}

function normalizeOcr(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const RECEIVER_LABEL =
  /beneficiar|receptor|destino|comercio|tienda|recib|celular de destino|telf beneficiario/
const PAYER_LABEL =
  /pagador|emisor|remitente|ordenante|celular de origen|n[uú]mero celular de origen|cuenta\/tel[eé]fono|telefono origen|n[uú]mero origen|banco origen.{0,40}/

function extractPayerPhone(text) {
  const compact = text.replace(/\s+/g, ' ')
  const phonePattern = /(?:\+?58)?\(?0?4\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g
  const payerPhones = []
  let match

  while ((match = phonePattern.exec(compact))) {
    const formatted = formatPhone(match[0])
    if (!formatted) continue

    const start = Math.max(0, match.index - 56)
    const context = compact.slice(start, match.index + match[0].length).toLowerCase()

    if (RECEIVER_LABEL.test(context)) continue
    if (PAYER_LABEL.test(context)) payerPhones.push(formatted)
  }

  return payerPhones[0] || ''
}

const BANK_ALIASES = {
  '0102': ['0102', 'pagomovilbdv', 'pagomevilbdv', 'bdvapp', 'banco de venezuela'],
  '0104': ['0104', 'venezolano de credito', 'bvc'],
  '0105': ['0105', 'mercantil', 'tpago'],
  '0108': ['0108', 'provincial', 'bbva'],
  '0114': ['0114', 'bancaribe'],
  '0115': ['0115', 'exterior'],
  '0128': ['0128', 'caroni'],
  '0134': ['0134', 'banesco'],
  '0137': ['0137', 'sofitasa'],
  '0138': ['0138', 'plaza'],
  '0151': ['0151', 'bfc', 'fondo comun'],
  '0156': ['0156', '100% banco'],
  '0157': ['0157', 'delsur'],
  '0163': ['0163', 'tesoro'],
  '0168': ['0168', 'bancrecer'],
  '0171': ['0171', 'activo'],
  '0172': ['0172', 'bancamiga'],
  '0174': ['0174', 'banplus'],
  '0175': ['0175', 'trabajadores'],
  '0177': ['0177', 'banfanb', 'fanb'],
  '0178': ['0178', 'n58'],
  '0191': ['0191', 'bnc', 'nacional de credito']
}

function findBankByAliases(haystack) {
  for (const bank of BANKS) {
    const aliases = BANK_ALIASES[bank.code] || [bank.code, bank.name.toLowerCase()]
    if (aliases.some((alias) => haystack.includes(alias))) return bank
  }
  return null
}

function detectBank(text) {
  const lower = normalizeOcr(text)

  const emisor = lower.match(
    /banco\s*(emisor|origen)\s*[:\-]?\s*([a-z0-9 .]{3,40})/
  )
  if (emisor) {
    const found = findBankByAliases(emisor[2])
    if (found) return found
  }

  const originCode = lower.match(
    /(?:instrumento\s+origen|origen)\s*[:\-]?\s*(01\d{2})/
  )
  if (originCode) {
    const found = BANKS.find((item) => item.code === originCode[1])
    if (found) return found
  }

  if (/cta\.?\s*corriente\s*bnc|\bbnc\b/.test(lower.slice(0, 400))) {
    return BANKS.find((item) => item.code === '0191') || null
  }

  if (/tpago|mercantil/.test(lower.slice(0, 500))) {
    return BANKS.find((item) => item.code === '0105') || null
  }

  if (/pagom[oev]+vil\s*bdv|pagom[oev]+vilbdv|bdvapp|pagomovilbdv/.test(lower)) {
    return BANKS.find((item) => item.code === '0102') || null
  }

  const header = lower.slice(0, 280)
  const withoutDestination = lower
    .replace(/telf?\s*beneficiar[\s\S]{0,48}/g, ' ')
    .replace(/beneficiar[\s\S]{0,80}/g, ' ')
    .replace(/banco\s*(destino|receptor)\s*[:\-][\s\S]{0,60}/g, ' ')
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
  diciembre: '12'
}

function extractDate(compact) {
  const numeric = compact.match(/\b(\d{2})[/-](\d{2})[/-](\d{2,4})\b/)
  if (numeric) {
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]
    return `${numeric[1]}/${numeric[2]}/${year}`
  }

  const named = normalizeOcr(compact).match(
    /\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/
  )
  if (named) {
    const day = named[1].padStart(2, '0')
    return `${day}/${MONTHS[named[2]]}/${named[3]}`
  }

  return ''
}

function extractReference(compact) {
  const labeled = compact.match(
    /(?:n[uú]mero\s+de\s+referencia|nro\.?\s*de\s+referencia|referencia|operaci[oó]n)\s*[:\-]?\s*(\d{6,14})/i
  )
  if (labeled) return labeled[1]

  return ''
}

function extractAmount(compact) {
  const labeled = compact.match(
    /(?:monto(?:\s+de\s+la\s+operaci[oó]n)?(?:\s*\(bs\.?\))?|bs\.?)\s*[:\-]?\s*([0-9]{1,3}(?:[.\s'][0-9]{3})*(?:,[0-9]{2})|[0-9]+,[0-9]{2})/i
  )
  if (labeled) return `Bs. ${labeled[1].replace(/'/g, '.')}`

  const after = compact.match(
    /([0-9]{1,3}(?:[.\s][0-9]{3})*,[0-9]{2})\s*bs/i
  )
  if (after) return `Bs. ${after[1]}`

  return ''
}

function parsePaymentText(text) {
  const raw = String(text || '')
  const compact = raw.replace(/\s+/g, ' ')

  return {
    reference: extractReference(compact),
    date: extractDate(compact),
    bank: (() => {
      const item = detectBank(compact)
      return item ? formatBankLabel(item) : ''
    })(),
    amount: extractAmount(compact),
    phone: extractPayerPhone(compact),
    rawText: raw.trim()
  }
}

export async function extractPaymentData(file) {
  if (!file) {
    throw new Error('No se recibió ningún comprobante.')
  }

  const worker = await getWorker()
  const { data } = await worker.recognize(file)
  return parsePaymentText(data?.text || '')
}
