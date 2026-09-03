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

function parsePaymentText(text) {
  const raw = String(text || '')
  const compact = raw.replace(/\s+/g, ' ')

  const dateMatch = compact.match(/\b(\d{2})[/-](\d{2})[/-](\d{2,4})\b/)
  let date = ''
  if (dateMatch) {
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]
    date = `${dateMatch[1]}/${dateMatch[2]}/${year}`
  }

  const phoneMatch =
    compact.match(/\b(0?4\d{2})[\s.-]*(\d{3})[\s.-]*(\d{4})\b/) ||
    compact.match(/\b(58)?(4\d{2})(\d{7})\b/)
  let phone = ''
  if (phoneMatch) {
    const all = digitsOnly(phoneMatch[0]).replace(/^58/, '')
    const local = all.startsWith('0') ? all : `0${all}`
    if (local.length === 11) {
      phone = `${local.slice(0, 4)}-${local.slice(4)}`
    }
  }

  const referenceMatch =
    compact.match(/(?:ref(?:erencia)?|nro|n[úu]mero|operaci[oó]n)[^\d]{0,12}(\d{6,12})/i) ||
    compact.match(/\b(\d{8,12})\b/)
  const reference = referenceMatch ? referenceMatch[1] : ''

  const amountMatch = compact.match(
    /(?:bs\.?|ves)?\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+,[0-9]{2})/i
  )
  const amount = amountMatch ? `Bs. ${amountMatch[1]}` : ''

  const lower = compact.toLowerCase()
  const bankItem = BANKS.find((item) => {
    const name = item.name.toLowerCase()
    return (
      compact.includes(item.code) ||
      lower.includes(name) ||
      (name.includes('banesco') && lower.includes('banesco')) ||
      (name.includes('mercantil') && lower.includes('mercantil')) ||
      (name.includes('provincial') && lower.includes('provincial'))
    )
  })

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
