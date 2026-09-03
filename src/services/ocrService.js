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

const RECEIVER_LABEL =
  /beneficiar|receptor|destino|comercio|tienda|recib|para\b|afiliad[oa] (?:del )?comercio/
const PAYER_LABEL =
  /pagador|origen|emisor|remitente|ordenante|cliente|desde\b|tel[eé]fono origen|n[uú]mero origen/

function extractPayerPhone(text) {
  const compact = text.replace(/\s+/g, ' ')
  const phonePattern = /(?:\+?58)?0?4\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g
  const payerPhones = []
  let match

  while ((match = phonePattern.exec(compact))) {
    const formatted = formatPhone(match[0])
    if (!formatted) continue

    const start = Math.max(0, match.index - 48)
    const context = compact.slice(start, match.index + match[0].length).toLowerCase()

    if (RECEIVER_LABEL.test(context)) continue
    if (PAYER_LABEL.test(context)) payerPhones.push(formatted)
  }

  return payerPhones[0] || ''
}


const BANK_ALIASES = {
  '0102': ['0102', 'bdv', 'banco de venezuela', 'de venezuela'],
  '0104': ['0104', 'venezolano de credito', 'bvc'],
  '0105': ['0105', 'mercantil'],
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

function detectBank(text) {
  const lower = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  for (const bank of BANKS) {
    const aliases = BANK_ALIASES[bank.code] || [bank.code, bank.name.toLowerCase()]
    if (aliases.some((alias) => lower.includes(alias))) {
      return bank
    }
  }

  const codeMatch = text.match(/\b(01\d{2})\b/)
  if (codeMatch) {
    return BANKS.find((item) => item.code === codeMatch[1]) || null
  }

  return null
}

function parsePaymentText(text) {
  const raw = String(text || '')
  const compact = raw.replace(/\s+/g, ' ')

  const dateMatch = compact.match(/\b(\d{2})[/-](\d{2})[/-](\d{2,4})\b/)
  let date = ''
  if (dateMatch) {
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]
    date = `${dateMatch[1]}/${dateMatch[2]}/${year}`
  }

  const phone = extractPayerPhone(compact)

  const referenceMatch =
    compact.match(/(?:ref(?:erencia)?|nro|n[úu]mero|operaci[oó]n)[^\d]{0,12}(\d{6,12})/i) ||
    compact.match(/\b(\d{8,12})\b/)
  const reference = referenceMatch ? referenceMatch[1] : ''

  const amountMatch = compact.match(
    /(?:bs\.?|ves)?\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+,[0-9]{2})/i
  )
  const amount = amountMatch ? `Bs. ${amountMatch[1]}` : ''

  const bankItem = detectBank(compact)

  return {
    reference,
    date,
    bank: bankItem ? formatBankLabel(bankItem) : '',
    amount,
    phone,
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
